<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CornerDownLeft } from 'lucide-vue-next'
import { resolveSearchEngines, type SearchEngineItem } from '../utils/searchEngines'
import type { SearchEngineItemConfig } from '../types/nav'

const props = defineProps<{
  show: boolean
  searchQuery: string
  activeEngineId?: string
  customEngines?: SearchEngineItemConfig[]
}>()

const emit = defineEmits<{
  (e: 'search', query: string, engineUrl: string): void
}>()

const isRevealed = ref(false)

// 仅呈现启用的搜索引擎（响应用户自定义偏好）
const displayEngines = computed<SearchEngineItem[]>(() => {
  const all = resolveSearchEngines(props.customEngines)
  return all.filter(e => e.enabled !== false)
})

watch(
  () => props.show,
  (val) => {
    if (val) {
      // 微小微任务延迟，确保 DOM 挂载后波浪级联优雅展开
      requestAnimationFrame(() => {
        isRevealed.value = true
      })
    } else {
      isRevealed.value = false
    }
  },
  { immediate: true }
)

const handleSelectEngine = (engine: SearchEngineItem) => {
  if (!props.searchQuery.trim()) return
  emit('search', props.searchQuery.trim(), engine.url)
}
</script>

<template>
  <div 
    v-if="show"
    class="empty-reel-wrapper w-full max-w-2xl mx-auto py-6 select-none"
  >
    <!-- 物理卷轴容器 (基于贝塞尔曲线展开) -->
    <div 
      class="scroll-reel-box overflow-hidden rounded-2xl px-4 py-3 flex flex-col items-center"
      :class="isRevealed ? 'reel-open' : 'reel-closed'"
    >
      <!-- 引擎横向画卷胶囊流 (波浪级联延时展开) -->
      <div class="flex items-center justify-center flex-wrap gap-2.5 w-full">
        <button
          v-for="(engine, idx) in displayEngines"
          :key="engine.id"
          @click="handleSelectEngine(engine)"
          class="wave-capsule group relative flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs backdrop-blur-md"
          :class="[
            engine.id === activeEngineId 
              ? 'bg-blue-50/90 border-blue-200 text-blue-700 font-semibold ring-2 ring-blue-500/10 shadow-xs' 
              : 'bg-white/85 hover:bg-white border-slate-200/80 hover:border-blue-400 text-slate-700 hover:text-blue-600'
          ]"
          :style="{
            opacity: isRevealed ? 1 : 0,
            transform: isRevealed ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
            transitionDelay: isRevealed ? `${idx * 28}ms` : '0ms'
          }"
          :title="engine.name"
        >
          <component 
            :is="engine.icon" 
            class="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" 
          />
          <span>{{ engine.name }}</span>

          <!-- 默认主引擎显示回车快捷徽章 -->
          <span 
            v-if="engine.id === activeEngineId"
            class="flex items-center text-[10px] text-blue-500/80 font-mono pl-0.5"
            title="默认回车引擎"
          >
            <CornerDownLeft class="w-2.5 h-2.5" />
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 贝塞尔曲线硬件加速外框展开与收起 */
.scroll-reel-box {
  transition: opacity 0.26s cubic-bezier(0.16, 1, 0.3, 1), 
              transform 0.26s cubic-bezier(0.16, 1, 0.3, 1),
              max-height 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform, max-height;
}

.reel-open {
  opacity: 1;
  max-height: 220px;
  transform: translateY(0);
}

.reel-closed {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
  pointer-events: none;
}

/* 胶囊硬件加速波浪级联 */
.wave-capsule {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              background-color 0.15s ease,
              border-color 0.15s ease,
              color 0.15s ease,
              box-shadow 0.15s ease;
  will-change: opacity, transform;
}
</style>
