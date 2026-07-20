// === nginx 负载均衡算法实现 ===
// 支持：round_robin, weighted, least_conn, ip_hash, random

import { UpstreamGroupState, UpstreamServerState } from './types';
import { UpstreamBlock } from '../parser/types';

/** 初始化上游组状态 */
export function initUpstreamState(upstream: UpstreamBlock): UpstreamGroupState {
  const servers: UpstreamServerState[] = upstream.servers.map((s) => ({
    address: s.address,
    port: s.port,
    weight: s.weight,
    backup: s.backup,
    down: s.down,
    healthy: !s.down,
    requestCount: 0,
    activeConnections: 0,
    currentWeight: s.weight,
  }));

  return {
    name: upstream.name,
    algorithm: upstream.algorithm,
    servers,
    totalRequests: 0,
    lastIndex: 0,
  };
}

/** 获取健康且非 backup 的服务器列表 */
function getHealthy(state: UpstreamGroupState): UpstreamServerState[] {
  let servers = state.servers.filter((s) => s.healthy && !s.down);

  if (servers.length === 0) {
    // 使用 backup 服务器
    servers = state.servers.filter((s) => s.backup && s.healthy && !s.down);
  }

  return servers;
}

/** 选择一个上游服务器 */
export function selectServer(state: UpstreamGroupState, clientIp: string | null): UpstreamServerState | null {
  const healthy = getHealthy(state);
  if (healthy.length === 0) return null;

  let selected: UpstreamServerState | null = null;

  switch (state.algorithm) {
    case 'round_robin':
      // 如果配置了 weight，自动升级为加权轮询（nginx 默认行为）
      const hasWeightRR = healthy.some((s) => s.weight > 1);
      selected = hasWeightRR ? weightedRoundRobin(healthy, state) : roundRobin(healthy, state);
      break;
    case 'least_conn':
      selected = leastConnections(healthy);
      break;
    case 'ip_hash':
      selected = ipHash(healthy, clientIp || '0.0.0.0');
      break;
    case 'random':
      selected = randomSelect(healthy);
      break;
    default:
      // 检测是否配置了 weight
      const hasWeight = healthy.some((s) => s.weight > 1);
      selected = hasWeight ? weightedRoundRobin(healthy, state) : roundRobin(healthy, state);
      break;
  }

  if (selected) {
    selected.requestCount++;
    selected.activeConnections++;
    state.totalRequests++;
  }

  return selected;
}

/** 模拟请求完成，减少活跃连接数 */
export function releaseServer(state: UpstreamGroupState, address: string, port: number): void {
  const server = state.servers.find((s) => s.address === address && s.port === port);
  if (server && server.activeConnections > 0) {
    server.activeConnections--;
  }
}

/** 轮询 */
function roundRobin(healthy: UpstreamServerState[], state: UpstreamGroupState): UpstreamServerState {
  state.lastIndex = (state.lastIndex + 1) % healthy.length;
  return healthy[state.lastIndex];
}

/** 加权轮询（平滑加权算法） */
function weightedRoundRobin(healthy: UpstreamServerState[], state: UpstreamGroupState): UpstreamServerState {
  let best: UpstreamServerState | null = null;
  let totalWeight = 0;

  for (const s of healthy) {
    s.currentWeight += s.weight;
    totalWeight += s.weight;
    if (!best || s.currentWeight > best.currentWeight) {
      best = s;
    }
  }

  if (!best) return healthy[0];

  best.currentWeight -= totalWeight;
  return best;
}

/** 最少连接 */
function leastConnections(healthy: UpstreamServerState[]): UpstreamServerState {
  let best = healthy[0];
  for (const s of healthy) {
    if (s.activeConnections < best.activeConnections) {
      best = s;
    } else if (s.activeConnections === best.activeConnections && s.weight > best.weight) {
      best = s;
    }
  }
  return best;
}

/** IP 哈希 */
function ipHash(healthy: UpstreamServerState[], clientIp: string): UpstreamServerState {
  const hash = fnv1aHash(clientIp);
  const index = Math.abs(hash) % healthy.length;
  return healthy[index];
}

/** 随机 */
function randomSelect(healthy: UpstreamServerState[]): UpstreamServerState {
  const weightedPool: UpstreamServerState[] = [];
  for (const s of healthy) {
    for (let i = 0; i < s.weight; i++) {
      weightedPool.push(s);
    }
  }
  const index = Math.floor(Math.random() * weightedPool.length);
  return weightedPool[index];
}

/** FNV-1a 哈希（用于 ip_hash） */
function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}
