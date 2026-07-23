# WriterDemo

一个全栈示例项目，由 **Tauri + Vue 3** 桌面客户端和 **Cloudflare Workers + D1** 后端 API 组成，演示了从登录认证到前后端通信的完整流程。

## 技术栈

**前端 (`front-end/`)**
- [Tauri 2](https://tauri.app/) — 跨平台桌面应用外壳（Rust）
- [Vue 3](https://vuejs.org/) + [Vite 6](https://vitejs.dev/) + TypeScript
- `@tauri-apps/plugin-http` — 通过 Rust 后端发起 HTTP 请求，绕过浏览器 CORS 限制

**后端 (`back-end/`)**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — 边缘运行时
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — 基于 SQLite 的分布式数据库
- [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/) — 开发与部署工具
- TypeScript

## 目录结构

```
WriterDemo/
├── back-end/                 # Cloudflare Workers API
│   ├── migrations/           # D1 数据库迁移脚本
│   ├── src/
│   │   ├── controller/       # 请求处理（login、user）
│   │   ├── service/          # 业务逻辑（AuthService、UserService）
│   │   ├── middleware/       # 认证中间件
│   │   ├── utils/            # token 工具
│   │   ├── route.ts          # 路由分发
│   │   ├── response.ts       # 统一响应与 CORS
│   │   └── index.ts          # Worker 入口
│   └── wrangler.jsonc        # Worker / D1 配置
└── front-end/                # Tauri + Vue 桌面客户端
    ├── src/
    │   ├── api/              # HTTP 封装与接口定义
    │   ├── composables/      # useAuth 等组合式函数
    │   ├── config/           # API 地址等常量
    │   └── types/            # TypeScript 类型
    └── src-tauri/            # Tauri (Rust) 工程
```

## 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)（构建 Tauri 客户端所需）
- [Cloudflare 账号](https://dash.cloudflare.com/) 与 Wrangler 登录（部署后端所需）

## 后端

```bash
cd back-end
npm install

# 本地执行数据库迁移
npm run db:migrate:local

# 启动本地开发服务器（wrangler dev）
npm run dev

# 部署到 Cloudflare
npm run db:migrate:remote
npm run deploy
```

数据库表结构见 `back-end/migrations/0001_init.sql`，初始化时会写入两个示例账号：

| 用户名 | 密码 |
| --- | --- |
| `admin` | `123456` |
| `zhangsan` | `123456` |

### 接口约定

所有响应遵循统一信封结构：

```json
{ "code": 200, "message": "ok", "data": {} }
```

`code` 为 `200` 表示成功，`401` 表示未认证。除 `POST /login` 外，其余接口都会经过 token 认证中间件校验。

| 方法 | 路径 | 说明 | 是否需要认证 |
| --- | --- | --- | --- |
| `POST` | `/login` | 用户名密码登录，返回 token | 否 |

## 前端

前端默认请求的 API 地址配置在 `front-end/src/config/index.ts`，请按需修改（本地开发通常指向 `wrangler dev` 输出的地址）。

```bash
cd front-end
npm install

# 浏览器中运行 Vite 开发服务器
npm run dev

# 以桌面应用形式运行（Tauri 开发模式）
npm run tauri dev

# 构建桌面安装包
npm run tauri build
```

## 说明

本项目为演示用途，密码以明文存储、token 校验为简化实现，**请勿直接用于生产环境**。
