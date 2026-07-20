// === nginx 请求处理管道 ===
// 模拟 nginx 的 12 个处理阶段

import { Directive, ServerBlock, LocationBlock, ParsedConfig } from '../parser/types';
import {
  HttpRequest, ProcessingPhase, ProcessingStep, PHASE_LABELS,
  MatchResult, UpstreamGroupState,
} from './types';
import { matchServer, matchLocation } from './matcher';
import { selectServer, releaseServer, initUpstreamState } from './upstream';

/** 创建处理步骤 */
function step(
  order: number, phase: ProcessingPhase,
  action: string, input: Record<string, unknown>,
  output: Record<string, unknown>, matched: boolean,
  error?: string
): ProcessingStep {
  return {
    order, phase, phaseLabel: PHASE_LABELS[phase],
    action, input, output, matched,
    duration: Math.round(Math.random() * 100), // 模拟耗时
    error,
  };
}

/** 执行完整请求处理管道 */
export function executePipeline(
  request: HttpRequest,
  config: ParsedConfig,
  upstreamStates: Map<string, UpstreamGroupState>
): {
  steps: ProcessingStep[];
  result: MatchResult;
  statusCode: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  upstreamServer: string | null;
  upstreamName: string | null;
  upstreamAlgorithm: string | null;
} {
  const steps: ProcessingStep[] = [];
  let order = 0;
  const http = config.http;
  if (!http || http.servers.length === 0) {
    steps.push(step(++order, ProcessingPhase.LOGGING, '无可用 server 块', {}, { error: 'no servers configured' }, false, '配置中没有 server 块'));
    return {
      steps, result: { server: null, serverName: '', location: null, locationPrefix: '', locationModifier: null, matchType: '' },
      statusCode: 502, statusText: 'Bad Gateway', responseHeaders: {}, responseBody: 'No servers configured',
      upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  const headers: Record<string, string> = {};
  let statusCode = 200;
  let statusText = 'OK';
  let body = '';
  let upstreamServer: string | null = null;
  let upstreamName: string | null = null;
  let upstreamAlgorithm: string | null = null;

  // Phase 1: SSL/TLS Termination
  if (request.scheme === 'https') {
    steps.push(step(++order, ProcessingPhase.SSL_TERMINATION,
      'HTTPS 请求，执行 TLS 终止', { scheme: request.scheme },
      { tlsVersion: 'TLSv1.3', cipher: 'ECDHE-RSA-AES256-GCM-SHA384' }, true));
  } else {
    steps.push(step(++order, ProcessingPhase.SSL_TERMINATION,
      'HTTP 请求，跳过 TLS 终止', { scheme: request.scheme }, {}, false));
  }

  // Phase 2: Server 块选择
  const serverMatch = matchServer(request.host, http.servers);
  if (!serverMatch) {
    steps.push(step(++order, ProcessingPhase.SERVER_SELECTION,
      '未匹配到 server 块', { host: request.host }, {}, false, 'no server_name matched'));
    steps.push(step(++order, ProcessingPhase.LOGGING, '请求结束', { status: 404 }, { status: 404 }, true));
    return {
      steps, result: { server: null, serverName: '', location: null, locationPrefix: '', locationModifier: null, matchType: '' },
      statusCode: 404, statusText: 'Not Found', responseHeaders: headers, responseBody: 'No server matched',
      upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  const { server, serverName } = serverMatch;
  steps.push(step(++order, ProcessingPhase.SERVER_SELECTION,
    `匹配 server 块: ${serverName}`,
    { host: request.host, availableServers: http.servers.map(s => s.serverName[0]?.parameters[0] || '_') },
    { matchedServer: serverName }, true));

  // Phase 3: Server 级访问控制
  const serverAccessResult = checkAccessControl(server.directives, request.clientIp);
  steps.push(step(++order, ProcessingPhase.ACCESS_CONTROL_SERVER,
    serverAccessResult.allowed ? 'Server 级访问控制：允许' : 'Server 级访问控制：拒绝',
    { clientIp: request.clientIp, rules: serverAccessResult.rules },
    { allowed: serverAccessResult.allowed, matchedRule: serverAccessResult.matchedRule }, serverAccessResult.allowed));

  if (!serverAccessResult.allowed) {
    return finishResponse(steps, order, 403, 'Forbidden', headers, 'Access Denied', serverName, null, '', null, null, null);
  }

  // Phase 4: Server 级 Rewrite
  const serverRewrites = findDirectives(server.directives, 'rewrite');
  let currentUri = request.uri;
  for (const rw of serverRewrites) {
    const result = applyRewrite(rw, currentUri);
    if (result.changed) {
      currentUri = result.newUri;
      steps.push(step(++order, ProcessingPhase.SERVER_REWRITE,
        `Server 级 rewrite: ${rw.parameters[0]} => ${rw.parameters[1]}`,
        { oldUri: request.uri, pattern: rw.parameters[0], replacement: rw.parameters[1] },
        { newUri: currentUri }, true));
    }
  }
  if (serverRewrites.length === 0) {
    steps.push(step(++order, ProcessingPhase.SERVER_REWRITE,
      '无 Server 级 rewrite 规则', {}, {}, false));
  }

  // Phase 5: Location 选择
  const allLocations = collectAllLocations(server.locations);
  const locationMatch = matchLocation(currentUri, server.locations);

  let matchedLocation: LocationBlock | null = null;
  let matchType = '';

  if (locationMatch) {
    matchedLocation = locationMatch.location;
    matchType = locationMatch.matchType;
    steps.push(step(++order, ProcessingPhase.LOCATION_SELECTION,
      `匹配 location: ${locationMatch.location.modifier || ''} ${locationMatch.location.prefix} (${locationMatch.matchType})`,
      { uri: currentUri, totalLocations: allLocations.length, modifiers: allLocations.map(l => `${l.modifier || '(none)'} ${l.prefix}`) },
      { matchedPrefix: matchedLocation.prefix, modifier: matchedLocation.modifier, matchType }, true));
  } else {
    steps.push(step(++order, ProcessingPhase.LOCATION_SELECTION,
      '未匹配到 location，使用 server 默认处理',
      { uri: currentUri }, { fallback: 'server_default' }, false));
  }

  // Phase 6: Location 级访问控制
  if (matchedLocation) {
    const locationAccess = checkAccessControl(matchedLocation.directives, request.clientIp);
    steps.push(step(++order, ProcessingPhase.ACCESS_CONTROL_LOCATION,
      locationAccess.allowed ? 'Location 级访问控制：允许' : 'Location 级访问控制：拒绝',
      { clientIp: request.clientIp }, { allowed: locationAccess.allowed }, locationAccess.allowed));

    if (!locationAccess.allowed) {
      return finishResponse(steps, order, 403, 'Forbidden', headers, 'Access Denied', serverName, matchedLocation?.prefix || null, matchType, null, null, null);
    }
  } else {
    steps.push(step(++order, ProcessingPhase.ACCESS_CONTROL_LOCATION,
      '无 location，跳过访问控制', {}, {}, false));
  }

  // Phase 7: Location 级 Rewrite
  let rewriteHappened = false;
  if (matchedLocation) {
    const rewrites = findDirectives(matchedLocation.directives, 'rewrite');
    for (const rw of rewrites) {
      const result = applyRewrite(rw, currentUri);
      if (result.changed) {
        currentUri = result.newUri;
        rewriteHappened = true;
        steps.push(step(++order, ProcessingPhase.REWRITE,
          `Rewrite: ${rw.parameters[0]} => ${rw.parameters[1]} (flag: ${rw.parameters[2] || '无'})`,
          { pattern: rw.parameters[0], replacement: rw.parameters[1] },
          { newUri: currentUri, isRedirect: result.isRedirect }, true));

        if (result.isRedirect) {
          return finishResponse(steps, order, result.redirectCode || 302, 'Found',
            { ...headers, Location: result.newUri }, '', serverName, matchedLocation.prefix, matchType, null, null, null);
        }
      }
    }
  }
  if (!rewriteHappened) {
    steps.push(step(++order, ProcessingPhase.REWRITE, '无 rewrite 规则匹配', {}, {}, false));
  }

  // Phase 8: 频率限制
  const rateLimited = checkRateLimit(
    matchedLocation ? [...server.directives, ...matchedLocation.directives] : server.directives,
    request
  );
  steps.push(step(++order, ProcessingPhase.RATE_LIMIT,
    rateLimited ? '频率限制：请求被限流' : '频率限制：通过',
    { clientIp: request.clientIp }, { limited: rateLimited }, rateLimited));

  if (rateLimited) {
    return finishResponse(steps, order, 429, 'Too Many Requests', { ...headers, 'Retry-After': '60' }, 'Rate Limited', serverName, matchedLocation?.prefix || null, matchType, null, null, null);
  }

  // Phase 9: 内容处理
  const contentResult = handleContent(
    matchedLocation, server, currentUri, request,
    upstreamStates, http
  );

  steps.push(step(++order, ProcessingPhase.CONTENT_HANDLER,
    contentResult.action,
    contentResult.input,
    contentResult.output, true));

  statusCode = contentResult.statusCode;
  statusText = contentResult.statusText;
  body = contentResult.body;
  upstreamServer = contentResult.upstreamServer;
  upstreamName = contentResult.upstreamName;
  upstreamAlgorithm = contentResult.upstreamAlgorithm;

  // Phase 10: 响应头
  const respHeaders = collectResponseHeaders(
    server.directives,
    matchedLocation?.directives || [],
    http.directives
  );
  Object.assign(headers, respHeaders);
  steps.push(step(++order, ProcessingPhase.RESPONSE_HEADERS,
    Object.keys(respHeaders).length > 0 ? `添加响应头: ${Object.keys(respHeaders).join(', ')}` : '无额外响应头',
    {}, { headers: respHeaders }, Object.keys(respHeaders).length > 0));

  // Phase 11: 错误页面
  if (statusCode >= 400) {
    const errorPage = findErrorPage(server.directives, statusCode);
    if (errorPage) {
      body = `[Error ${statusCode}: ${errorPage}]`;
      steps.push(step(++order, ProcessingPhase.ERROR_PAGE,
        `匹配错误页面: error_page ${statusCode} => ${errorPage}`,
        { statusCode }, { errorPage }, true));
    } else {
      steps.push(step(++order, ProcessingPhase.ERROR_PAGE,
        '无匹配 error_page', { statusCode }, {}, false));
    }
  } else {
    steps.push(step(++order, ProcessingPhase.ERROR_PAGE,
      '状态码正常，跳过 error_page', { statusCode }, {}, false));
  }

  // Phase 12: 日志
  const logEntry = `${request.clientIp} - - [${new Date().toISOString()}] "${request.method} ${request.uri}" ${statusCode} ${body.length}`;
  steps.push(step(++order, ProcessingPhase.LOGGING,
    '写入访问日志', {}, { logEntry }, true));

  // 释放上游连接
  if (upstreamServer && upstreamName) {
    const state = upstreamStates.get(upstreamName);
    if (state) {
      const [addr, portStr] = upstreamServer.split(':');
      releaseServer(state, addr, parseInt(portStr) || 80);
    }
  }

  return {
    steps, statusCode, statusText,
    result: {
      server, serverName,
      location: matchedLocation,
      locationPrefix: matchedLocation?.prefix || '',
      locationModifier: matchedLocation?.modifier || null,
      matchType,
    },
    responseHeaders: headers,
    responseBody: body,
    upstreamServer, upstreamName, upstreamAlgorithm,
  };
}

// === 辅助函数 ===

function finishResponse(
  steps: ProcessingStep[], order: number,
  code: number, text: string, headers: Record<string, string>,
  body: string, serverName: string, locationPrefix: string | null,
  matchType: string, upstreamServer: string | null,
  upstreamName: string | null, upstreamAlgorithm: string | null
) {
  steps.push(step(order + 1, ProcessingPhase.LOGGING, '写入访问日志', {}, { status: code }, true));
  return {
    steps, statusCode: code, statusText: text,
    result: {
      server: null, serverName,
      location: null, locationPrefix: locationPrefix || '', locationModifier: null, matchType,
    },
    responseHeaders: headers, responseBody: body,
    upstreamServer, upstreamName, upstreamAlgorithm,
  };
}

/** 查找指令 */
function findDirectives(directives: Directive[], name: string): Directive[] {
  return directives.filter((d) => d.name === name);
}

function findDirective(directives: Directive[], name: string): Directive | undefined {
  return directives.find((d) => d.name === name);
}

/** 收集所有 location（含嵌套） */
function collectAllLocations(locations: LocationBlock[]): LocationBlock[] {
  const result: LocationBlock[] = [];
  for (const loc of locations) {
    result.push(loc);
    if (loc.nested.length > 0) {
      result.push(...collectAllLocations(loc.nested));
    }
  }
  return result;
}

/** 访问控制检查 — 按配置文件顺序检查，先匹配先生效 */
function checkAccessControl(directives: Directive[], clientIp: string): { allowed: boolean; rules: string[]; matchedRule?: string } {
  const rules: string[] = [];
  // 按指令在配置文件中出现的顺序逐一检查
  for (const d of directives) {
    if (d.name === 'allow' || d.name === 'deny') {
      const ip = d.parameters[0];
      rules.push(`${d.name} ${ip}`);
      if (matchesIp(clientIp, ip)) {
        return { allowed: d.name === 'allow', rules, matchedRule: `${d.name} ${ip}` };
      }
    }
  }
  // 没有匹配的规则时默认允许
  return { allowed: true, rules: rules.length > 0 ? rules : ['默认允许'] };
}

/** 简单 IP 匹配 */
function matchesIp(clientIp: string, rule: string): boolean {
  if (rule === 'all') return true;
  return clientIp === rule || clientIp.startsWith(rule.split('/')[0]);
}

/** Rewrite 规则应用 */
function applyRewrite(directive: Directive, uri: string): { changed: boolean; newUri: string; isRedirect: boolean; redirectCode?: number } {
  const pattern = directive.parameters[0];
  const replacement = directive.parameters[1];
  const flag = directive.parameters[2];

  try {
    const regex = new RegExp(pattern);
    const newUri = uri.replace(regex, replacement);

    const isRedirect = flag === 'redirect' || flag === 'permanent';
    const redirectCode = flag === 'permanent' ? 301 : 302;

    if (newUri !== uri) {
      return { changed: true, newUri, isRedirect, redirectCode };
    }
  } catch {
    // 无效正則，跳过
  }

  return { changed: false, newUri: uri, isRedirect: false };
}

/** 频率限制检查（简化版：每 IP 最多 100 请求/分钟） */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(directives: Directive[], request: HttpRequest): boolean {
  const limitReq = findDirective(directives, 'limit_req');
  const limitReqZone = findDirective(directives, 'limit_req_zone');

  if (!limitReq && !limitReqZone) return false;

  const key = request.clientIp;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 });
    return false;
  }

  entry.count++;
  const rate = limitReq?.parameters[0] ? parseInt(limitReq.parameters[0].replace('rate=', ''), 10) : 100;
  return entry.count > rate;
}

/** 内容处理：proxy_pass / return / try_files */
function handleContent(
  location: LocationBlock | null,
  server: ServerBlock,
  uri: string,
  request: HttpRequest,
  upstreamStates: Map<string, UpstreamGroupState>,
  http: { upstreams: import('../parser/types').UpstreamBlock[] }
): {
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  statusCode: number;
  statusText: string;
  body: string;
  upstreamServer: string | null;
  upstreamName: string | null;
  upstreamAlgorithm: string | null;
} {
  const directives = location ? [...location.directives] : [...server.directives];

  // 检查 return 指令
  const returnDir = findDirective(directives, 'return');
  if (returnDir) {
    const code = parseInt(returnDir.parameters[0], 10);
    const text = returnDir.parameters[1] || '';
    const statusText = getStatusText(code);
    return {
      action: `return 指令: ${code} ${text}`,
      input: { directive: `return ${returnDir.parameters.join(' ')}` },
      output: { statusCode: code, body: text },
      statusCode: code, statusText,
      body: text,
      upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  // 检查 proxy_pass
  const proxyPass = findDirective(directives, 'proxy_pass');
  if (proxyPass) {
    const target = proxyPass.parameters[0];
    // 检查是否指向 upstream
    const upstreamMatch = target.match(/^https?:\/\/([a-zA-Z0-9_-]+)$/);
    if (upstreamMatch) {
      const upName = upstreamMatch[1];
      const upDef = http.upstreams.find((u) => u.name === upName);
      let upState = upstreamStates.get(upName);

      if (!upState && upDef) {
        upState = initUpstreamState(upDef);
        upstreamStates.set(upName, upState);
      }

      if (upState) {
        const selected = selectServer(upState, request.clientIp);
        if (selected) {
          const serverAddr = `${selected.address}:${selected.port}`;
          return {
            action: `proxy_pass → upstream ${upName} (${upState.algorithm}) → ${serverAddr}`,
            input: { proxyPass: target, upstream: upName, algorithm: upState.algorithm, servers: upState.servers.map(s => `${s.address}:${s.port}`) },
            output: { selectedServer: serverAddr, weight: selected.weight },
            statusCode: 200, statusText: 'OK',
            body: `{"message":"模拟上游响应","upstream":"${upName}","server":"${serverAddr}","uri":"${uri}"}`,
            upstreamServer: serverAddr, upstreamName: upName, upstreamAlgorithm: upState.algorithm,
          };
        }
      }
    }

    // 直接 URL
    return {
      action: `proxy_pass → ${target}`,
      input: { proxyPass: target },
      output: { proxied: true },
      statusCode: 200, statusText: 'OK',
      body: `{"message":"模拟代理响应","target":"${target}","uri":"${uri}"}`,
      upstreamServer: target, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  // 检查 try_files
  const tryFiles = findDirective(directives, 'try_files');
  if (tryFiles) {
    const files = tryFiles.parameters;
    const lastParam = files[files.length - 1];
    // 模拟文件检查
    const foundFile = files.find((f) => f !== lastParam && !f.startsWith('='));
    if (foundFile) {
      return {
        action: `try_files: 找到文件 ${foundFile}`,
        input: { tryFiles: files },
        output: { found: foundFile },
        statusCode: 200, statusText: 'OK',
        body: `[模拟静态文件内容: ${foundFile}]`,
        upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
      };
    }
    // 回退到最后一个参数
    const fallback = lastParam.startsWith('=') ? lastParam : `@${lastParam}`;
    return {
      action: `try_files: 无文件匹配，回退至 ${fallback}`,
      input: { tryFiles: files },
      output: { fallback },
      statusCode: lastParam.startsWith('=') ? parseInt(lastParam.slice(1), 10) : 404,
      statusText: lastParam.startsWith('=') ? getStatusText(parseInt(lastParam.slice(1), 10)) : 'Not Found',
      body: `[回退处理: ${fallback}]`,
      upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  // 默认处理 - 静态文件或 index
  if (location?.prefix === '/' || !location) {
    return {
      action: '默认静态文件处理: index.html',
      input: { uri },
      output: { served: 'index.html' },
      statusCode: 200, statusText: 'OK',
      body: '<html><body><h1>Nginx Simulator</h1><p>模拟静态页面响应</p></body></html>',
      upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
    };
  }

  return {
    action: `默认处理: ${uri}`,
    input: { uri },
    output: { served: 'default' },
    statusCode: 200, statusText: 'OK',
    body: `[默认响应: ${uri}]`,
    upstreamServer: null, upstreamName: null, upstreamAlgorithm: null,
  };
}

/** 收集响应头 */
function collectResponseHeaders(serverDirs: Directive[], locationDirs: Directive[], httpDirs: Directive[]): Record<string, string> {
  const headers: Record<string, string> = {};

  const allDirs = [...httpDirs, ...serverDirs, ...locationDirs];

  // add_header
  for (const d of allDirs) {
    if (d.name === 'add_header' && d.parameters.length >= 2) {
      headers[d.parameters[0]] = d.parameters.slice(1).join(' ');
    }
  }

  // gzip
  const gzip = allDirs.find((d) => d.name === 'gzip');
  if (gzip && gzip.parameters[0] === 'on') {
    headers['Content-Encoding'] = 'gzip';
  }

  // CORS
  const corsOrigin = allDirs.find((d) => d.name === 'add_header' && d.parameters[0] === 'Access-Control-Allow-Origin');
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin.parameters.slice(1).join(' ');
  }

  return headers;
}

/** 查找 error_page */
function findErrorPage(directives: Directive[], statusCode: number): string | null {
  for (const d of directives) {
    if (d.name === 'error_page') {
      const codes = d.parameters.slice(0, -1);
      const page = d.parameters[d.parameters.length - 1];
      if (codes.includes(statusCode.toString())) {
        return page;
      }
    }
  }
  return null;
}

/** HTTP 状态码文本 */
function getStatusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK', 301: 'Moved Permanently', 302: 'Found',
    304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
    403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
    429: 'Too Many Requests', 500: 'Internal Server Error',
    502: 'Bad Gateway', 503: 'Service Unavailable',
  };
  return map[code] || 'Unknown';
}
