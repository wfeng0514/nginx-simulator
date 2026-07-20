// === API 客户端 ===
// 所有与后端通信的接口封装

const BASE = '/api';

export interface ConfigInfo {
  name: string;
  environment: string;
}

export interface ConfigContent {
  name: string;
  content: string;
}

export interface ConfigActivated {
  name: string;
  environment: string;
  serverBlocks: number;
  locationBlocks: number;
  upstreams: number;
  upstreamNames: string[];
}

export interface SimulateParams {
  method?: string;
  uri?: string;
  host?: string;
  scheme?: 'http' | 'https';
  headers?: Record<string, string>;
  body?: string;
  clientIp?: string;
}

export interface ProcessingStep {
  order: number;
  phase: string;
  phaseLabel: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  matched: boolean;
  duration: number;
  error?: string;
}

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
  elapsed: number;
  activeConfig: string;
  environment: string;
}

export interface UpstreamServerInfo {
  address: string;
  port: number;
  weight: number;
  backup: boolean;
  down: boolean;
  healthy: boolean;
  requestCount: number;
  activeConnections: number;
}

export interface UpstreamInfo {
  name: string;
  algorithm: string;
  totalRequests: number;
  servers: UpstreamServerInfo[];
}

export interface GlobalStats {
  totalRequests: number;
  activeConfig: string;
  environment: string;
  serverBlocks: number;
  locationBlocks: number;
  upstreams: number;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getConfigs: () => request<ConfigInfo[]>('/configs'),
  getConfig: (name: string) => request<ConfigContent>(`/configs/${name}`),
  activateConfig: (name: string) =>
    request<ConfigActivated>(`/configs/${name}/activate`, { method: 'POST' }),
  simulate: (params: SimulateParams) =>
    request<SimResult>('/simulate', { method: 'POST', body: JSON.stringify(params) }),
  getUpstreams: () => request<UpstreamInfo[]>('/upstreams'),
  getUpstream: (name: string) => request<UpstreamInfo>(`/upstreams/${name}`),
  resetUpstream: (name: string) =>
    request<{ message: string }>(`/upstreams/${name}/reset`, { method: 'POST' }),
  getStatus: () => request<GlobalStats>('/status'),
};
