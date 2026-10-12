<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { 
  Search, 
  X, 
  CornerDownLeft
} from 'lucide-vue-next'
import type { NavSettings } from '../types/nav'

const props = defineProps<{
  settings: NavSettings
  searchQuery: string
  hasActiveCardFocus?: boolean
  focusedCardTitle?: string
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void
  (e: 'submitSearch', query: string, engine: string): void
  (e: 'navigateCards', direction: 'next' | 'prev'): void
  (e: 'selectFocusedCard'): void
  (e: 'clearFocus'): void
}>()

// 品牌原生高品质 SVG 图标
const GoogleIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#4285F4', d: 'M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z' }),
  h('path', { fill: '#34A853', d: 'M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z' }),
  h('path', { fill: '#FBBC05', d: 'M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z' }),
  h('path', { fill: '#EA4335', d: 'M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z' })
])

const BingIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0', fill: 'none' }, [
  h('path', { fill: '#008373', d: 'M5.5 3L11 5V18.5L8.5 20L5.5 18V3Z' }),
  h('path', { fill: '#00A4EF', d: 'M11 5L17.5 9L15 13L11 10.5V5Z' }),
  h('path', { fill: '#00B294', d: 'M11 10.5L15 13L17.5 11.5L13.5 17L11 18.5V10.5Z' }),
  h('path', { fill: '#0078D4', d: 'M13.5 17L17.5 14.5L18.5 16.5L14.5 19.5L13.5 17Z' })
])

const BaiduIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#2932E1', d: 'M12 11.5c-2.6 0-4.2 1.8-4.2 4.1 0 2 1.6 3.7 4.2 3.7s4.2-1.7 4.2-3.7c0-2.3-1.6-4.1-4.2-4.1z' }),
  h('circle', { fill: '#2932E1', cx: '6.8', cy: '9.2', r: '1.9' }),
  h('circle', { fill: '#2932E1', cx: '17.2', cy: '9.2', r: '1.9' }),
  h('circle', { fill: '#E10602', cx: '10.2', cy: '5.8', r: '1.9' }),
  h('circle', { fill: '#E10602', cx: '13.8', cy: '5.8', r: '1.9' })
])

const GitHubIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0', fill: '#24292F' }, [
  h('path', {
    fillRule: 'evenodd',
    clipRule: 'evenodd',
    d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
  })
])

const BilibiliIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#00A1D6', d: 'M17.8 2.8l2.2 2.2-3.2 3.2H19c1.7 0 3 1.3 3 3v8c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3v-8c0-1.7 1.3-3 3-3h2.2L4 5l2.2-2.2 4.2 4.2h3.2L17.8 2.8zM7 12c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1zm10 0c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z' })
])

const DuckDuckGoIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('circle', { cx: '12', cy: '12', r: '10', fill: '#DE5833' }),
  h('path', { fill: '#FFFFFF', d: 'M12 6c-3 0-5 2-5 5 0 1.5.8 2.8 2 3.5v2.5h6v-2.5c1.2-.7 2-2 2-3.5 0-3-2-5-5-5z' })
])

const engines = [
  { id: 'google', name: 'Google', icon: GoogleIcon, url: 'https://www.google.com/search?q=' },
  { id: 'bing', name: 'Bing', icon: BingIcon, url: 'https://www.bing.com/search?q=' },
  { id: 'baidu', name: '百度', icon: BaiduIcon, url: 'https://www.baidu.com/s?wd=' },
  { id: 'github', name: 'GitHub', icon: GitHubIcon, url: 'https://github.com/search?q=' },
  { id: 'bilibili', name: 'B站', icon: BilibiliIcon, url: 'https://search.bilibili.com/all?keyword=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', icon: DuckDuckGoIcon, url: 'https://duckduckgo.com/?q=' }
]

// 智能 Bang 快捷语法规则映射表
const BANG_MAP: Record<string, { id: string; name: string; icon: any; url: string }> = {
  'g': { id: 'google', name: 'Google', icon: GoogleIcon, url: 'https://www.google.com/search?q=' },
  'b': { id: 'bilibili', name: 'B站', icon: BilibiliIcon, url: 'https://search.bilibili.com/all?keyword=' },
  'gh': { id: 'github', name: 'GitHub', icon: GitHubIcon, url: 'https://github.com/search?q=' },
  'bd': { id: 'baidu', name: '百度', icon: BaiduIcon, url: 'https://www.baidu.com/s?wd=' },
  'bi': { id: 'bing', name: 'Bing', icon: BingIcon, url: 'https://www.bing.com/search?q=' },
  'ddg': { id: 'duckduckgo', name: 'DuckDuckGo', icon: DuckDuckGoIcon, url: 'https://duckduckgo.com/?q=' }
}

const currentEngine = ref(props.settings.searchEngine || 'google')
const showEngineMenu = ref(false)
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
let blurTimer: number | null = null

// 解析当前输入是否触发了 Bang 语法 (例如 "g vue" 或 "!b 罗翔")
const detectedBang = computed(() => {
  const text = props.searchQuery.trimStart()
  if (!text) return null

  const match = text.match(/^(!?[a-zA-Z]{1,4})\s+(.*)$/)
  if (!match) return null

  const prefix = match[1].replace(/^!/, '').toLowerCase()
  const cleanQuery = match[2]
  if (BANG_MAP[prefix]) {
    return {
      rule: BANG_MAP[prefix],
      cleanQuery,
      prefix: match[1]
    }
  }
  return null
})

const activeEngineObj = computed(() => {
  if (detectedBang.value) {
    return detectedBang.value.rule
  }
  return engines.find(e => e.id === currentEngine.value) || engines[0]
})

const isSwitcherVisible = computed(() => {
  return isFocused.value || showEngineMenu.value
})

const handleSearchSubmit = () => {
  if (props.hasActiveCardFocus) {
    emit('selectFocusedCard')
    return
  }

  if (detectedBang.value) {
    const q = detectedBang.value.cleanQuery.trim()
    if (q) {
      emit('submitSearch', q, detectedBang.value.rule.url)
    }
    return
  }

  if (!props.searchQuery.trim()) return
  emit('submitSearch', props.searchQuery.trim(), activeEngineObj.value.url)
}

const clearSearch = () => {
  emit('update:searchQuery', '')
  emit('clearFocus')
  inputRef.value?.focus()
}

const selectEngine = (id: string) => {
  currentEngine.value = id as any
  showEngineMenu.value = false
  inputRef.value?.focus()
}

const handleInputFocus = () => {
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
  isFocused.value = true
}

const handleInputBlur = () => {
  if (blurTimer) clearTimeout(blurTimer)
  blurTimer = window.setTimeout(() => {
    if (!showEngineMenu.value) {
      isFocused.value = false
    }
  }, 120)
}

const handleToggleEngineMenu = () => {
  showEngineMenu.value = !showEngineMenu.value
  if (showEngineMenu.value) {
    isFocused.value = true
  }
}

const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.engine-switcher-container') && !target.closest('input')) {
    showEngineMenu.value = false
    isFocused.value = false
  }
}

const handleInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault()
    emit('navigateCards', 'next')
  } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
    e.preventDefault()
    emit('navigateCards', 'prev')
  } else if (e.key === 'Enter') {
    e.preventDefault()
    handleSearchSubmit()
  } else if (e.key === 'Escape') {
    if (props.searchQuery) {
      clearSearch()
    }
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  if (blurTimer) clearTimeout(blurTimer)
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <header class="relative z-40 w-full max-w-4xl mx-auto px-6 sm:px-12 md:px-16 pt-7 pb-4 flex flex-col items-center select-none">
    <!-- Spotlight 极简扁平搜索栏 -->
    <div class="w-full max-w-md relative">
      <div 
        class="relative bg-white/95 rounded-2xl border transition-all duration-200 flex items-center p-1 shadow-xs"
        :class="isFocused 
          ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-md shadow-blue-500/5 bg-white' 
          : 'border-slate-200/90 hover:border-slate-300'"
      >
        <!-- 引擎切换器 / Bang 前缀动态徽章 -->
        <transition
          enter-active-class="transition-all duration-200 cubic-bezier(0.16, 1, 0.3, 1)"
          enter-from-class="max-w-0 opacity-0 -translate-x-2"
          enter-to-class="max-w-[140px] opacity-100 translate-x-0"
          leave-active-class="transition-all duration-180 ease-in"
          leave-from-class="max-w-[140px] opacity-100 translate-x-0"
          leave-to-class="max-w-0 opacity-0 -translate-x-2"
        >
          <div 
            v-if="isSwitcherVisible || detectedBang" 
            class="engine-switcher-container flex items-center flex-shrink-0 overflow-visible"
          >
            <div class="relative">
              <button
                @mousedown.prevent
                @click="handleToggleEngineMenu"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-colors select-none"
                :class="detectedBang ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-100/90 text-slate-600'"
                type="button"
                :title="detectedBang ? `Bang 快速直达: ${detectedBang.rule.name}` : '切换搜索引擎'"
              >
                <component :is="activeEngineObj.icon" class="w-3.5 h-3.5" />
                <span class="font-medium text-xs hidden sm:inline">{{ activeEngineObj.name }}</span>
                <span v-if="detectedBang" class="text-[9px] font-mono px-1 rounded bg-blue-200/70 text-blue-800">
                  {{ detectedBang.prefix }}
                </span>
              </button>

              <!-- 引擎弹出菜单 (z-50 绝对顶层) -->
              <transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform scale-95 opacity-0 -translate-y-1"
                enter-to-class="transform scale-100 opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform scale-100 opacity-100 translate-y-0"
                leave-to-class="transform scale-95 opacity-0 -translate-y-1"
              >
                <div 
                  v-if="showEngineMenu"
                  @mousedown.prevent
                  class="absolute top-full left-0 mt-2 w-36 bg-white/98 backdrop-blur-xl rounded-xl p-1 shadow-xl shadow-slate-900/12 z-50 border border-slate-200/90"
                >
                  <button
                    v-for="engine in engines"
                    :key="engine.id"
                    @mousedown.prevent
                    @click="selectEngine(engine.id)"
                    class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors"
                    :class="currentEngine === engine.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'"
                  >
                    <component :is="engine.icon" class="w-3.5 h-3.5" />
                    <span>{{ engine.name }}</span>
                  </button>
                </div>
              </transition>
            </div>

            <div class="h-4 w-px bg-slate-200/80 mx-1 flex-shrink-0"></div>
          </div>
        </transition>

        <!-- 极简搜索输入 -->
        <div class="flex-1 relative flex items-center">
          <input
            ref="inputRef"
            :value="searchQuery"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value); $emit('clearFocus')"
            @keydown="handleInputKeydown"
            type="text"
            placeholder="搜索或拼音"
            class="w-full bg-transparent px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <!-- 键盘高亮指示器 / 清空 / 搜索按钮 -->
        <div class="flex items-center gap-1 pr-1">
          <!-- 键盘高亮卡片命中快捷提示 -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-90"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-90"
          >
            <div 
              v-if="hasActiveCardFocus && focusedCardTitle"
              class="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200/60 text-[10px] text-blue-700 font-medium select-none"
              title="按 Enter 直达选中的卡片"
            >
              <CornerDownLeft class="w-2.5 h-2.5 text-blue-500" />
              <span class="max-w-[70px] truncate">{{ focusedCardTitle }}</span>
            </div>
          </transition>

          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X class="w-3.5 h-3.5" />
          </button>

          <button
            @click="handleSearchSubmit"
            class="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors active:scale-95"
            :title="hasActiveCardFocus ? '回车直达卡片' : '搜索'"
          >
            <CornerDownLeft v-if="hasActiveCardFocus" class="w-3.5 h-3.5" />
            <Search v-else class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
