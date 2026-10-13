<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { BackgroundConfig } from '../types/nav'
import { getLocalMediaUrl } from '../services/mediaStorage'

const props = defineProps<{
  config?: BackgroundConfig
  zenMode?: boolean
}>()

const activeUrl = ref<string>('')
const isLoaded = ref(false)

// 视差位移量 (GPU 合成层)
const parallaxTranslateX = ref(0)
const parallaxTranslateY = ref(0)
const scrollOffsetY = ref(0)

// 媒体源解析
const resolveSource = async () => {
  if (!props.config) {
    activeUrl.value = ''
    return
  }
  
  if (props.config.localKey) {
    const localUrl = await getLocalMediaUrl(props.config.localKey)
    if (localUrl) {
      activeUrl.value = localUrl
      return
    }
  }

  activeUrl.value = props.config.url || ''
}

watch(
  () => [props.config?.type, props.config?.url, props.config?.localKey],
  () => {
    isLoaded.value = false
    resolveSource()
  },
  { immediate: true }
)

// 视差滚动与鼠标位移
const handleScroll = () => {
  if (!props.config?.parallax || props.zenMode) {
    scrollOffsetY.value = 0
    return
  }
  scrollOffsetY.value = window.scrollY * 0.28
}

const handleMouseMove = (e: MouseEvent) => {
  if (!props.config?.parallax || props.zenMode) {
    parallaxTranslateX.value = 0
    parallaxTranslateY.value = 0
    return
  }

  const { innerWidth: w, innerHeight: h } = window
  const nx = (e.clientX - w / 2) / (w / 2)
  const ny = (e.clientY - h / 2) / (h / 2)

  parallaxTranslateX.value = -nx * 10
  parallaxTranslateY.value = -ny * 10
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
})

// 视差样式
const mediaTransformStyle = computed(() => {
  if (!props.config?.parallax || props.zenMode) {
    return { transform: 'none' }
  }
  const totalY = scrollOffsetY.value + parallaxTranslateY.value
  const totalX = parallaxTranslateX.value
  return {
    transform: `translate3d(${totalX}px, ${totalY}px, 0)`,
    willChange: 'transform',
    transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)'
  }
})

// 光学遮罩样式 (Zen 模式下柔和退隐)
const maskStyle = computed(() => {
  if (props.zenMode) {
    return {
      backgroundColor: 'rgba(248, 250, 252, 0)',
      backdropFilter: 'blur(0px)',
      WebkitBackdropFilter: 'blur(0px)'
    }
  }

  const opacity = (props.config?.opacity ?? 70) / 100
  const blur = props.config?.blur ?? 8
  return {
    backgroundColor: `rgba(248, 250, 252, ${opacity})`,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`
  }
})
</script>

<template>
  <div 
    class="fixed inset-0 overflow-hidden z-0 select-none"
    :class="zenMode ? 'pointer-events-auto' : 'pointer-events-none'"
  >
    <!-- 1. 默认纯白背景 (兼容老配置 mesh 回退为纯白) -->
    <div 
      v-if="!config || config.type === 'white' || (config.type as any) === 'mesh'"
      class="w-full h-full bg-white"
    ></div>

    <!-- 3. 自定义图片背景层 -->
    <div 
      v-else-if="config.type === 'image'"
      class="absolute -top-[10vh] -left-[5vw] w-[110vw] h-[120vh]"
      :style="mediaTransformStyle"
    >
      <img
        :src="activeUrl"
        class="w-full h-full object-cover transition-opacity duration-500"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
        @load="isLoaded = true"
        alt="background"
      />
    </div>

    <!-- 4. 光学防噪蒙层与毛玻璃层 -->
    <div 
      v-if="config && config.type === 'image' && activeUrl"
      class="absolute inset-0 transition-all duration-300 pointer-events-none"
      :style="maskStyle"
    ></div>
  </div>
</template>
