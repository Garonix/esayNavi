<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  Sparkles, 
  CodeXml, 
  Palette, 
  Folder, 
  Plus
} from 'lucide-vue-next'
import type { CSSProperties } from 'vue'
import type { NavCategory, NavItem } from '../types/nav'
import NavCard from './NavCard.vue'

const props = withDefaults(defineProps<{
  category: NavCategory
  openInNewTab: boolean
  isContextMenuActive?: boolean
  isAnyContextMenuActive?: boolean
}>(), {
  isContextMenuActive: false,
  isAnyContextMenuActive: false
})

const emit = defineEmits<{
  (e: 'clickItem', item: NavItem): void
  (e: 'openContextMenu', payload: { item: NavItem; x: number; y: number; categoryId: string }): void
  (e: 'addItemToCategory', categoryId: string): void
  (e: 'dropUrlOnCategory', categoryId: string, url: string): void
  (e: 'editCategory', category: NavCategory): void
  (e: 'deleteCategory', categoryId: string): void
}>()

const isDragOver = ref(false)
const isCollapsed = ref(false)
const isHovered = ref(false)
const isRevealed = ref(false)
const isMouseInside = ref(false)

let revealTimer: number | null = null
let collapseTimer: number | null = null

const reelGridRef = ref<HTMLElement | null>(null)
const SINGLE_ROW_HEIGHT = 98
const currentHeight = ref<string>(`${SINGLE_ROW_HEIGHT}px`)

// 动态响应式列数检测 (确保第一排卡片永不误判)
const columnsCount = ref(6)

const updateColumnsCount = () => {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  if (w < 640) {
    columnsCount.value = 3
  } else if (w < 768) {
    columnsCount.value = 4
  } else if (w < 1024) {
    columnsCount.value = 5
  } else {
    columnsCount.value = 6
  }
}

// 物理高度连续插值
const updateReelHeight = () => {
  if (isCollapsed.value) {
    currentHeight.value = '0px'
    return
  }
  if (!isHovered.value) {
    currentHeight.value = `${SINGLE_ROW_HEIGHT}px`
  } else {
    if (reelGridRef.value) {
      const fullH = reelGridRef.value.scrollHeight
      currentHeight.value = `${fullH + 4}px`
    }
  }
}

// 展开逻辑 (外框先动，波浪后现)
const expandSection = () => {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  isHovered.value = true
  nextTick(updateReelHeight)

  if (revealTimer) clearTimeout(revealTimer)
  revealTimer = window.setTimeout(() => {
    isRevealed.value = true
  }, 150)
}

// 收起逻辑 (波浪先隐，外框后合)
const collapseSection = () => {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  isRevealed.value = false

  if (collapseTimer) clearTimeout(collapseTimer)
  collapseTimer = window.setTimeout(() => {
    isHovered.value = false
    nextTick(updateReelHeight)
  }, 65)
}

// 鼠标移入
const handleMouseEnter = () => {
  isMouseInside.value = true
  // 若全局存在激活的右键菜单且不属于本分类，禁止误触扩展，保持绝对静止
  if (props.isAnyContextMenuActive && !props.isContextMenuActive) {
    return
  }
  expandSection()
}

// 鼠标移出
const handleMouseLeave = () => {
  isMouseInside.value = false
  // 核心修复：若当前分类的右键菜单正在显示，绝对锁定展开，禁止收起！
  if (props.isContextMenuActive) {
    return
  }
  collapseSection()
}

// 监听当前分类的右键菜单激活状态
watch(() => props.isContextMenuActive, (isActive) => {
  if (isActive) {
    // 菜单呼出时：立即暂停并清除一切收起定时器，强制锁定完全展开状态
    if (collapseTimer) {
      clearTimeout(collapseTimer)
      collapseTimer = null
    }
    if (revealTimer) {
      clearTimeout(revealTimer)
      revealTimer = null
    }
    isHovered.value = true
    isRevealed.value = true
    nextTick(updateReelHeight)
  } else {
    // 菜单关闭后：若光标已离开分类区域，恢复平滑优雅收起
    if (!isMouseInside.value) {
      collapseSection()
    }
  }
})

// 当全局右键菜单开启或关闭时：
// 1. 若全局右键菜单打开且非本分类，立即强行冻结收拢并清空定时器，消灭一切残留位移动作；
// 2. 若全局右键菜单关闭且鼠标依然停留，平滑唤醒展开。
watch(() => props.isAnyContextMenuActive, (isAnyActive) => {
  if (isAnyActive && !props.isContextMenuActive) {
    if (collapseTimer) {
      clearTimeout(collapseTimer)
      collapseTimer = null
    }
    if (revealTimer) {
      clearTimeout(revealTimer)
      revealTimer = null
    }
    isHovered.value = false
    isRevealed.value = false
    nextTick(updateReelHeight)
  } else if (!isAnyActive && isMouseInside.value && !isHovered.value) {
    expandSection()
  }
})

// 纯向下展开的波浪级联样式算法
const getCardWaveStyle = (index: number): CSSProperties => {
  // 属于第一排的卡片：始终可见，零延迟，心流绝对稳定
  if (index < columnsCount.value) {
    return {}
  }

  // 属于第二排及后排的卡片
  const colIndex = index % columnsCount.value
  const rowIndex = Math.floor(index / columnsCount.value)

  // 向右传导延时：每列相隔 18ms，次排累加 40ms
  const waveDelay = (colIndex * 18) + (rowIndex > 1 ? (rowIndex - 1) * 40 : 0)

  if (!isRevealed.value) {
    return {
      opacity: 0,
      transform: 'translateY(6px) scale(0.98)',
      transition: 'opacity 70ms ease-out, transform 70ms ease-out',
      pointerEvents: 'none' as const
    }
  }

  return {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
    transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
    transitionDelay: `${waveDelay}ms`
  }
}

watch(() => props.category.items.length, () => {
  nextTick(updateReelHeight)
})

watch(isCollapsed, () => {
  nextTick(updateReelHeight)
})

onMounted(() => {
  updateColumnsCount()
  updateReelHeight()
  window.addEventListener('resize', () => {
    updateColumnsCount()
    updateReelHeight()
  }, { passive: true })
})

onUnmounted(() => {
  if (revealTimer) clearTimeout(revealTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
})

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
    isDragOver.value = true
  }
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  if (!e.dataTransfer) return

  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    emit('dropUrlOnCategory', props.category.id, url)
  }
}

const getCategoryIcon = (iconName?: string) => {
  switch (iconName) {
    case 'sparkles': return Sparkles
    case 'code-xml': return CodeXml
    case 'palette': return Palette
    default: return Folder
  }
}
</script>

<template>
  <section 
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    class="category-section w-full mb-4 rounded-2xl p-2.5 transition-colors duration-200 hover:bg-slate-50/50"
    :class="isDragOver ? 'bg-blue-50/70 ring-2 ring-blue-400 ring-dashed shadow-md' : ''"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- 分类头部 (纯净极简无边框) -->
    <div class="flex items-center mb-2.5 px-1 select-none">
      <div class="flex items-center gap-2 group">
        <div 
          @click="isCollapsed = !isCollapsed" 
          class="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 transition-colors hover:bg-blue-100 cursor-pointer"
          title="折叠/展开"
        >
          <component :is="getCategoryIcon(category.icon)" class="w-3.5 h-3.5" />
        </div>
        <h2 
          @click="$emit('editCategory', category)"
          class="text-xs font-semibold text-slate-800 tracking-tight hover:text-blue-600 transition-colors cursor-pointer"
          title="编辑分类"
        >
          {{ category.name }}
        </h2>
      </div>
    </div>

    <!-- 物理卷轴容器 (高度基于贝塞尔曲线展开) -->
    <div 
      class="scroll-reel-container overflow-hidden"
      :style="{ height: currentHeight }"
    >
      <!-- 舒适透气的 4~6 列自适应网格 -->
      <div
        ref="reelGridRef"
        class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 relative p-0.5"
      >
        <div
          v-for="(item, idx) in category.items"
          :key="item.id"
          class="wave-card-wrapper"
          :style="getCardWaveStyle(idx)"
        >
          <NavCard
            :item="item"
            :open-in-new-tab="openInNewTab"
            @click-item="$emit('clickItem', $event)"
            @open-context-menu="$emit('openContextMenu', { ...$event, categoryId: category.id })"
          />
        </div>

        <!-- 极简加号卡片 (图标无边框设计，同样接入向右波浪逻辑) -->
        <div
          class="wave-card-wrapper"
          :style="getCardWaveStyle(category.items.length)"
        >
          <button
            @click="$emit('addItemToCategory', category.id)"
            class="w-full h-[94px] rounded-2xl border border-transparent hover:bg-slate-100/70 text-slate-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 p-2 select-none"
          >
            <div class="w-8 h-8 rounded-full bg-slate-100/80 hover:bg-blue-50 flex items-center justify-center transition-colors">
              <Plus class="w-4 h-4 transition-transform duration-200" />
            </div>
            <span class="text-[10px] font-medium text-slate-400 transition-colors">添加</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 贝塞尔曲线硬件加速外框展开 */
.scroll-reel-container {
  transition: height 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: height;
}

.wave-card-wrapper {
  will-change: transform, opacity;
}
</style>
