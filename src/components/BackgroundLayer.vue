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
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// 视差位移量 (GPU 合成层)
const parallaxTranslateX = ref(0)
const parallaxTranslateY = ref(0)
const scrollOffsetY = ref(0)

// 鼠标位置 (供粒子微画布与视差共用)
const mousePos = ref({ x: -9999, y: -9999 })

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
    if (props.config?.type === 'particles') {
      initParticleCanvas()
    }
  },
  { immediate: true }
)

// 视差滚动与鼠标微移
const handleScroll = () => {
  if (!props.config?.parallax || props.zenMode) {
    scrollOffsetY.value = 0
    return
  }
  scrollOffsetY.value = window.scrollY * 0.28
}

const handleMouseMove = (e: MouseEvent) => {
  mousePos.value = { x: e.clientX, y: e.clientY }

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

// 节能机制
const handleVisibilityChange = () => {
  if (document.hidden) {
    videoRef.value?.pause()
    stopParticleAnimation()
  } else {
    videoRef.value?.play().catch(() => {})
    if (props.config?.type === 'particles') {
      startParticleAnimation()
    }
  }
}

// ----------------------------------------------------
// 原生星河微粒（Interactive Particles）画布引擎
// ----------------------------------------------------
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  alpha: number
}

let particles: Particle[] = []
let particleAnimId: number | null = null
let canvasCtx: CanvasRenderingContext2D | null = null

const initParticleCanvas = () => {
  if (typeof window === 'undefined') return
  setTimeout(() => {
    const canvas = canvasRef.value
    if (!canvas) return
    canvasCtx = canvas.getContext('2d')
    resizeCanvas()
    createParticles()
    startParticleAnimation()
  }, 50)
}

const resizeCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  if (canvasCtx) {
    canvasCtx.scale(dpr, dpr)
  }
}

const createParticles = () => {
  const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 14000))
  particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      baseRadius: Math.random() * 1.8 + 1.2,
      alpha: Math.random() * 0.4 + 0.3
    })
  }
}

const startParticleAnimation = () => {
  if (particleAnimId) cancelAnimationFrame(particleAnimId)
  
  const render = () => {
    const canvas = canvasRef.value
    if (!canvas || !canvasCtx) return

    const w = window.innerWidth
    const h = window.innerHeight
    canvasCtx.clearRect(0, 0, w, h)

    const mx = mousePos.value.x
    const my = mousePos.value.y

    // 粒子连线 (距离 < 120px)
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i]
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j]
        const dx = p1.x - p2.x
        const dy = p1.y - p2.y
        const dist = Math.hypot(dx, dy)
        if (dist < 115) {
          const lineAlpha = (1 - dist / 115) * 0.22
          canvasCtx.strokeStyle = `rgba(59, 130, 246, ${lineAlpha})`
          canvasCtx.lineWidth = 0.8
          canvasCtx.beginPath()
          canvasCtx.moveTo(p1.x, p1.y)
          canvasCtx.lineTo(p2.x, p2.y)
          canvasCtx.stroke()
        }
      }
    }

    // 更新与绘制每个微粒
    for (const p of particles) {
      // 鼠标斥力微交互 (半径 130px)
      const mdx = p.x - mx
      const mdy = p.y - my
      const mdist = Math.hypot(mdx, mdy)
      if (mdist < 130 && mdist > 0) {
        const force = (130 - mdist) / 130
        p.x += (mdx / mdist) * force * 3
        p.y += (mdy / mdist) * force * 3
      }

      p.x += p.vx
      p.y += p.vy

      // 视窗环形循环边界
      if (p.x < 0) p.x = w
      else if (p.x > w) p.x = 0
      if (p.y < 0) p.y = h
      else if (p.y > h) p.y = 0

      // 绘制粒子
      canvasCtx.fillStyle = `rgba(37, 99, 235, ${p.alpha})`
      canvasCtx.beginPath()
      canvasCtx.arc(p.x, p.y, p.baseRadius, 0, Math.PI * 2)
      canvasCtx.fill()
    }

    particleAnimId = requestAnimationFrame(render)
  }

  particleAnimId = requestAnimationFrame(render)
}

const stopParticleAnimation = () => {
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId)
    particleAnimId = null
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
  window.addEventListener('resize', resizeCanvas, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (props.config?.type === 'particles') {
    initParticleCanvas()
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('resize', resizeCanvas)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopParticleAnimation()
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

// 光学遮罩样式 (Zen 模式下柔和退隐为 0)
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
    <!-- 1. 默认纯白背景 (纯净通透，无任何视觉噪音) -->
    <div 
      v-if="!config || config.type === 'white'"
      class="w-full h-full bg-white"
    ></div>

    <!-- 2. 流光环境极光与微点阵 (设置中选择 mesh 时展示) -->
    <div 
      v-else-if="config.type === 'mesh'"
      class="aurora-bg"
    >
      <!-- 精致工程点阵底纹 -->
      <div class="absolute inset-0 bg-grid-pattern opacity-60"></div>
      <!-- 三层自适应深呼吸极光晕 -->
      <div class="aurora-blob aurora-blob-1"></div>
      <div class="aurora-blob aurora-blob-2"></div>
      <div class="aurora-blob aurora-blob-3"></div>
    </div>

    <!-- 2. 原生星河微粒 (Interactive Particles 微画布) -->
    <canvas
      v-else-if="config.type === 'particles'"
      ref="canvasRef"
      class="w-full h-full block"
    ></canvas>

    <!-- 3. 富媒体背景层 (留出 15% 尺寸余量供平滑视差晃动) -->
    <div 
      v-else 
      class="absolute -top-[10vh] -left-[5vw] w-[110vw] h-[120vh]"
      :style="mediaTransformStyle"
    >
      <!-- 图片 / 动图 (JPG / PNG / WebP / GIF / APNG) -->
      <img
        v-if="config.type === 'image'"
        :src="activeUrl"
        class="w-full h-full object-cover transition-opacity duration-500"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
        @load="isLoaded = true"
        alt="background"
      />

      <!-- 循环微视频 (MP4 / WebM) -->
      <video
        v-else-if="config.type === 'video'"
        ref="videoRef"
        :src="activeUrl"
        class="w-full h-full object-cover transition-opacity duration-500"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
        autoplay
        loop
        muted
        playsinline
        @loadeddata="isLoaded = true"
      ></video>
    </div>

    <!-- 4. 光学防噪蒙层与毛玻璃层 (保护卡片对比度，Zen模式平滑淡出) -->
    <div 
      v-if="config && config.type !== 'mesh' && (config.type === 'particles' || activeUrl)"
      class="absolute inset-0 transition-all duration-300 pointer-events-none"
      :style="maskStyle"
    ></div>
  </div>
</template>
