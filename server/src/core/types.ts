// === nginx 核心模拟器类型定义 ===

import { ParsedConfig, ServerBlock, LocationBlock } from '../parser/types';

/** 模拟 HTTP 请求 */
export interface HttpRequest {
  id: string;
  method: string;
  uri: string;          // 含 query string: /path?key=val
  scheme: 'http' | 'https';
  host: string;
  headers: Record<string, string>;
  body?: string;
  clientIp: string;
}

/** 处理阶段 */
export enum ProcessingPhase {
  SSL_TERMINATION = 'ssl_termination',
  SERVER_SELECTION = 'server_selection',
  ACCESS_CONTROL_SERVER = 'access_control_server',
  SERVER_REWRITE = 'server_rewrite',
  LOCATION_SELECTION = 'location_selection',
  ACCESS_CONTROL_LOCATION = 'access_control_location',
  REWRITE = 'rewrite',
  RATE_LIMIT = 'rate_limit',
  CONTENT_HANDLER = 'content_handler',
  RESPONSE_HEADERS = 'response_headers',
  ERROR_PAGE = 'error_page',
  LOGGING = 'logging',
}

export const PHASE_LABELS: Record<ProcessingPhase, string> = {
  [ProcessingPhase.SSL_TERMINATION]: 'SSL/TLS 终止',
  [ProcessingPhase.SERVER_SELECTION]: 'Server 块选择',
  [ProcessingPhase.ACCESS_CONTROL_SERVER]: 'Server 级访问控制',
  [ProcessingPhase.SERVER_REWRITE]: 'Server 级 Rewrite',
  [ProcessingPhase.LOCATION_SELECTION]: 'Location 块选择',
  [ProcessingPhase.ACCESS_CONTROL_LOCATION]: 'Location 级访问控制',
  [ProcessingPhase.REWRITE]: 'Rewrite 规则',
  [ProcessingPhase.RATE_LIMIT]: '频率限制',
  [ProcessingPhase.CONTENT_HANDLER]: '内容处理',
  [ProcessingPhase.RESPONSE_HEADERS]: '响应头处理',
  [ProcessingPhase.ERROR_PAGE]: '错误页面',
  [ProcessingPhase.LOGGING]: '日志记录',
};

/** 单个处理步骤 */
export interface ProcessingStep {
  order: number;
  phase: ProcessingPhase;
  phaseLabel: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  matched: boolean;
  duration: number;       // 模拟微秒
  error?: string;
}

/** 匹配结果 */
export interface MatchResult {
  server: ServerBlock | null;
  serverName: string;
  location: LocationBlock | null;
  locationPrefix: string;
  locationModifier: string | null;
  matchType: string;
}

/** 上游服务器运行时状态 */
export interface UpstreamServerState {
  address: string;
  port: number;
  weight: number;
  backup: boolean;
  down: boolean;
  healthy: boolean;
  requestCount: number;
  activeConnections: number;
  currentWeight: number;   // 加权轮询使用
}

/** 上游组状态 */
export interface UpstreamGroupState {
  name: string;
  algorithm: string;
  servers: UpstreamServerState[];
  totalRequests: number;
  lastIndex: number;       // 轮询使用
}

/** 模拟结果 */
export interface SimResult {
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  matchedServer: string;
  matchedLocation: string;
  matchType: string;
  upstreamServer: string | null;
  upstreamName: string | null;
  upstreamAlgorithm: string | null;
  processingSteps: ProcessingStep[];
  elapsed: number;         // 总模拟耗时 ms
  activeConfig: string;
  environment: string;
}

/** 全局统计 */
export interface GlobalStats {
  totalRequests: number;
  activeConfig: string;
  environment: string;
  serverBlocks: number;
  locationBlocks: number;
  upstreams: number;
}
