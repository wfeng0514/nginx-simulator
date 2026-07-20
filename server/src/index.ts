// === nginx-simulator 服务端入口 ===
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { NginxSimulator } from './core/simulator';
import { createApiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 初始化模拟器
const configsDir = path.join(__dirname, 'config');
const simulator = new NginxSimulator(configsDir);

// 默认加载 dev 配置
try {
  const configs = simulator.listConfigs();
  if (configs.length > 0) {
    simulator.loadConfig(configs[0].name);
    console.log(`✓ 已加载配置: ${configs[0].name}`);
  }
} catch (e) {
  console.log('初始化配置加载失败，请通过 API 加载:', e);
}

// API 路由
app.use('/api', createApiRouter(simulator));

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Nginx Simulator 服务已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api`);
  console.log(`  状态: http://localhost:${PORT}/api/status\n`);
});
