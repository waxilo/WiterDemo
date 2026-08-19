<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import * as writerApi from "../api/writer";
import { formatCount } from "../utils/textStats";

/**
 * 写作日历热力图（GitHub 风格）：最近 365 天每日写作字数。
 * 颜色档位：0 / <500 / <2000 / <5000 / ≥5000（UTC 日期，与后端一致）。
 */

interface DayCell {
  key: string;
  words: number;
  future: boolean;
}

const byDay = ref<Record<string, number>>({});
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await writerApi.getWritingCalendar(365);
    for (const d of data) byDay.value[d.day] = d.words;
  } catch {
    // 静默失败：日历加载失败不影响书架。
  } finally {
    loading.value = false;
  }
});

/** 最近 365 天的 52 周网格（周日开始），全部按 UTC 日期计算。 */
const grid = computed(() => {
  const weeks: DayCell[][] = [];
  const end = new Date();
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const startUtc = endUtc - 363 * 86_400_000;
  const startDay = new Date(startUtc);
  // 对齐到周日（UTC）。
  const day0 = new Date(startUtc - startDay.getUTCDay() * 86_400_000);
  const cursor = new Date(day0);
  while (cursor.getTime() <= endUtc) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = utcKey(cursor);
      const future = cursor.getTime() > endUtc;
      week.push({ key, words: byDay.value[key] ?? 0, future });
      cursor.setTime(cursor.getTime() + 86_400_000);
    }
    weeks.push(week);
  }
  return weeks;
});

function utcKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const monthLabels = computed(() => {
  // 每月第一周的位置打标签。
  const labels: { x: number; text: string }[] = [];
  let lastMonth = -1;
  grid.value.forEach((week, x) => {
    const d = new Date(`${week[0].key}T00:00:00Z`);
    const month = d.getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      labels.push({ x, text: `${d.getUTCMonth() + 1}月` });
    }
  });
  return labels;
});

const totalWords = computed(() =>
  Object.values(byDay.value).reduce((sum, w) => sum + w, 0)
);
const activeDays = computed(() => Object.values(byDay.value).filter((w) => w > 0).length);

function level(words: number): number {
  if (words <= 0) return 0;
  if (words < 500) return 1;
  if (words < 2000) return 2;
  if (words < 5000) return 3;
  return 4;
}

function fmtDay(cell: DayCell): string {
  if (cell.words === 0) return `${cell.key}：未写作`;
  return `${cell.key}：${formatCount(cell.words)} 字`;
}
</script>

<template>
  <section class="calendar-card">
    <div class="calendar-head">
      <h2>写作日历</h2>
      <div v-if="!loading" class="calendar-stats">
        <span>近一年共 <b>{{ formatCount(totalWords) }}</b> 字</span>
        <span class="dot">·</span>
        <span>写作 <b>{{ activeDays }}</b> 天</span>
      </div>
    </div>

    <div v-if="loading" class="calendar-loading">加载中…</div>
    <div v-else class="calendar-wrap">
      <div class="calendar-months">
        <span
          v-for="label in monthLabels"
          :key="label.x"
          class="calendar-month"
          :style="{ left: `${label.x * 14 + 28}px` }"
          >{{ label.text }}</span
        >
      </div>
      <div class="calendar-grid">
        <div v-for="(week, x) in grid" :key="x" class="calendar-week">
          <span
            v-for="cell in week"
            :key="cell.key"
            class="calendar-day"
            :class="[`lvl-${level(cell.words)}`, { future: cell.future }]"
            :title="fmtDay(cell)"
          ></span>
        </div>
      </div>
      <div class="calendar-legend">
        <span>少</span>
        <span class="legend-day lvl-0"></span>
        <span class="legend-day lvl-1"></span>
        <span class="legend-day lvl-2"></span>
        <span class="legend-day lvl-3"></span>
        <span class="legend-day lvl-4"></span>
        <span>多</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calendar-card {
  margin-top: 28px;
  padding: 18px 20px 14px;
  background: #fffdf8;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.calendar-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.calendar-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #4a4a44;
}

.calendar-stats {
  font-size: 12.5px;
  color: #999;
}

.calendar-stats b {
  color: #555;
  font-variant-numeric: tabular-nums;
}

.calendar-stats .dot {
  margin: 0 6px;
  color: #ccc;
}

.calendar-loading {
  padding: 20px;
  text-align: center;
  font-size: 12.5px;
  color: #b6b0a1;
}

.calendar-wrap {
  overflow-x: auto;
}

.calendar-months {
  position: relative;
  height: 16px;
  margin-left: 28px;
}

.calendar-month {
  position: absolute;
  top: 0;
  font-size: 11px;
  color: #aaa;
}

.calendar-grid {
  display: flex;
  gap: 3px;
  margin-left: 28px;
}

.calendar-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.calendar-day {
  width: 11px;
  height: 11px;
  border-radius: 2.5px;
  background: #ebedf0;
}

.calendar-day.lvl-1 {
  background: #cbe6a8;
}

.calendar-day.lvl-2 {
  background: #93cf6e;
}

.calendar-day.lvl-3 {
  background: #4daa43;
}

.calendar-day.lvl-4 {
  background: #1f7a33;
}

.calendar-day.future {
  background: transparent;
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  margin-left: 28px;
  font-size: 11px;
  color: #aaa;
}

.legend-day {
  width: 11px;
  height: 11px;
  border-radius: 2.5px;
}
</style>
