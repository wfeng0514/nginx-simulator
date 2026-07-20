// === nginx 核心模拟器 ===
// 整合配置解析、路由匹配、负载均衡、请求管道

import { ParsedConfig } from '../parser/types';
import { parseConfig } from '../parser/parser';
import {
  HttpRequest, SimResult, UpstreamGroupState, GlobalStats,
} from './types';
import { initUpstreamState } from './upstream';
import { executePipeline } from './pipeline';
import * as fs from 'fs';
import * as path from 'path';

export class NginxSimulator {
  private config: ParsedConfig | null = null;
  private upstreamStates = new Map<string, UpstreamGroupState>();
  private totalRequests = 0;
  private configsDir: string;
  private activeConfigName = '';

  constructor(configsDir: string) {
    this.configsDir = configsDir;
  }

  /** 列出所有配置 */
  listConfigs(): { name: string; environment: string }[] {
    const entries = fs.readdirSync(this.configsDir);
    return entries
      .filter((f) => f.endsWith('.conf'))
      .map((f) => ({
        name: f,
        environment: f.includes('dev') ? 'dev' : 'prod',
      }));
  }

  /** 加载配置文件 */
  loadConfig(name: string): ParsedConfig {
    const filePath = path.join(this.configsDir, name);
    const text = fs.readFileSync(filePath, 'utf-8');
    this.config = parseConfig(text, filePath);
    this.activeConfigName = name;

    // 初始化 upstream 状态
    this.upstreamStates.clear();
    if (this.config.http) {
      for (const up of this.config.http.upstreams) {
        this.upstreamStates.set(up.name, initUpstreamState(up));
      }
    }

    return this.config;
  }

  /** 获取配置内容 */
  getConfigContent(name: string): string {
    const filePath = path.join(this.configsDir, name);
    return fs.readFileSync(filePath, 'utf-8');
  }

  /** 模拟请求 */
  simulate(request: HttpRequest): SimResult {
    if (!this.config) {
      throw new Error('请先加载配置文件');
    }

    const startTime = Date.now();

    const {
      steps, statusCode, statusText,
      responseHeaders, responseBody,
      upstreamServer, upstreamName, upstreamAlgorithm,
      result,
    } = executePipeline(request, this.config, this.upstreamStates);

    this.totalRequests++;

    return {
      requestId: request.id,
      statusCode,
      statusText,
      headers: responseHeaders,
      body: responseBody,
      matchedServer: result.serverName,
      matchedLocation: result.locationPrefix || result.matchType || '(none)',
      matchType: result.matchType,
      upstreamServer,
      upstreamName,
      upstreamAlgorithm,
      processingSteps: steps,
      elapsed: Date.now() - startTime,
      activeConfig: this.activeConfigName,
      environment: this.config.environment,
    };
  }

  /** 获取上游状态 */
  getUpstreamStates(): Map<string, UpstreamGroupState> {
    return this.upstreamStates;
  }

  /** 重置上游 */
  resetUpstream(name: string): boolean {
    const state = this.upstreamStates.get(name);
    if (!state) return false;

    for (const s of state.servers) {
      s.requestCount = 0;
      s.activeConnections = 0;
      s.currentWeight = s.weight;
    }
    state.totalRequests = 0;
    state.lastIndex = 0;
    return true;
  }

  /** 全局统计 */
  getGlobalStats(): GlobalStats {
    let locationBlocks = 0;
    if (this.config?.http) {
      for (const s of this.config.http.servers) {
        locationBlocks += countLocations(s.locations);
      }
    }

    return {
      totalRequests: this.totalRequests,
      activeConfig: this.activeConfigName,
      environment: this.config?.environment || '',
      serverBlocks: this.config?.http?.servers.length || 0,
      locationBlocks,
      upstreams: this.config?.http?.upstreams.length || 0,
    };
  }
}

function countLocations(locations: import('../parser/types').LocationBlock[]): number {
  let count = locations.length;
  for (const loc of locations) {
    if (loc.nested.length > 0) {
      count += countLocations(loc.nested);
    }
  }
  return count;
}
