<script setup lang="ts">
import { ref, computed } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import type { NavItem } from '../types/nav'
import { getFallbackAvatar, getFaviconUrl } from '../utils/urlHelper'
import { getCachedIconSync, cacheIconFromImageElement } from '../services/iconCache'

const props = withDefaults(defineProps<{
  item: NavItem
  openInNewTab: boolean
  isReordering?: boolean
  isFocused?: boolean
}>(), {
  isReordering: false,
  isFocused: false
})

const emit = defineEmits<{
  (e: 'clickItem', item: NavItem): void
  (e: 'openContextMenu', payload: { item: NavItem; x: number; y: number }): void
  (e: 'startReorder', item: NavItem): void
}>()

const iconError = ref(false)
const fallback = getFallbackAvatar(props.item.title)

// 解析静态图标链接 (纯静态确定性渲染：优先内联 DataURL/SVG，次之同步本地缓存，次之显式外链，次之本地 Homelab 图标)
const displayIcon = computed(() => {
  const explicitIcon = props.item.icon?.trim()
  // 1. 若配置中本身就是内联 DataURL 或 SVG/本地资产，直接 0ms 纯静态直出
  if (explicitIcon && (explicitIcon.startsWith('data:') || explicitIcon.startsWith('/') || explicitIcon.endsWith('.svg'))) {
    return explicitIcon
  }

  // 2. 检查本地 IndexedDB 同步预热缓存 (以 item.id 或 item.url 为 key)
  const cached = (props.item.id && getCachedIconSync(props.item.id)) || (props.item.url ? getCachedIconSync(props.item.url) : null)
  if (cached) {
    return cached
  }

  // 3. 显式指定的普通外链
  if (explicitIcon) {
    return explicitIcon
  }

  // 4. 本地内置 Homelab 特征图（绝不请求外部第三方 API）
  return getFaviconUrl(props.item.url, props.item.title)
})

// 长按触发位置调整模式 (仿手机 App 长按抖动交互)
let longPressTimer: number | null = null
let isLongPressTriggered = false
let startClientX = 0
let startClientY = 0

const clearLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return // 仅限左键
  if (props.isReordering) return
  isLongPressTriggered = false
  startClientX = e.clientX
  startClientY = e.clientY

  clearLongPress()
  longPressTimer = window.setTimeout(() => {
    isLongPressTriggered = true
    emit('startReorder', props.item)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50)
    }
  }, 480)
}

const handleMouseUp = () => {
  clearLongPress()
}

const handleTouchStart = (e: TouchEvent) => {
  if (props.isReordering || e.touches.length !== 1) return
  isLongPressTriggered = false
  startClientX = e.touches[0].clientX
  startClientY = e.touches[0].clientY

  clearLongPress()
  longPressTimer = window.setTimeout(() => {
    isLongPressTriggered = true
    emit('startReorder', props.item)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50)
    }
  }, 480)
}

const handleTouchEnd = () => {
  clearLongPress()
}

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length !== 1) return
  if (longPressTimer) {
    const dx = Math.abs(e.touches[0].clientX - startClientX)
    const dy = Math.abs(e.touches[0].clientY - startClientY)
    if (dx > 8 || dy > 8) {
      clearLongPress()
    }
  }
}

const handleIconLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (!img || !props.item.id) return
  // 若成功加载且尚未缓存过，尝试自动固化存入本地 IndexedDB 缓存
  const currentSrc = img.currentSrc || img.src
  if (currentSrc && !currentSrc.startsWith('data:')) {
    if (!getCachedIconSync(props.item.id)) {
      cacheIconFromImageElement(img, props.item.id)
    }
  }
}

const handleIconError = () => {
  iconError.value = true
}

const handleClick = (e: MouseEvent) => {
  // 若刚刚触发了长按，或者当前正处于调整模式中，拦截点击跳转！
  if (isLongPressTriggered || props.isReordering) {
    e.preventDefault()
    e.stopPropagation()
    isLongPressTriggered = false
    return
  }

  emit('clickItem', props.item)
  if (props.openInNewTab) {
    window.open(props.item.url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = props.item.url
  }
}

const handleContextMenu = (e: MouseEvent) => {
  clearLongPress()
  e.preventDefault()
  e.stopPropagation()
  emit('openContextMenu', {
    item: props.item,
    x: e.clientX,
    y: e.clientY
  })
}

// 鼠标位置用于局部聚光灯高光反射 (零依赖、纯数学计算)
const cardRef = ref<HTMLElement | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)
const isHovering = ref(false)

const handleMouseMove = (e: MouseEvent) => {
  if (!cardRef.value) return
  const rect = cardRef.value.getBoundingClientRect()
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top

  if (longPressTimer) {
    const dx = Math.abs(e.clientX - startClientX)
    const dy = Math.abs(e.clientY - startClientY)
    if (dx > 8 || dy > 8) {
      clearLongPress()
    }
  }
}

const handleMouseLeave = () => {
  isHovering.value = false
  clearLongPress()
}
</script>

<template>
  <div
    ref="cardRef"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @touchstart.passive="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove.passive="handleTouchMove"
    @mouseenter="isHovering = true"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    class="glass-card shimmer-effect group relative h-[94px] p-2.5 rounded-2xl flex flex-col items-center justify-center overflow-hidden select-none transition-all duration-200"
    :class="[
      isReordering 
        ? 'cursor-grab active:cursor-grabbing ring-2 ring-blue-500/40 bg-white/95 shadow-md app-jiggle' 
        : isFocused
          ? 'cursor-pointer ring-2 ring-blue-500 bg-white shadow-lg shadow-blue-500/15 scale-[1.03] z-20'
          : 'cursor-pointer hover:bg-slate-50/50'
    ]"
    :title="item.title"
  >
    <!-- 极轻量跟随聚光灯高光 (仅反射光泽，绝不阻断心流) -->
    <div
      v-if="isHovering && !isReordering"
      class="pointer-events-none absolute -inset-px rounded-2xl opacity-100 transition-opacity duration-300"
      :style="{
        background: `radial-gradient(100px circle at ${mouseX}px ${mouseY}px, rgba(59, 130, 246, 0.09), transparent 80%)`
      }"
    ></div>

    <!-- 调整模式专属极简抓手微标 -->
    <div
      v-if="isReordering"
      class="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center pointer-events-none shadow-2xs"
    >
      <GripVertical class="w-2.5 h-2.5" />
    </div>

    <!-- 1. 高清大图标区（以图标为主，无任何生硬外边框，静态直出） -->
    <div class="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ease-out group-hover:scale-110">
      <img
        v-if="displayIcon && !iconError"
        :key="displayIcon"
        :src="displayIcon"
        :alt="item.title"
        @load="handleIconLoad"
        @error="handleIconError"
        decoding="async"
        class="w-9 h-9 object-contain drop-shadow-2xs pointer-events-none"
      />
      <!-- 无边框平滑首字母占位底座 -->
      <div 
        v-else 
        class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs pointer-events-none"
      >
        {{ fallback.letter }}
      </div>
    </div>

    <!-- 2. 精炼站点文本（以文本为辅，单行居中截断） -->
    <div class="w-full mt-2 px-1 text-center pointer-events-none">
      <span class="text-[11px] font-medium text-slate-600 truncate block group-hover:text-blue-600 transition-colors tracking-tight leading-tight">
        {{ item.title }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* 仿手机 APP 桌面图标编辑微晃动动画 */
@keyframes app-jiggle-even {
  0% { transform: rotate(-1.2deg) scale(1.01); }
  50% { transform: rotate(1.2deg) scale(1.01); }
  100% { transform: rotate(-1.2deg) scale(1.01); }
}

@keyframes app-jiggle-odd {
  0% { transform: rotate(1.2deg) scale(1.01); }
  50% { transform: rotate(1.2deg) scale(1.01); }
  100% { transform: rotate(1.2deg) scale(1.01); }
}

:deep(.app-jiggle) {
  will-change: transform;
}

:global(.wave-card-wrapper:nth-child(even) .app-jiggle) {
  animation: app-jiggle-even 0.22s infinite ease-in-out;
}

:global(.wave-card-wrapper:nth-child(odd) .app-jiggle) {
  animation: app-jiggle-odd 0.25s infinite ease-in-out;
}

:global(.wave-card-wrapper .app-jiggle:active) {
  animation: none !important;
  transform: scale(1.05) translateY(-2px) !important;
  box-shadow: 0 16px 32px -4px rgba(59, 130, 246, 0.28) !important;
  z-index: 40 !important;
}
</style>
