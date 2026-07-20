// === REST API 路由 ===
import { Router, Request, Response } from 'express';
import { NginxSimulator } from '../core/simulator';
import { HttpRequest } from '../core/types';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function createApiRouter(simulator: NginxSimulator): Router {
  const router = Router();

  // GET /api/configs - 列出所有配置
  router.get('/configs', (_req: Request, res: Response) => {
    const configs = simulator.listConfigs();
    res.json(configs);
  });

  // GET /api/configs/:name - 获取配置内容
  router.get('/configs/:name', (req: Request, res: Response) => {
    try {
      const content = simulator.getConfigContent(req.params.name);
      res.json({ name: req.params.name, content });
    } catch {
      res.status(404).json({ error: '配置文件不存在' });
    }
  });

  // POST /api/configs/:name/activate - 激活配置
  router.post('/configs/:name/activate', (req: Request, res: Response) => {
    try {
      const config = simulator.loadConfig(req.params.name);
      res.json({
        name: req.params.name,
        environment: config.environment,
        serverBlocks: config.http?.servers.length || 0,
        locationBlocks: config.http?.servers.reduce((acc, s) => acc + s.locations.length, 0) || 0,
        upstreams: config.http?.upstreams.length || 0,
        upstreamNames: config.http?.upstreams.map(u => u.name) || [],
      });
    } catch (e: any) {
      res.status(400).json({ error: `加载失败: ${e.message}` });
    }
  });

  // POST /api/simulate - 模拟请求
  router.post('/simulate', (req: Request, res: Response) => {
    try {
      const body = req.body;
      const request: HttpRequest = {
        id: genId(),
        method: body.method || 'GET',
        uri: body.uri || '/',
        scheme: body.scheme || 'http',
        host: body.host || 'localhost',
        headers: body.headers || {},
        body: body.body || '',
        clientIp: body.clientIp || '127.0.0.1',
      };

      const result = simulator.simulate(request);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: `模拟失败: ${e.message}` });
    }
  });

  // GET /api/upstreams - 获取所有上游状态
  router.get('/upstreams', (_req: Request, res: Response) => {
    const states = simulator.getUpstreamStates();
    const result: Record<string, unknown>[] = [];
    states.forEach((state, name) => {
      result.push({
        name,
        algorithm: state.algorithm,
        totalRequests: state.totalRequests,
        servers: state.servers.map(s => ({
          address: s.address,
          port: s.port,
          weight: s.weight,
          backup: s.backup,
          down: s.down,
          healthy: s.healthy,
          requestCount: s.requestCount,
          activeConnections: s.activeConnections,
        })),
      });
    });
    res.json(result);
  });

  // GET /api/upstreams/:name - 获取单个上游状态
  router.get('/upstreams/:name', (req: Request, res: Response) => {
    const states = simulator.getUpstreamStates();
    const state = states.get(req.params.name);
    if (!state) {
      res.status(404).json({ error: '上游组不存在' });
      return;
    }
    res.json({
      name: state.name,
      algorithm: state.algorithm,
      totalRequests: state.totalRequests,
      servers: state.servers.map(s => ({
        address: s.address,
        port: s.port,
        weight: s.weight,
        backup: s.backup,
        down: s.down,
        healthy: s.healthy,
        requestCount: s.requestCount,
        activeConnections: s.activeConnections,
      })),
    });
  });

  // POST /api/upstreams/:name/reset - 重置上游
  router.post('/upstreams/:name/reset', (req: Request, res: Response) => {
    const ok = simulator.resetUpstream(req.params.name);
    if (!ok) {
      res.status(404).json({ error: '上游组不存在' });
      return;
    }
    res.json({ message: `已重置上游组 ${req.params.name}` });
  });

  // GET /api/status - 全局统计
  router.get('/status', (_req: Request, res: Response) => {
    const stats = simulator.getGlobalStats();
    res.json(stats);
  });

  return router;
}
