<script setup lang="ts">
import BaseDialog from "./dialog/BaseDialog.vue";

/**
 * MCP 接入教程弹层：教用户把写作助手接入外部 AI（Claude Desktop / Cursor）。
 * 内容静态，从书架页"AI 接入"入口打开。
 */
const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <BaseDialog :visible="true" :close-on-mask="false" @close="emit('close')">
    <div class="guide">
      <h3 class="guide-title">🤖 AI 接入（MCP）</h3>
      <p class="guide-intro">
        通过 MCP 协议，让 <b>Claude Desktop / Cursor / Claude Code</b> 等 AI
        客户端直接读写你的书——AI 可以帮你创建设定、润色正文、全书搜索。
      </p>

      <h4 class="guide-step">① 安装（在电脑终端执行）</h4>
      <pre class="guide-code">npm install -g writer-demo-mcp</pre>
      <p class="guide-note">不想全局安装也可以，后面的配置命令改为
        <code>npx -y writer-demo-mcp</code> 即可。</p>

      <h4 class="guide-step">② 登录账号</h4>
      <pre class="guide-code">writer-demo-mcp login</pre>
      <p class="guide-note">输入写作助手的账号密码，凭证保存在
        <code>~/.writer-mcp.json</code>（仅本人可读）。</p>

      <h4 class="guide-step">③ 配置你的 AI 客户端</h4>

      <p class="guide-client">Claude Desktop</p>
      <p class="guide-note">
        菜单 → Settings → Developer → Edit Config，在
        <code>claude_desktop_config.json</code> 中加入：
      </p>
      <pre class="guide-code">{ "mcpServers": {
    "writer-demo": {
      "command": "writer-demo-mcp",
      "args": []
    }
} }</pre>

      <p class="guide-client">Cursor</p>
      <p class="guide-note">Settings → MCP → Add new MCP server → command 类型：</p>
      <pre class="guide-code">command: writer-demo-mcp
args: （留空）</pre>

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
  max-height: 70vh;
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
  margin: 10px 0 4px;
  font-size: 13.5px;
  font-weight: 600;
  color: #3a3a3a;
}

.guide-client {
  margin: 8px 0 2px;
  font-size: 12.5px;
  font-weight: 600;
  color: #6b7a9c;
}

.guide-code {
  box-sizing: border-box;
  margin: 4px 0;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e8eaf0;
  background: #2b2f38;
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre;
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
