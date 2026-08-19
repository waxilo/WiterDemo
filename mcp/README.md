# writer-demo-mcp

WriterDemo 写作助手 MCP server：让外部 AI（Claude Desktop、Cursor、Claude Code
等支持 MCP 的客户端）直接读写写作项目的**章节正文**与**设定资料库**——AI 可以
创建人物/地点/设定条目、修改章节内容、全书搜索等。数据与网页端完全一致
（同一套 Cloudflare API）。

## 安装

```bash
# 全局安装（之后任何 MCP 客户端都能用）
npm install -g writer-demo-mcp

# 或临时运行（npx 自动下载）
npx -y writer-demo-mcp
```

首次使用先登录（凭证存 `~/.writer-mcp.json`，600 权限）：

```bash
writer-demo-mcp login
# 或：npx -y writer-demo-mcp login
```

> 环境变量可覆盖：`WRITER_MCP_CONFIG`（凭证路径）、`WRITER_API_BASE`（API 地址）。

## 工具清单

| 工具 | 说明 |
|---|---|
| `list_books` | 列出书籍 |
| `list_chapters` / `read_chapter` | 章节列表 / 读全文 |
| `create_chapter` / `update_chapter` / `delete_chapter` | 新建 / 修改 / 删除章节 |
| `search_chapters` | 全书关键字搜索（按章匹配数） |
| `list_entries` / `read_entry` | 设定条目列表（人物/地点/设定）/ 读条目 |
| `create_entry` / `update_entry` / `delete_entry` | 设定条目增改删 |

## 快速开始

```bash
cd mcp
npm install
npm run login        # 输入账号密码，凭证存到 ~/.writer-mcp.json（600 权限）
```

> 换环境变量可覆盖：`WRITER_MCP_CONFIG`（凭证路径）、`WRITER_API_BASE`（API 地址）。

## 接入 Claude Desktop

编辑 `claude_desktop_config.json`（Claude 菜单 → Settings → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "writer-demo": {
      "command": "npx",
      "args": ["-y", "writer-demo-mcp"]
    }
  }
}
```

重启 Claude Desktop 后即可让 AI"查看我的书、新建一个人物设定、把第 3 章某个名字全局替换"等。

## 接入 Cursor

Cursor Settings → MCP → Add new MCP server → 选择 `command` 类型：

```
command: npx
args: -y writer-demo-mcp
```

## 接入 Claude Code（CLI）

```bash
claude mcp add writer-demo -- npx -y writer-demo-mcp
```

## 注意事项

1. **凭证安全**：`~/.writer-mcp.json` 含登录令牌（refresh token 30 天有效），
   请勿分享或提交该文件。删除它即可让 MCP 失效。
2. **单活跃会话**：应用采用"单会话抢占"——AI 执行**写操作**（修改章节/设定）时，
   网页端会被下线（重新登录即可）。只读操作不影响网页端。
3. **token 自动续期**：server 运行期间 access token 过期会自动刷新，无需重新登录；
   只有 refresh token 也失效时才需要重跑 `npm run login`。
4. **修改正文是整体替换**：`update_chapter` 的 `content` 是全文覆盖语义；
   AI 客户端应先用 `read_chapter` 读取再修改（server 已自动处理版本冲突）。
5. 标题语法：正文中行首 `# `（1-6 个 #）会被渲染为章节标题层级。
