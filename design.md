# 写作助手 - 设计文档

## 1. 概述

本文档描述写作助手核心功能的设计：用户登录后先进入**书架**，书架以卡片形式展示其全部书籍；点击一本书进入该书的**两段式**编辑页——左侧为章节列表，右侧为章节内容编辑区。点击某章在右侧编辑，按 Ctrl+S 或空闲自动保存把章节内容持久化到数据库。

本设计在现有项目基础上扩展，保持与既有架构、代码风格和 API 约定一致：

- 后端：Cloudflare Workers 原生实现（无 Web 框架），手写路由，D1（SQLite）数据库
- 前端：Tauri 2 + Vue 3（`<script setup>`），通过 `@tauri-apps/plugin-http` 请求后端
- 统一响应格式：`{ code, message, data }`

### 目标

- 登录成功后进入书架页，展示当前用户的全部书籍，支持新建、删除、进入
- 书籍层：一个用户可有多本书，章节归属于某本书
- 选择一本书进入两段式编辑页：左侧章节列表（新建、选择、删除），右侧章节内容编辑区
- 编辑区可返回书架；支持切换到该书的其它章节
- 保存机制：手动 Ctrl+S + **空闲自动保存**（停止输入一段时间后自动触发），均在保存前用 MD5 判重
- 所有数据按用户隔离

### 非目标（本期不做）

- 富文本 / Markdown 渲染编辑器（纯文本 textarea）
- 拖拽排序、章节多层级目录
- 协作编辑、版本历史

## 2. 现状分析

### 后端现状

| 位置 | 现状 | 影响 |
| --- | --- | --- |
| `route.ts` | 仅处理 `POST /login`，其余返回 404；认证失败时返回 **HTTP 401**（与 `jsonResponse` 的"恒 200 + code"约定不一致）；`checkAuth` 已返回 `userId` 但被丢弃 | 需扩展路由、统一 401 返回方式、把 `userId` 透传给业务接口 |
| `middleware/auth.ts` | `checkAuth` 用 `where uuid=?` 查 `t_login_log`（该表本就没有 `uuid` 列，查询无法命中） | 改为**无状态验签**，不再查库，直接从 token 解析 `userId` |
| `utils/token.ts` | `checkToken` 是桩实现；`createToken` 拼接 `issuedAt@uuid@expiredAt`，字段可被客户端篡改 | 改为 **HMAC-SHA256 签名 token（JWT 风格）** 的签发/验签 |
| `AuthService.login` | 校验账号密码后返回 token，但未持久化 | 改为签发签名 token；`t_login_log` 降级为可选登录审计（不在认证路径上） |
| `response.ts` | `jsonResponse(data, code, message)` 统一封装（HTTP 恒 200），含 CORS 头 | 直接复用，所有响应都走它 |
| 数据访问 | `env.DB.prepare(sql).bind(...).first()` / `.all()` / `.run()` | 书/章节 CRUD 沿用此模式 |

> 认证采用**无状态签名 token**（见 5.5）。改造后 `checkAuth` 不再读 `t_login_log`，因此无需给该表补 `uuid` 列。

### 前端现状

| 位置 | 现状 | 影响 |
| --- | --- | --- |
| `App.vue` | 只有登录卡片 | 引入"已登录 → 主界面"的视图切换 |
| `api/http.ts` | 封装 request，未携带 Authorization；仅按 HTTP 状态判错，未处理 envelope `code===401` | 需注入 token、并对 `code===401` 触发登出 |
| `composables/useAuth.ts` | token 仅存内存 ref；`useAuth`→`api/auth`→`http` 若反向依赖 token 会成环 | token 抽到独立 `tokenStore`，避免循环依赖 |
| 路由/状态库 | 无 vue-router、无 pinia | 用条件渲染切换视图，用 composable 管理状态 |

## 3. 整体架构

```
┌─────────────────────────── 前端 (Tauri + Vue 3) ───────────────────────────┐
│  App.vue ─▶ LoginView（无 token）                                          │
│          └▶ 已登录 ─▶ BookshelfView（书架）──选书──▶ EditorView（两段式） │
│                                          │              │                   │
│                                          │      ┌───────┴────────┐          │
│                                          │      │ ChapterList │ ChapterEditor│
│                                          │      └───────┬────────┘          │
│  composables: useAuth / useBooks / useChapters         │                    │
│  api: tokenStore ◀─ http.ts ◀─ auth.ts / book.ts / chapter.ts             │
└──────────────────────────────────────────┼────────────────────────────────┘
                                             │ HTTPS  { code, message, data }
┌──────────────────────────────────────────▼────────────────────────────────┐
│                       后端 (Cloudflare Workers)                            │
│  index.ts ─▶ route.ts ─▶ checkAuth(中间件) ─▶ controller ─▶ service ─▶ D1   │
│  controller: book.ts / chapter.ts   service: BookService / ChapterService  │
│  DB: t_user / t_login_log / t_book / t_chapter                             │
└──────────────────────────────────────────────────────────────────────────┘
```

## 4. 数据模型设计

### 4.1 书籍表 `t_book`（新增迁移 `0002_book_chapter.sql`）

```sql
CREATE TABLE IF NOT EXISTS t_book (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,             -- 归属用户
  title       TEXT NOT NULL DEFAULT '未命名书',
  sort_order  INTEGER NOT NULL DEFAULT 0,   -- 书列表排序
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_user ON t_book (user_id, sort_order);
```

### 4.2 章节表 `t_chapter`（同一迁移文件）

```sql
CREATE TABLE IF NOT EXISTS t_chapter (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id      INTEGER NOT NULL,            -- 归属书
  title        TEXT NOT NULL DEFAULT '未命名章节',
  content      TEXT NOT NULL DEFAULT '',    -- 章节正文
  content_hash TEXT,                        -- 最近一次保存内容的 hash（前端计算，后端仅存储/比对）
  sort_order   INTEGER NOT NULL DEFAULT 0,  -- 书内章节排序
  create_time  DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chapter_book ON t_chapter (book_id, sort_order);
```

字段与归属说明：

- **归属链**：`t_chapter.book_id → t_book.id → t_book.user_id`。章节表不冗余存 `user_id`，越权校验通过关联书判断（见 5.6），避免冗余字段不一致。
- `content_hash`：保存时前端传入的内容 hash，后端**原样存储、原样比对，不重新计算**（Workers 的 Web Crypto 同样不支持 MD5，无需在后端算）。
- `sort_order`：书内排序，新建时取该书下最大值 +1。
- `update_time`：**SQLite 的 `DEFAULT CURRENT_TIMESTAMP` 仅在 INSERT 生效，UPDATE 不会自动更新**。因此所有 UPDATE 语句必须显式 `SET update_time = CURRENT_TIMESTAMP`。

### 4.3 `t_login_log`（无需改动）

采用无状态签名 token 后，`checkAuth` 不再查 `t_login_log`，因此**不需要给它补 `uuid` 列，也不新增迁移**。该表保留为可选的登录审计记录（`AuthService.login` 可选写入，不影响认证）。

> 本期仅一个新增迁移 `0002_book_chapter.sql`，通过 `wrangler d1 migrations apply` 应用（先本地后远端）。

## 5. 后端 API 设计

所有业务接口都经 `checkAuth` 认证，`userId` 由中间件从 token 解析得到，**不接受前端传入 userId**。统一响应体 `{ code, message, data }`，**HTTP 状态恒为 200**（含错误），业务结果由 `code` 表达。

### 5.1 接口列表

书：

| 方法 | 路径 | 说明 | 请求体 | 返回 data |
| --- | --- | --- | --- | --- |
| GET | `/books` | 当前用户的书列表 | - | `BookSummary[]` |
| POST | `/books` | 新建书 | `{ title? }` | `Book` |
| PUT | `/books/:id` | 重命名书 | `{ title }` | `Book` |
| DELETE | `/books/:id` | 删除书（级联删除其章节） | - | `{ id }` |

章节（挂在书下）：

| 方法 | 路径 | 说明 | 请求体 | 返回 data |
| --- | --- | --- | --- | --- |
| GET | `/books/:bookId/chapters` | 某书的章节列表（不含正文） | - | `ChapterSummary[]` |
| POST | `/books/:bookId/chapters` | 在书下新建章节 | `{ title? }` | `Chapter` |
| GET | `/chapters/:id` | 章节详情（含正文） | - | `Chapter` |
| PUT | `/chapters/:id` | 保存章节（Ctrl+S 触发） | `{ title, content, hash }` | `Chapter` |
| DELETE | `/chapters/:id` | 删除章节 | - | `{ id }` |

### 5.2 请求上下文 Ctx

为避免 `env`、`userId`、路由参数、请求体沿 `router → controller → service` 逐层手动传递，引入一个**每请求创建**的上下文对象 `Ctx`，把 HTTP 层相关数据收拢到一处。`Ctx` 定义在 `src/context.ts`：

```typescript
interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  method: string;
  params: Record<string, string>;   // 路由参数，如 { id } / { bookId }
  userId: number;                    // checkAuth 成功后写入
  json<T>(): Promise<T>;             // 惰性解析请求体（缓存结果）
}
```

分层约定：

- **`Ctx` 只活在 HTTP 层（route / controller）**。controller 签名统一为 `(ctx: Ctx) => Promise<Response>`，从 `ctx` 取出所需数据。
- **service 层保持纯净，不接收 `Ctx`**：controller 调用 service 时传入明确的原始参数（`env`/`db`、`userId`、数据对象），使 service 不依赖 `Request`、便于单测。

```typescript
// controller 示例
export async function saveChapter(ctx: Ctx) {
  const body = await ctx.json<SaveChapterBody>();
  const result = await chapterService.save(ctx.env, ctx.userId, Number(ctx.params.id), body);
  return jsonResponse(result);
}
```

> **Workers 注意**：`env` 由运行时按请求注入，模块作用域取不到，且跨请求复用全局有串数据风险。因此**不得**用模块级全局变量存 `env`——"每请求 new 一个 `Ctx`"正是替代全局的正确方式。

### 5.3 路由实现

保持手写风格，不引入路由库。`index.ts` 收到请求后构造 `Ctx`（填入 request/env/url/method）。`route.ts` 按 pathname 分段解析：切分 `url.pathname` 为段数组，按 `["books"]`、`["books", id]`、`["books", bookId, "chapters"]`、`["chapters", id]` 结合 `method` 匹配，把解析出的路由参数写入 `ctx.params`。登录 `POST /login`（免认证）；其余接口先 `checkAuth(ctx)`，成功后把 `userId` 写入 `ctx` 再分派到对应 controller。

### 5.4 数据结构

```typescript
interface BookSummary {
  id: number;
  title: string;
  sortOrder: number;
  updateTime: string;
}
type Book = BookSummary; // 书暂无额外详情字段，二者一致

interface ChapterSummary {
  id: number;
  bookId: number;
  title: string;
  sortOrder: number;
  updateTime: string;
}

interface Chapter extends ChapterSummary {
  content: string;
  contentHash: string | null; // 前端据此初始化 savedHash
  createTime: string;
}
```

> DB 字段为下划线命名（`book_id`、`sort_order`），service 层返回前统一转驼峰（`bookId`、`sortOrder`）。

### 5.5 认证链路：无状态签名 token（HMAC-SHA256）

采用 JWT 风格的签名 token，服务端用密钥签名、验签，**不查库**。Workers 的 Web Crypto 原生支持 HMAC-SHA256，无需第三方库。

**token 结构**（紧凑 JWT，HS256）：

```
token = base64url(header) + "." + base64url(payload) + "." + base64url(signature)
header    = { "alg": "HS256", "typ": "JWT" }
payload   = { "uid": <userId>, "iat": <签发秒>, "exp": <过期秒> }   // exp = iat + 7d
signature = HMAC_SHA256(`${b64(header)}.${b64(payload)}`, TOKEN_SECRET)
```

**密钥管理**：签名密钥 `TOKEN_SECRET` 由环境变量注入，不写进代码。

- 本地开发：`back-end/.dev.vars` 写 `TOKEN_SECRET=<随机长串>`（该文件不入库）。
- 线上：`wrangler secret put TOKEN_SECRET` 配置。
- `Env` 类型（`worker-configuration.d.ts`）新增 `TOKEN_SECRET: string`。

**实现要点**（`utils/token.ts`，因 `crypto.subtle` 为异步，函数改为 `async`）：

- `createToken(userId, env)`：构造 header/payload，`exp = now + 7*24*3600`，用 `crypto.subtle.importKey` 导入密钥、`sign("HMAC", ...)` 生成签名，拼成 token 字符串返回。
- `checkToken(token, env)`：按 `.` 拆三段 → 用同法重算签名并与第三段**做等长比较**（防篡改）→ 校验 `payload.exp * 1000 > Date.now()` → 返回 `{ success, userId: payload.uid }`；任何一步失败返回 `{ success: false }`。
- base64url 编解码：用 `TextEncoder` + `btoa`/`atob` 并做 URL-safe 替换（`+/`→`-_`、去 `=`）。

**调用链**：

- `AuthService.login()`：账号密码校验通过后 `await createToken(user.id, env)` 返回 token；可选写一条 `t_login_log` 审计（非必需）。
- `checkAuth(request, env)`：取 `Authorization: Bearer <token>` → `await checkToken(token, env)` → 成功则返回 `{ success: true, userId }`，失败返回 `{ success: false }`。**全程不访问数据库。**

**安全与权衡**：

- token 经签名，`uid`/`exp` 不可篡改（改动会导致验签失败）。
- 无状态的代价是**无法即时吊销**：登出仅清除前端 token，服务端在到期前仍认可该 token。如需强吊销，需额外维护黑名单（本期不做，见第 9 节）。

### 5.6 保存语义与 hash 判重

- **保存（PUT /chapters/:id）**：更新 `title`、`content`、`content_hash`、`update_time`，写入数据库。
- **越权校验**：先按 `chapter.id` 取出章节，经 `book_id` 关联 `t_book` 确认 `t_book.user_id === 当前 userId`；不符返回 `code=403, message="无权操作"`。书级接口同理校验 `t_book.user_id`。
- **hash 幂等兜底**：请求体带前端算好的 `hash`。后端比对该章库中的 `content_hash`：
  - 相同 → 判定无变更，**跳过写库**，直接返回当前详情（`message` 标注"无变更"）。
  - 不同或库中为空 → 正常写入，并把 `content_hash` 更新为本次 `hash`。
- 后端把 `hash` 当作**不透明字符串**处理，不关心其算法，只做等值比较。

### 5.7 错误处理与错误码

沿用 `index.ts` 的 try/catch：service 抛 `Error`，最外层 `jsonResponse(null, 500, error.message)`。约定错误码（HTTP 均 200）：

| code | 含义 | 触发 |
| --- | --- | --- |
| 200 | 成功 | 正常返回 |
| 401 | 未登录 / token 失效 | `checkAuth` 失败（**改为经 `jsonResponse` 返回，不再用 HTTP 401**） |
| 403 | 无权操作 | 书/章节不属于当前用户 |
| 404 | 资源不存在 | 书/章节 id 不存在 |
| 500 | 服务端异常 | 未预期错误 |

### 5.8 后端文件规划

```
back-end/
├── .dev.vars               # 新增：本地 TOKEN_SECRET（不入库）
├── worker-configuration.d.ts # 改：Env 增加 TOKEN_SECRET
└── src/
    ├── context.ts         # 新增：Ctx 类型与每请求构造（含 json() 惰性解析）
    ├── controller/
    │   ├── book.ts         # 新增：签名 (ctx) => Response
    │   └── chapter.ts      # 新增：签名 (ctx) => Response
    ├── service/
    │   ├── BookService.ts  # 新增：书 CRUD + 驼峰转换（接 env/userId，不接 Ctx）
    │   ├── ChapterService.ts # 新增：章节 CRUD + 归属校验 + hash 比对（不接 Ctx）
    │   └── AuthService.ts  # 改：签发签名 token（可选写审计）
    ├── middleware/auth.ts  # 改：checkAuth(ctx) 无状态验签，写入 ctx.userId
    ├── utils/token.ts      # 改：HMAC-SHA256 签发/验签（async）
    ├── response.ts         # 复用
    └── route.ts            # 改：构造/分派 Ctx、分段路由、401 走 jsonResponse
```

## 6. 前端设计

### 6.1 视图切换

不引入 vue-router。`App.vue` 维护一个简单的视图状态：token 决定登录/已登录，已登录时再由"是否选中了某本书"决定书架页还是编辑页。

```
App.vue
 ├─ 无 token                    → <LoginView>        （由现有登录卡片重构而来）
 └─ 有 token
     ├─ 未选书（currentBookId 空）→ <BookshelfView>    （书架）
     └─ 已选书                   → <EditorView>    （两段式编辑页）
```

选书即设置 `useBooks.currentId`，返回书架即清空它。

### 6.2 书架页布局（BookshelfView）

```
┌───────────────────────────────────────────────────────────┐
│ 顶栏：应用名 / 当前用户 / 退出登录                            │
├───────────────────────────────────────────────────────────┤
│  我的书架                                                    │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│  │ 书A   │  │ 书B   │  │ 书C   │  │  + 新建 │             │
│  │        │  │        │  │        │  │  书   │             │
│  └────────┘  └────────┘  └────────┘  └────────┘             │
│  （卡片：书名、更新时间；hover 显示删除；点击进入编辑页）     │
└───────────────────────────────────────────────────────────┘
```

### 6.3 编辑页布局（EditorView，两段式）

```
┌───────────────────────────────────────────────────────────┐
│ 顶栏：← 返回书架 / 当前书名 / 退出登录                        │
├────────────────┬──────────────────────────────────────────┤
│ ChapterList     │ ChapterEditor                            │
│ (本书的章节)     │ (编辑区)                                  │
│ · 第一章 ◀      │ 标题输入框                                │
│ · 第二章        │ ┌──────────────────────────────────────┐ │
│ [+ 新建]        │ │ 正文 textarea                        │ │
│                │ └──────────────────────────────────────┘ │
│                │ 保存状态：未保存 / 保存中… / 已保存        │
└────────────────┴──────────────────────────────────────────┘
```

进入编辑页时加载本书章节；选中章节才在编辑区显示内容。返回书架前若有未保存改动先 `flush()`。

### 6.4 组件划分

| 组件 | 职责 |
| --- | --- |
| `App.vue` | 按 token 与 currentBookId 渲染 LoginView / BookshelfView / EditorView |
| `views/LoginView.vue` | 登录表单（迁移现有 App.vue 的登录 UI） |
| `views/BookshelfView.vue` | 书架：卡片网格展示书籍，新建、删除、点击进入 |
| `views/EditorView.vue` | 两段式布局、顶栏（含返回书架），协调 chapters/editor |
| `components/BookCard.vue` | 单本书的卡片（书名/更新时间/删除入口） |
| `components/ChapterList.vue` | 当前书的章节列表：展示、选中、新建、删除 |
| `components/ChapterEditor.vue` | 编辑标题/正文，监听 Ctrl+S 手动保存 + 输入空闲触发自动保存，显示保存状态 |

### 6.5 token 存储（避免循环依赖）

新增 `api/tokenStore.ts`：封装 `getToken()` / `setToken()` / `clearToken()`，读写 `localStorage`。`http.ts`、`useAuth` 都依赖它，打破 `useAuth → api → http` 的潜在环。

### 6.6 状态管理（composables）

`composables/useBooks.ts`：

```typescript
function useBooks() {
  const list = ref<BookSummary[]>([]);
  const currentId = ref<number | null>(null);

  const current = computed(() => list.value.find(w => w.id === currentId.value) ?? null);

  async function loadList(): Promise<void>;          // GET /books（进入书架时加载）
  function open(id: number): void;                   // 设置 currentId → 进入编辑页
  function backToShelf(): void;                      // 清空 currentId → 返回书架（调用方先 flush 未保存内容）
  async function create(): Promise<void>;            // POST /books
  async function remove(id: number): Promise<void>;  // DELETE /books/:id（若删当前书则回书架）

  return { list, current, currentId, loadList, open, backToShelf, create, remove };
}
```

`composables/useChapters.ts`（依赖当前书 id）：

```typescript
function useChapters() {
  const list = ref<ChapterSummary[]>([]);
  const current = ref<Chapter | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const savedHash = ref<string | null>(null);                       // 上次成功保存内容的 hash
  const dirty = computed(() => currentHash() !== savedHash.value);  // 有未保存改动

  function currentHash(): string;                            // hash(JSON.stringify({ title, content }))
  async function loadList(bookId: number): Promise<void>;    // GET /books/:bookId/chapters
  async function select(id: number): Promise<void>;          // GET /chapters/:id，加载后 savedHash=contentHash
  async function create(bookId: number): Promise<void>;      // POST /books/:bookId/chapters
  async function save(): Promise<void>;                      // PUT /chapters/:id（手动/自动共用，见下）
  function scheduleAutoSave(): void;                         // 输入变更时调用，防抖排期自动保存
  async function flush(): Promise<void>;                     // 立即落盘（切换/退出前调用）
  async function remove(id: number): Promise<void>;          // DELETE /chapters/:id

  return { list, current, loading, saving, dirty, loadList, select, create, save, scheduleAutoSave, flush, remove };
}
```

`save()` 判重逻辑（手动 Ctrl+S 与自动保存共用同一函数）：

```
save():
  clearAutoSaveTimer()                    // 取消待触发的自动保存
  hash = currentHash()
  if (hash === savedHash) return          // 无变更，不发请求
  if (saving) return                      // 保存进行中，避免并发重入
  saving = true
  chapter = await api.saveChapter(id, { title, content, hash })
  savedHash = hash
  同步 current 与列表项的 title/updateTime
  saving = false
```

### 6.6.1 空闲自动保存

- 编辑器每次输入（title/content 变更）调用 `scheduleAutoSave()`：重置一个防抖定时器，延时 `AUTOSAVE_IDLE_MS`（默认 3000ms）；期间继续输入会不断顺延，**停止输入满该时长才触发** `save()`。
- 触发的自动保存复用 `save()`，因此仍有 MD5 判重与"保存中不重入"保护，不会产生无谓请求。
- **强制落盘时机**：`flush()` 在以下场景立即保存（若 `dirty`），避免丢改动：
  - 切换到其它章节 / 其它书前
  - 退出登录、关闭窗口前（监听 `beforeunload` / Tauri 关闭事件）
- Ctrl+S 走 `save()`，会同时取消当前待触发的自动保存定时器。
- 组件卸载（`onUnmounted`）时清除定时器，防止泄漏与对已切换章节的误写。

`composables/useAuth.ts` 调整：

- 登录成功后经 `tokenStore.setToken` 持久化；应用启动读取以维持登录态
- 暴露响应式 `token` 供 `App.vue` 判断视图；`logout` 调 `tokenStore.clearToken`

### 6.7 哈希算法约定

- 使用 **MD5**，引入 `spark-md5`（前端计算）。
- 计算对象固定为 `md5(JSON.stringify({ title, content }))`——用 JSON 序列化避免 title 含换行/分隔符时的歧义。
- 后端不计算 hash，仅存储与等值比较，因此算法只需前端内部自洽即可。

### 6.8 HTTP 层改造

`api/http.ts`：

- 请求前经 `tokenStore.getToken()` 取 token，非空则加 `Authorization: Bearer <token>`
- 因后端 HTTP 恒 200，保留 `res.ok` 判断真正的传输错误；解析 envelope 后：
  - `code === 401` → `tokenStore.clearToken()` 并触发回到登录页，再抛错
  - `code !== 200` → 抛出 `message`
- 新增 `api/book.ts`、`api/chapter.ts` 封装各接口，类型取自 `types/chapter.ts`

### 6.9 前端文件规划

```
front-end/src/
├── App.vue                      # 改：登录 / 书架 / 编辑页 三态切换
├── views/
│   ├── LoginView.vue            # 新增：迁移登录 UI
│   ├── BookshelfView.vue        # 新增：书架（书卡片网格）
│   └── EditorView.vue        # 新增：两段式编辑页（章节列表 + 编辑区）
├── components/
│   ├── BookCard.vue             # 新增：书架单个书卡片
│   ├── ChapterList.vue          # 新增
│   └── ChapterEditor.vue        # 新增
├── composables/
│   ├── useAuth.ts               # 改：token 持久化
│   ├── useBooks.ts              # 新增
│   └── useChapters.ts           # 新增
├── api/
│   ├── tokenStore.ts            # 新增：token 读写
│   ├── http.ts                  # 改：注入 token / 处理 code 401
│   ├── auth.ts                  # 复用
│   ├── book.ts                  # 新增
│   └── chapter.ts               # 新增
└── types/
    ├── api.ts                   # 复用
    ├── auth.ts                  # 复用
    └── chapter.ts               # 新增：Book / BookSummary / Chapter / ChapterSummary
```

依赖：`front-end` 新增 `spark-md5` 及其类型 `@types/spark-md5`。

## 7. 关键交互流程

### 7.1 登录进入书架

1. LoginView 提交账号密码 → `POST /login`
2. 后端 `AuthService.login` 校验成功 → `createToken`（HMAC 签名）→ 返回 token
3. 前端 `tokenStore.setToken`，`App.vue` 检测到 token 且 `currentBookId` 为空 → 渲染 BookshelfView
4. BookshelfView 挂载 → `useBooks.loadList()` 加载书列表，卡片网格展示

### 7.2 选书进入编辑页 → 选章 → 编辑

1. 在书架点击某本书 → `useBooks.open(bookId)` 设置 `currentId` → `App.vue` 切到 EditorView
2. EditorView 挂载 → `useChapters.loadList(bookId)`（`GET /books/:bookId/chapters`）
3. 点击章节 → `useChapters.select(id)` → `GET /chapters/:id`；后端经 work 归属校验后返回详情
4. `current` 更新，`savedHash = contentHash` → ChapterEditor 显示标题与正文
5. 点顶栏"← 返回书架"：若 `dirty` 先 `flush()`，再 `useBooks.backToShelf()` 清空 `currentId` 回到 BookshelfView

### 7.3 保存（手动 Ctrl+S / 空闲自动保存 + hash 判重）

触发方式有三种，最终都汇入同一个 `save()`：

- **手动**：ChapterEditor 捕获 Ctrl+S / Cmd+S，`preventDefault` 阻止 Webview 默认保存 → `save()`
- **自动**：输入变更 → `scheduleAutoSave()` 防抖排期，停止输入满 `AUTOSAVE_IDLE_MS` 后触发 `save()`
- **强制落盘**：切换章节/书、退出/关窗前，若 `dirty` 则 `flush()` 立即 `save()`

`save()` 内部流程：

1. 取消待触发的自动保存定时器，算 `currentHash`
2. **前端判重**：`currentHash === savedHash` → 直接返回，不发请求
3. 有变更且非保存中 → `PUT /chapters/:id`，body `{ title, content, hash }`
4. **后端幂等兜底**：校验归属后比对 `hash` 与库中 `content_hash`，相同则跳过写库，不同则写入并更新
5. 成功后 `savedHash = hash`（`dirty` 变 false），刷新 `current` 与列表项的 `title`/`updateTime`
6. 编辑器展示保存状态：编辑中(`dirty`) → "未保存" / 保存中(`saving`) → "保存中…" / 完成 → "已保存"

### 7.4 新建 / 删除

- 新建书：书架点"+ 新建书" → `POST /books` → 追加到书架卡片（可选：新建后直接 `open` 进入编辑页）
- 删除书：书架卡片上确认删除 → `DELETE /books/:id`（级联删章节）→ 从书架移除
- 新建章节：编辑页点"+ 新建" → `POST /books/:bookId/chapters` → 追加到章节列表并选中
- 删除章节：确认后 `DELETE /chapters/:id` → 从列表移除；若删的是当前章节，清空编辑区

## 8. 安全性考虑

- **越权防护**：`userId` 一律来自 `checkAuth`，不信任前端传参；书接口校验 `t_book.user_id`，章节接口经 `book_id` 关联书校验，杜绝跨用户访问。
- **认证链路**：无状态 HMAC-SHA256 签名 token，`uid`/`exp` 经签名防篡改；密钥 `TOKEN_SECRET` 经环境变量注入，不入代码库。验签不查库，`userId` 直接取自 payload。
- **口令存储**：`t_user.password` 现为明文（演示数据），生产应哈希存储（bcrypt/argon2）。本期不改，标注为已知风险。
- **传输**：前端经 Tauri HTTP 插件走 HTTPS，绕过浏览器 CORS；后端保留 CORS 头以兼容浏览器调试。

## 9. 已知限制

- **`sort_order` 竞态**：新建时"取最大值 +1"在并发下可能重复。单用户低并发可接受；实现上用单条 SQL `COALESCE(MAX(sort_order),0)+1` 减小窗口，不做严格加锁。
- **token 无法即时吊销**：无状态签名 token 在到期（7 天）前始终有效，登出仅清前端 token，服务端不感知。如需强制下线需引入黑名单/短有效期 + 刷新 token 机制（本期不做）。
- **自动保存粒度**：空闲防抖（默认 3s）触发，非实时逐字保存；极端情况下（触发前进程被杀）最后一次输入可能丢失。切换/退出前的 `flush()` 可覆盖大多数场景。
- **纯文本编辑**：暂不支持 Markdown/富文本渲染。

## 10. 实施顺序建议

1. 后端迁移：`0002_book_chapter.sql`（建 t_book / t_chapter），本地应用（`t_login_log` 无需改动）
2. 后端认证：配置 `TOKEN_SECRET`（本地 `.dev.vars`，线上 `wrangler secret`）、`Env` 类型加 `TOKEN_SECRET`；实现 `token.ts` 的 HMAC 签发/验签（async）、`AuthService.login` 签发 token、`auth.ts` 无状态验签取 userId、`route.ts` 的 401 改走 `jsonResponse`
3. 后端上下文与业务：新增 `context.ts`（`Ctx` + 每请求构造），`route.ts` 构造/分派 `Ctx`；`BookService` / `ChapterService`（含归属校验、hash 比对、显式 update_time）、`controller/book.ts` / `chapter.ts`（`(ctx) => Response`，调用 service 传原始参数）
4. 前端基础：`tokenStore`、改造 `http.ts`（注入 token / 处理 code 401）与 `useAuth`（持久化）
5. 前端数据层：引入 `spark-md5`，新增 `types/chapter.ts`、`api/book.ts`、`api/chapter.ts`、`useBooks`、`useChapters`（含 `save`/`scheduleAutoSave`/`flush` 与判重）
6. 前端界面：拆分 LoginView，新增 BookshelfView（书架 + BookCard）、EditorView（两段式：ChapterList + ChapterEditor），改造 App.vue 做登录/书架/编辑页三态切换
7. 联调全流程：登录 → 书列表 → 选书 → 章节列表 → 选章节 → 编辑 → Ctrl+S（验证无变更不发请求、有变更写库）→ 新建/删除书与章节 → 退出登录
