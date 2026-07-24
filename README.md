# WriterDemo

一个全栈写作助手示例项目，由 **Tauri + Vue 3** 桌面客户端和 **Cloudflare Workers + D1** 后端 API 组成。登录后进入书架，点击书籍进入两段式编辑页（左侧章节列表、右侧内容编辑区），支持手动保存与空闲自动保存。

## 功能

- 账号密码登录，签发 HMAC-SHA256 无状态签名 token（7 天有效）
- 书架：展示当前用户的书籍，支持新建、删除、进入
- 编辑页：左侧章节列表（新建、切换、删除），右侧标题与正文编辑
- 进入书籍后可**双击书名**直接重命名
- 保存机制：`Ctrl+S` 手动保存 + 停止输入后空闲自动保存，保存前用 MD5 判重，避免无谓写库
- 数据按用户隔离，越权访问返回 403

## 技术栈

**前端 (`front-end/`)**
- [Tauri 2](https://tauri.app/) — 跨平台桌面应用外壳（Rust）
- [Vue 3](https://vuejs.org/) + [Vite 6](https://vitejs.dev/) + TypeScript
- `@tauri-apps/plugin-http` — 通过 Rust 后端发起 HTTP 请求，绕过浏览器 CORS 限制
- `spark-md5` — 前端计算内容 hash 用于保存判重

**后端 (`back-end/`)**
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — 边缘运行时（无 Web 框架，手写路由）
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — 基于 SQLite 的分布式数据库
- [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/) — 开发与部署工具
- TypeScript

## 目录结构

```
WriterDemo/
├── back-end/                 # Cloudflare Workers API
│   ├── migrations/           # D1 数据库迁移脚本
│   ├── src/
│   │   ├── controller/       # 请求处理（login、book、chapter）
│   │   ├── service/          # 业务逻辑（AuthService、BookService、ChapterService）
│   │   ├── middleware/       # 认证中间件（无状态验签）
│   │   ├── utils/            # token 工具（HMAC-SHA256 签发/验签）
│   │   ├── context.ts        # 每请求上下文 Ctx
│   │   ├── route.ts          # 路由分发
│   │   ├── response.ts       # 统一响应与 CORS
│   │   └── index.ts          # Worker 入口
│   └── wrangler.jsonc        # Worker / D1 配置
└── front-end/                # Tauri + Vue 桌面客户端
    ├── src/
    │   ├── api/              # HTTP 封装、tokenStore 与接口定义
    │   ├── composables/      # useAuth / useBooks / useChapters
    │   ├── views/            # LoginView / BookshelfView / EditorView
    │   ├── components/       # BookCard / ChapterList / ChapterEditor
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

### 环境变量

签名 token 需要密钥 `TOKEN_SECRET`：

- 本地开发：在 `back-end/.dev.vars` 写入 `TOKEN_SECRET=<随机长串>`（该文件不入库）
- 线上：`wrangler secret put TOKEN_SECRET`

### 数据库

表结构见 `back-end/migrations/`：

- `0001_init.sql` — 用户与登录日志表，初始化写入示例账号
- `0002_book_chapter.sql` — 书籍表 `t_book` 与章节表 `t_chapter`

初始示例账号：

| 用户名 | 密码 |
| --- | --- |
| `admin` | `123456` |
| `zhangsan` | `123456` |

### 接口约定

所有响应遵循统一信封结构，**HTTP 状态恒为 200**，业务结果由 `code` 表达：

```json
{ "code": 200, "message": "ok", "data": {} }
```

常用错误码：`401` 未登录 / token 失效，`403` 无权操作，`404` 资源不存在，`500` 服务端异常。除 `POST /login` 外，其余接口都会经过 token 认证中间件校验，`userId` 由中间件从 token 解析，不接受前端传入。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/login` | 用户名密码登录，返回 token | 否 |
| `GET` | `/books` | 当前用户的书列表 | 是 |
| `POST` | `/books` | 新建书 | 是 |
| `PUT` | `/books/:id` | 重命名书 | 是 |
| `DELETE` | `/books/:id` | 删除书（级联删除章节） | 是 |
| `GET` | `/books/:bookId/chapters` | 某书的章节列表 | 是 |
| `POST` | `/books/:bookId/chapters` | 在书下新建章节 | 是 |
| `GET` | `/chapters/:id` | 章节详情（含正文） | 是 |
| `PUT` | `/chapters/:id` | 保存章节 | 是 |
| `DELETE` | `/chapters/:id` | 删除章节 | 是 |

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

本项目为演示用途，密码以明文存储、token 无法即时吊销，**请勿直接用于生产环境**。
