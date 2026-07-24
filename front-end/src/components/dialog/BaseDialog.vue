<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";

/**
 * 所有弹窗的基础组件：统一遮罩、毛玻璃、居中、开合动画、ESC / 点击遮罩关闭。
 * 未来的 InputDialog / RenameDialog / AlertDialog 等都基于它，
 * 保证整个项目弹窗的圆角、阴影、动画、遮罩完全一致。
 */
const props = withDefaults(
  defineProps<{
    /** 是否可见 */
    visible: boolean;
    /** 点击遮罩是否关闭，默认 true */
    closeOnMask?: boolean;
    /** 按 ESC 是否关闭，默认 true */
    closeOnEsc?: boolean;
  }>(),
  {
    closeOnMask: true,
    closeOnEsc: true,
  }
);

const emit = defineEmits<{ (e: "close"): void }>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.visible && props.closeOnEsc) {
    e.stopPropagation();
    emit("close");
  }
}

function onMaskClick() {
  if (props.closeOnMask) emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-mask" @click.self="onMaskClick">
        <div class="dialog-panel" role="dialog" aria-modal="true">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.dialog-panel {
  width: 420px;
  max-width: min(480px, calc(100vw - 40px));
  padding: 28px;
  background: #fffdf8;
  border-radius: 16px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.12);
}

/* ---- 开合动画：遮罩淡入，面板 scale(.96)->scale(1)，180ms ---- */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 180ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog-panel,
.dialog-leave-active .dialog-panel {
  transition: transform 180ms ease;
}

.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  transform: scale(0.96);
}
</style>
