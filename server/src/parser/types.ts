// === nginx 配置 AST 类型定义 ===

export interface Directive {
  name: string;
  parameters: string[];
  line: number;
}

export interface LocationBlock {
  modifier: '=' | '~' | '~*' | '^~' | null;
  prefix: string;
  directives: Directive[];
  nested: LocationBlock[];
}

export interface ServerBlock {
  listen: Directive[];
  serverName: Directive[];
  directives: Directive[];
  locations: LocationBlock[];
}

export interface UpstreamServerDef {
  address: string;
  port: number;
  weight: number;          // 默认 1
  maxFails: number;        // 默认 1
  failTimeout: number;     // 默认 10 秒
  backup: boolean;
  down: boolean;
}

export interface UpstreamBlock {
  name: string;
  algorithm: string;       // round_robin | least_conn | ip_hash | random
  directives: Directive[];
  servers: UpstreamServerDef[];
}

export interface HttpBlock {
  directives: Directive[];
  upstreams: UpstreamBlock[];
  servers: ServerBlock[];
}

export interface EventsBlock {
  directives: Directive[];
}

export interface ParsedConfig {
  filePath: string;
  environment: 'dev' | 'prod';
  events?: EventsBlock;
  http?: HttpBlock;
}
