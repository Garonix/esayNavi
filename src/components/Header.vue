<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { 
  Search, 
  X, 
  CornerDownLeft,
  ExternalLink
} from 'lucide-vue-next'
import type { NavSettings } from '../types/nav'
import { resolveSearchEngines, BANG_MAP } from '../utils/searchEngines'
import { isDirectUrl, toDirectUrl } from '../utils/urlHelper'

const props = defineProps<{
  settings: NavSettings
  searchQuery: string
  hasActiveCardFocus?: boolean
  focusedCardTitle?: string
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void
  (e: 'submitSearch', query: string, engine: string): void
  (e: 'openDirectUrl', url: string): void
  (e: 'navigateCards', direction: 'next' | 'prev'): void
  (e: 'selectFocusedCard'): void
  (e: 'clearFocus'): void
}>()

const engines = computed(() => {
  const all = resolveSearchEngines(props.settings.searchEngines)
  return all.filter(e => e.enabled !== false)
})

const currentEngine = ref(props.settings.searchEngine || 'google')

// 同步设置变化
watch(() => props.settings.searchEngine, (val?: string) => {
  if (val) currentEngine.value = val
})
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
  return engines.value.find(e => e.id === currentEngine.value) || engines.value[0]
})

const isSwitcherVisible = computed(() => {
  return isFocused.value || showEngineMenu.value
})

// 解析当前输入是否为一个可直接访问的合法网址
const detectedDirectUrl = computed(() => {
  const q = props.searchQuery.trim()
  if (isDirectUrl(q)) {
    return toDirectUrl(q)
  }
  return null
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

  // 若输入的是有效网址，直接跳转打开该网址，不发起外部搜索
  if (detectedDirectUrl.value) {
    emit('openDirectUrl', detectedDirectUrl.value)
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

            <!-- 检测到直接网址直达提示 -->
            <div 
              v-else-if="detectedDirectUrl"
              class="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-[10px] text-emerald-700 font-medium select-none"
              title="按 Enter 直接访问该网址"
            >
              <ExternalLink class="w-2.5 h-2.5 text-emerald-600" />
              <span>直接访问</span>
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
            class="p-1.5 rounded-xl transition-colors active:scale-95 cursor-pointer"
            :class="detectedDirectUrl && !hasActiveCardFocus 
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600' 
              : 'bg-blue-50 hover:bg-blue-100 text-blue-600'"
            :title="hasActiveCardFocus ? '回车直达卡片' : (detectedDirectUrl ? '回车直接访问网址' : '搜索')"
          >
            <CornerDownLeft v-if="hasActiveCardFocus" class="w-3.5 h-3.5" />
            <ExternalLink v-else-if="detectedDirectUrl" class="w-3.5 h-3.5" />
            <Search v-else class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
