// === nginx 路由匹配引擎 ===
// 实现 server_name 和 location 的匹配逻辑

import { ServerBlock, LocationBlock } from '../parser/types';

/**
 * 根据 Host 头匹配最佳 server block
 * 策略：精确匹配 > 前导通配符 > 后缀通配符 > 正则 > 默认（首个或 default_server）
 */
export function matchServer(host: string, servers: ServerBlock[]): { server: ServerBlock; serverName: string } | null {
  if (servers.length === 0) return null;

  // 1. 精确匹配
  for (const server of servers) {
    for (const sn of server.serverName) {
      for (const name of sn.parameters) {
        if (name === host) {
          return { server, serverName: name };
        }
      }
    }
  }

  // 2. 前导通配符 *.example.com
  for (const server of servers) {
    for (const sn of server.serverName) {
      for (const name of sn.parameters) {
        if (name.startsWith('*.')) {
          const suffix = name.slice(1); // .example.com
          if (host.endsWith(suffix)) {
            return { server, serverName: name };
          }
        }
      }
    }
  }

  // 3. 后缀通配符 example.*
  for (const server of servers) {
    for (const sn of server.serverName) {
      for (const name of sn.parameters) {
        if (name.endsWith('.*')) {
          const prefix = name.slice(0, -2);
          if (host.startsWith(prefix)) {
            return { server, serverName: name };
          }
        }
      }
    }
  }

  // 4. 正则 server_name (~ 开头)
  for (const server of servers) {
    for (const sn of server.serverName) {
      for (const name of sn.parameters) {
        if (name.startsWith('~')) {
          try {
            const pattern = name.slice(1).trim();
            if (new RegExp(pattern).test(host)) {
              return { server, serverName: name };
            }
          } catch { /* 跳过无效正则 */ }
        }
      }
    }
  }

  // 5. 默认匹配：查找 default_server 或返回第一个
  for (const server of servers) {
    for (const listen of server.listen) {
      if (listen.parameters.includes('default_server')) {
        return { server, serverName: '_default_' };
      }
    }
  }

  // 返回第一个 server 作为默认
  const firstName = servers[0].serverName[0]?.parameters[0] || '_';
  return { server: servers[0], serverName: firstName };
}

/**
 * 根据 URI 匹配最佳 location block
 * 严格按照 nginx 优先级：
 *   1. = 精确匹配（找到立即返回）
 *   2. ^~ 前缀匹配（记录最长，阻止后续正则）
 *   3. ~ 和 ~* 正则匹配（按配置顺序，第一个匹配返回）
 *   4. 普通前缀匹配（最长匹配）
 */
export function matchLocation(
  uri: string,
  locations: LocationBlock[]
): { location: LocationBlock; matchType: string } | null {
  if (locations.length === 0) return null;

  // 标准化 URI（去掉 query string 用于匹配）
  const path = uri.split('?')[0];

  // 收集所有 location（包括嵌套）
  const flatList = flattenLocations(locations);

  // 1. 精确匹配 =
  for (const loc of flatList) {
    if (loc.modifier === '=' && loc.prefix === path) {
      return { location: loc, matchType: 'exact' };
    }
  }

  // 2. 记录 ^~ 前缀最长匹配
  let bestCaretMatch: { location: LocationBlock; len: number } | null = null;
  for (const loc of flatList) {
    if (loc.modifier === '^~' && path.startsWith(loc.prefix)) {
      if (!bestCaretMatch || loc.prefix.length > bestCaretMatch.len) {
        bestCaretMatch = { location: loc, len: loc.prefix.length };
      }
    }
  }

  // 3. 正则匹配 ~ 和 ~*
  for (const loc of flatList) {
    if (loc.modifier === '~' || loc.modifier === '~*') {
      try {
        const flags = loc.modifier === '~*' ? 'i' : '';
        if (new RegExp(loc.prefix, flags).test(path)) {
          return { location: loc, matchType: loc.modifier === '~*' ? 'regex_case_insensitive' : 'regex' };
        }
      } catch {
        // 无效正则，跳过
      }
    }
  }

  // 4. 如果有 ^~ 匹配且没有正则匹配，返回 ^~
  if (bestCaretMatch) {
    return { location: bestCaretMatch.location, matchType: 'prefix_noregex' };
  }

  // 5. 普通前缀最长匹配
  let bestPrefix: { location: LocationBlock; len: number } | null = null;
  for (const loc of flatList) {
    if (loc.modifier === null && path.startsWith(loc.prefix)) {
      if (!bestPrefix || loc.prefix.length > bestPrefix.len) {
        bestPrefix = { location: loc, len: loc.prefix.length };
      }
    }
  }

  if (bestPrefix) {
    return { location: bestPrefix.location, matchType: 'prefix' };
  }

  return null;
}

/** 展开嵌套 location */
function flattenLocations(locations: LocationBlock[]): LocationBlock[] {
  const result: LocationBlock[] = [];
  for (const loc of locations) {
    result.push(loc);
    if (loc.nested.length > 0) {
      result.push(...flattenLocations(loc.nested));
    }
  }
  return result;
}
