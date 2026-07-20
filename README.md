# 🖥 Nginx Simulator — Nginx 工作原理模拟器

一个基于 **Node.js + React + TypeScript** 的 Nginx 工作原理模拟器，通过代码模拟 Nginx 的核心功能：**虚拟主机路由、Location 匹配、负载均衡、Rewrite 规则、反向代理**等，并提供可视化前端界面进行交互式学习和调试。

## ✨ 功能特性

### 🔧 后端模拟引擎
- **配置解析器**：完整的 nginx 风格配置词法/语法分析器，将配置文件解析为 AST
- **Server 匹配**：支持精确匹配、通配符、正则等 `server_name` 匹配策略
- **Location 匹配**：完整实现 nginx 优先级规则（`=` > `^~` > `~`/`~*` > 前缀最长匹配）
- **负载均衡**：支持 5 种算法 — 轮询、加权轮询、最少连接、IP 哈希、随机
- **请求管道**：模拟 nginx 12 个处理阶段（SSL → Server 匹配 → 访问控制 → Rewrite → Location 匹配 → 频率限制 → 内容处理 → 响应头 → 错误页面 → 日志）
- **指令支持**：`proxy_pass`、`rewrite`、`return`、`try_files`、`error_page`、`add_header`、`allow`/`deny`、`gzip`、`limit_req`、`ssl_*` 等

### 🎨 前端可视化
- **📊 总览面板**：配置摘要、请求统计、上游服务器状态
- **📁 配置管理**：查看/切换/激活 nginx 配置文件，语法高亮展示
- **🔧 请求模拟器**：自定义 HTTP 请求，实时查看路由决策链路
- **🔍 路由链路**：可视化 12 步处理阶段时间线
- **🖥 上游监控**：负载均衡分布图、服务器健康状态、请求占比

### 📋 配置文件示例
- **开发环境** (`nginx.dev.conf`)：CORS 全开、详细日志、多 Location 匹配场景、3 种负载均衡算法
- **生产环境** (`nginx.prod.conf`)：HTTPS 强制、安全加固、访问控制、HSTS、速率限制、缓存策略

## 🚀 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/wfeng0514/nginx-simulator.git
cd nginx-simulator

# 2. 安装所有依赖
npm run install:all

# 3. 启动开发模式（同时启动前后端）
npm run dev
```

- 后端 API：http://localhost:3001
- 前端界面：http://localhost:5173

## 📁 项目结构

```
nginx-simulator/
├── server/                     # Node.js + Express 后端
│   └── src/
│       ├── index.ts            # 服务端入口
│       ├── config/             # nginx 配置文件
│       │   ├── nginx.dev.conf  # 开发环境（中文注释）
│       │   └── nginx.prod.conf # 生产环境（中文注释）
│       ├── parser/             # 配置解析器
│       │   ├── lexer.ts        # 词法分析（Token 流）
│       │   ├── parser.ts       # 语法分析（递归下降 → AST）
│       │   └── types.ts        # AST 类型定义
│       ├── core/               # 核心模拟引擎
│       │   ├── matcher.ts      # Server/Location 匹配
│       │   ├── upstream.ts     # 负载均衡算法
│       │   ├── pipeline.ts     # 12 阶段请求管道
│       │   ├── simulator.ts    # 模拟器主类
│       │   └── types.ts        # 核心类型定义
│       └── routes/
│           └── api.ts          # REST API 端点
│
├── client/                     # React + Vite 前端
│   └── src/
│       ├── App.tsx             # 路由配置
│       ├── api.ts              # API 客户端封装
│       ├── pages/
│       │   ├── Dashboard.tsx   # 总览面板
│       │   ├── ConfigViewer.tsx # 配置管理
│       │   └── Simulator.tsx   # 请求模拟器
│       └── components/
│           ├── Layout.tsx      # 页面布局 + 导航
│           ├── RequestForm.tsx # 请求表单
│           ├── RoutingTrace.tsx # 路由链路可视化
│           └── UpstreamStatus.tsx # 上游服务器状态
│
└── package.json                # Monorepo 根配置
```

## 🔬 使用示例

### 模拟一个 GET 请求

1. 打开 http://localhost:5173
2. 进入「📁 配置」页面，选择 `nginx.dev.conf` 并点击「激活」
3. 进入「🔧 模拟」页面，输入：
   - Method: `GET`
   - Host: `localhost`
   - URI: `/api/users?id=1`
4. 点击「发送请求」
5. 观察右侧的响应结果和路由处理链路

### 测试不同场景

| 场景 | URI | 预期结果 |
|------|-----|----------|
| 精确匹配 | `/` | `= /` 精确匹配，返回欢迎信息 |
| 前缀优先 | `/admin/dashboard` | `^~ /admin/` 匹配，访问控制检查 |
| 正则匹配 | `/image.png` | `~ \.(png\|jpg\|gif)$` 匹配 |
| 反向代理 | `/api/users` | `proxy_pass` → upstream `dev_api_backend` → 轮询选择服务器 |
| WebSocket | `/ws/chat` | `proxy_pass` → upstream `dev_ws_backend` → 最少连接 |
| Session | `/session/login` | `proxy_pass` → upstream `dev_session_backend` → IP 哈希 |
| Rewrite | `/old-api/users` | `rewrite` → `/api/users` |
| 重定向 | `/redirect` | `return 302` → `/api/` |
| HTTPS | scheme: https | TLS 终止模拟 |
| 生产环境 | host: `example.com` | 激活生产配置后测试 |

### 测试负载均衡

多次发送 `/api/` 请求，观察上游服务器的请求分布变化。

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 后端运行时 | Node.js + Express |
| 后端语言 | TypeScript |
| 前端框架 | React 18 |
| 构建工具 | Vite 5 |
| 语言 | TypeScript（全栈） |
| 并发启动 | concurrently |

## 📝 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 全局统计信息 |
| GET | `/api/configs` | 列出所有配置文件 |
| GET | `/api/configs/:name` | 获取配置内容 |
| POST | `/api/configs/:name/activate` | 激活配置文件 |
| POST | `/api/simulate` | 执行请求模拟 |
| GET | `/api/upstreams` | 所有上游服务器状态 |
| GET | `/api/upstreams/:name` | 单个上游组详情 |
| POST | `/api/upstreams/:name/reset` | 重置上游统计 |

## 📄 License

MIT
