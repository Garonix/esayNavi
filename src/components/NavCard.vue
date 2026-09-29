<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { NavItem } from '../types/nav'
import { getFallbackAvatar, getFaviconUrl } from '../utils/urlHelper'
import { getCachedIcon, cacheIconFromImageElement } from '../services/iconCache'

const props = defineProps<{
  item: NavItem
  openInNewTab: boolean
}>()

const emit = defineEmits<{
  (e: 'clickItem', item: NavItem): void
  (e: 'openContextMenu', payload: { item: NavItem; x: number; y: number }): void
}>()

const iconError = ref(false)
const fallback = getFallbackAvatar(props.item.title)
const cachedIcon = ref<string | null>(null)

// 解析原始图标 URL
const targetIcon = computed(() => {
  if (props.item.icon && props.item.icon.trim()) {
    return props.item.icon.trim()
  }
  return getFaviconUrl(props.item.url, props.item.title)
})

// 最终呈现的图标 (优先使用本地 IndexedDB 缓存的 DataURL)
const activeDisplayIcon = computed(() => {
  return cachedIcon.value || targetIcon.value
})

const checkIconCache = async () => {
  const iconUrl = targetIcon.value
  if (!iconUrl) return
  if (iconUrl.startsWith('data:')) {
    cachedIcon.value = iconUrl
    return
  }
  const cached = await getCachedIcon(iconUrl)
  if (cached) {
    cachedIcon.value = cached
  }
}

watch(
  () => [props.item.icon, props.item.url, props.item.title],
  () => {
    iconError.value = false
    cachedIcon.value = null
    checkIconCache()
  },
  { immediate: true }
)

const handleIconError = () => {
  if (cachedIcon.value) {
    // 缓存数据异常或失效时，平滑回退至原始 URL
    cachedIcon.value = null
  } else {
    // 原始 URL 确实无法访问时才降级为首字母底座
    iconError.value = true
  }
}

const handleImageLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  const originalUrl = targetIcon.value
  if (originalUrl && !cachedIcon.value && !originalUrl.startsWith('data:')) {
    cacheIconFromImageElement(img, originalUrl)
  }
}

const handleClick = () => {
  emit('clickItem', props.item)
  if (props.openInNewTab) {
    window.open(props.item.url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = props.item.url
  }
}

const handleContextMenu = (e: MouseEvent) => {
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
}
</script>

<template>
  <div
    ref="cardRef"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @mousemove="handleMouseMove"
    class="glass-card shimmer-effect group relative h-[94px] p-2.5 rounded-2xl cursor-pointer flex flex-col items-center justify-center overflow-hidden select-none"
    :title="item.title"
  >
    <!-- 极轻量跟随聚光灯高光 (仅反射光泽，绝不阻断心流) -->
    <div
      v-if="isHovering"
      class="pointer-events-none absolute -inset-px rounded-2xl opacity-100 transition-opacity duration-300"
      :style="{
        background: `radial-gradient(100px circle at ${mouseX}px ${mouseY}px, rgba(59, 130, 246, 0.09), transparent 80%)`
      }"
    ></div>


    <!-- 1. 高清大图标区（以图标为主，无任何生硬外边框） -->
    <div class="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-transform duration-200 ease-out group-hover:scale-110">
      <img
        v-if="activeDisplayIcon && !iconError"
        :key="activeDisplayIcon"
        :src="activeDisplayIcon"
        :alt="item.title"
        @load="handleImageLoad"
        @error="handleIconError"
        class="w-9 h-9 object-contain drop-shadow-2xs"
        loading="lazy"
      />
      <!-- 无边框平滑首字母占位底座 -->
      <div 
        v-else 
        class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs"
      >
        {{ fallback.letter }}
      </div>
    </div>

    <!-- 2. 精炼站点文本（以文本为辅，单行居中截断） -->
    <div class="w-full mt-2 px-1 text-center">
      <span class="text-[11px] font-medium text-slate-600 truncate block group-hover:text-blue-600 transition-colors tracking-tight leading-tight">
        {{ item.title }}
      </span>
    </div>
  </div>
</template>
