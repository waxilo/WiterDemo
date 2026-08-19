<script setup lang="ts">
import BaseDialog from "./dialog/BaseDialog.vue";
import CodeBlock from "./CodeBlock.vue";

/**
 * MCP 接入教程弹层：教用户把写作助手接入外部 AI（Claude Desktop / Cursor）。
 * 内容静态，从顶部栏"AI 接入"入口打开。
 */
const emit = defineEmits<{ (e: "close"): void }>();

// npx 免安装：每次运行自动拉取 npm 最新版，安装与更新同一个命令。
const INSTALL_CODE = "npx -y writer-demo-mcp";
const LOGIN_CODE = "npx -y writer-demo-mcp login";
const CLAUDE_CONFIG = `{
  "mcpServers": {
    "writer-demo": {
      "command": "npx",
      "args": ["-y", "writer-demo-mcp"]
    }
  }
}`;
const CURSOR_CONFIG = `command: npx
args: -y writer-demo-mcp`;
</script>

<template>
  <BaseDialog
    :visible="true"
    :close-on-mask="false"
    :panel-width="680"
    @close="emit('close')"
  >
    <div class="guide">
      <h3 class="guide-title">🤖 AI 接入（MCP）</h3>
      <p class="guide-intro">
        通过 MCP 协议，让 <b>Claude Desktop / Cursor / Claude Code</b> 等 AI
        客户端直接读写你的书——AI 可以帮你创建设定、润色正文、全书搜索。
      </p>

      <h4 class="guide-step">① 无需安装，直接运行（自动拉取最新版）</h4>
      <CodeBlock :code="INSTALL_CODE" single />
      <p class="guide-note">
        用 <code>npx</code> 每次运行都会自动检查并拉取 npm 最新版本——<b>安装和更新
        是同一个命令</b>，以后发布新版本无需手动升级。
      </p>

      <h4 class="guide-step">② 登录账号（同样用 npx）</h4>
      <CodeBlock :code="LOGIN_CODE" single />
      <p class="guide-note">输入写作助手的账号密码，凭证保存在
        <code>~/.writer-mcp.json</code>（仅本人可读）。</p>

      <h4 class="guide-step">③ 配置你的 AI 客户端</h4>

      <p class="guide-client">Claude Desktop</p>
      <p class="guide-note">
        菜单 → Settings → Developer → Edit Config，在
        <code>claude_desktop_config.json</code> 中加入：
      </p>
      <CodeBlock :code="CLAUDE_CONFIG" />

      <p class="guide-client">Cursor</p>
      <p class="guide-note">Settings → MCP → Add new MCP server → command 类型：</p>
      <CodeBlock :code="CURSOR_CONFIG" />

      <h4 class="guide-step">④ 开始使用</h4>
      <p class="guide-note">
        重启客户端后，AI 就能：列出书籍与章节 · 读取/修改正文 · 新建
        人物/地点/设定 · 全书搜索。示例提问：<i>「看看我的书有哪些章节」
        「为第 3 章新增一个叫林晚的角色设定」「把全书中的“旧名字”改成
        “新名字”」</i>
      </p>

      <h4 class="guide-step">⚠️ 注意事项</h4>
      <ul class="guide-warn">
        <li>AI 执行<b>写操作</b>（修改正文/设定）时，按单会话策略网页端会被下线，重新登录即可</li>
        <li>凭证含登录令牌（30 天有效），请勿分享 <code>~/.writer-mcp.json</code></li>
        <li>修改正文是整体替换：AI 会先读取再修改，服务端自动处理版本冲突</li>
      </ul>

      <div class="guide-actions">
        <button class="guide-close" @click="emit('close')">知道了</button>
      </div>
    </div>
  </BaseDialog>
</template>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 72vh;
  overflow-y: auto;
}

.guide-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: #2a2a2a;
}

.guide-intro {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #555;
}

.guide-step {
  margin: 12px 0 4px;
  font-size: 13.5px;
  font-weight: 600;
  color: #3a3a3a;
}

.guide-client {
  margin: 10px 0 2px;
  font-size: 12.5px;
  font-weight: 600;
  color: #6b7a9c;
}

.guide-note {
  margin: 2px 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #888;
}

.guide-note code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: #6b7a9c;
  background: rgba(79, 110, 247, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
}

.guide-warn {
  margin: 2px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.8;
  color: #a07a3a;
}

.guide-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.guide-close {
  padding: 7px 20px;
  font-size: 13px;
  color: #fff;
  background: #4f6ef7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.guide-close:hover {
  background: #3f5de0;
}
</style>
