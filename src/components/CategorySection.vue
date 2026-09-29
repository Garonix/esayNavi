<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, TransitionGroup } from 'vue'
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
import { 
  activeDraggedCard, 
  dragHoverTarget,
  setDraggedCard, 
  getDraggedCard,
  setDragHoverTarget,
  getDragHoverTarget,
  clearDragState
} from '../services/dragState'

export interface DisplayCard {
  id: string
  item: NavItem
  isGhost: boolean
}

const props = withDefaults(defineProps<{
  category: NavCategory
  openInNewTab: boolean
  isContextMenuActive?: boolean
  isAnyContextMenuActive?: boolean
  isReorderMode?: boolean
  draggedCard?: { categoryId: string; item: NavItem; index: number } | null
}>(), {
  isContextMenuActive: false,
  isAnyContextMenuActive: false,
  isReorderMode: false,
  draggedCard: null
})

const emit = defineEmits<{
  (e: 'clickItem', item: NavItem): void
  (e: 'openContextMenu', payload: { item: NavItem; x: number; y: number; categoryId: string }): void
  (e: 'addItemToCategory', categoryId: string): void
  (e: 'dropUrlOnCategory', categoryId: string, url: string): void
  (e: 'editCategory', category: NavCategory): void
  (e: 'deleteCategory', categoryId: string): void
  (e: 'startReorder', item: NavItem): void
  (e: 'dragStartCard', payload: { categoryId: string; item: NavItem; index: number }): void
  (e: 'dragEndCard'): void
  (e: 'dropCard', payload: { targetCategoryId: string; targetIndex: number }): void
}>()

const isDragOver = ref(false)
const isCollapsed = ref(false)
const isHovered = ref(false)
const isRevealed = ref(false)
const isMouseInside = ref(false)

let revealTimer: number | null = null
let collapseTimer: number | null = null

const reelGridRef = ref<any>(null)
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
  if (isCollapsed.value && !props.isReorderMode) {
    currentHeight.value = '0px'
    return
  }
  const el = reelGridRef.value?.$el || reelGridRef.value
  if (props.isReorderMode) {
    // 调整模式下：全局展开，露出全部卡片以便跨分类与全局拖拽
    if (el) {
      currentHeight.value = `${el.scrollHeight + 6}px`
    }
    return
  }
  if (!isHovered.value) {
    currentHeight.value = `${SINGLE_ROW_HEIGHT}px`
  } else {
    if (el) {
      const fullH = el.scrollHeight
      currentHeight.value = `${fullH + 4}px`
    }
  }
}

watch(() => props.isReorderMode, (reordering) => {
  if (reordering) {
    isHovered.value = true
    isRevealed.value = true
    nextTick(updateReelHeight)
  } else {
    isHovered.value = false
    isRevealed.value = false
    nextTick(updateReelHeight)
  }
})

// 展开逻辑 (外框先动，波浪后现)
const expandSection = () => {
  if (props.isReorderMode) return
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
  if (props.isReorderMode) return
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
  // 若当前分类的右键菜单正在显示，绝对锁定展开，禁止收起！
  if (props.isContextMenuActive) {
    return
  }
  collapseSection()
}

// 监听当前分类的右键菜单激活状态
watch(() => props.isContextMenuActive, (isActive) => {
  if (isActive) {
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
    if (!isMouseInside.value) {
      collapseSection()
    }
  }
})

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
  // 调整模式下：返回空样式，绝对不内联任何 transform/transition，完全交给 Vue TransitionGroup 的原生 FLIP
  if (props.isReorderMode) {
    return {}
  }

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

// 动态响应式计算展示列表 (实时推移与凹槽插入，触发 TransitionGroup FLIP)
const displayCards = computed<DisplayCard[]>(() => {
  const originalItems = props.category.items
  const drag = activeDraggedCard.value
  const hover = dragHoverTarget.value

  if (!drag || !props.isReorderMode) {
    return originalItems.map(item => ({
      id: item.id,
      item,
      isGhost: false
    }))
  }

  const isSourceCategory = drag.categoryId === props.category.id
  const isTargetCategory = hover && hover.categoryId === props.category.id

  // 1. 本分类是拖拽源分类
  if (isSourceCategory) {
    const remainingItems = originalItems.filter(i => i.id !== drag.item.id)
    if (isTargetCategory) {
      // 仍然在本分类悬停：将 Ghost 卡片插入到 hover.index 处
      const targetIndex = Math.max(0, Math.min(hover.index, remainingItems.length))
      const result: DisplayCard[] = remainingItems.map(item => ({
        id: item.id,
        item,
        isGhost: false
      }))
      result.splice(targetIndex, 0, {
        id: drag.item.id,
        item: drag.item,
        isGhost: true
      })
      return result
    } else {
      // 鼠标已移出源分类：源分类顺滑收缩闭合
      return remainingItems.map(item => ({
        id: item.id,
        item,
        isGhost: false
      }))
    }
  }

  // 2. 本分类是跨分类拖入的目标分类
  if (isTargetCategory) {
    const targetIndex = Math.max(0, Math.min(hover.index, originalItems.length))
    const result: DisplayCard[] = originalItems.map(item => ({
      id: item.id,
      item,
      isGhost: false
    }))
    result.splice(targetIndex, 0, {
      id: drag.item.id,
      item: drag.item,
      isGhost: true
    })
    return result
  }

  // 3. 其他非活动分类：保持原样
  return originalItems.map(item => ({
    id: item.id,
    item,
    isGhost: false
  }))
})

// 图标位置调整拖拽事件处理
const handleCardDragStart = (e: DragEvent, item: NavItem, index: number) => {
  if (!props.isReorderMode) return
  setDraggedCard({ categoryId: props.category.id, item, index })
  setDragHoverTarget({ categoryId: props.category.id, index })
  emit('dragStartCard', { categoryId: props.category.id, item, index })
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }
}

const handleCardDragEnd = () => {
  clearDragState()
  emit('dragEndCard')
}

const handleCardDragOver = (e: DragEvent, card: DisplayCard) => {
  const currentDrag = getDraggedCard()
  if (!currentDrag || !props.isReorderMode) return
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }

  // 若悬停在占位凹槽本身，保持当前坑位，避免左右抖动
  if (card.isGhost) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const isRightHalf = mouseX > rect.width * 0.5

  const nonGhostCards = displayCards.value.filter(c => !c.isGhost)
  const targetItemIndex = nonGhostCards.findIndex(c => c.id === card.id)
  if (targetItemIndex === -1) return

  const targetIndex = isRightHalf ? targetItemIndex + 1 : targetItemIndex

  const currentHover = getDragHoverTarget()
  if (!currentHover || currentHover.categoryId !== props.category.id || currentHover.index !== targetIndex) {
    setDragHoverTarget({
      categoryId: props.category.id,
      index: targetIndex
    })
  }
}

const handleCardDrop = (e: DragEvent) => {
  const currentDrag = getDraggedCard()
  if (!currentDrag || !props.isReorderMode) return
  e.preventDefault()
  e.stopPropagation()

  const currentHover = getDragHoverTarget()
  let finalTargetIndex = displayCards.value.length
  if (currentHover && currentHover.categoryId === props.category.id) {
    finalTargetIndex = currentHover.index
  }

  emit('dropCard', {
    targetCategoryId: props.category.id,
    targetIndex: finalTargetIndex
  })
  clearDragState()
}

const handleSectionDragOver = (e: DragEvent) => {
  const currentDrag = getDraggedCard()
  if (currentDrag && props.isReorderMode) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    const currentHover = getDragHoverTarget()
    if (!currentHover || currentHover.categoryId !== props.category.id) {
      const nonGhostCards = displayCards.value.filter(c => !c.isGhost)
      setDragHoverTarget({
        categoryId: props.category.id,
        index: nonGhostCards.length
      })
    }
  } else {
    handleDragOver(e)
  }
}

const handleSectionDrop = (e: DragEvent) => {
  const currentDrag = getDraggedCard()
  if (currentDrag && props.isReorderMode) {
    e.preventDefault()
    e.stopPropagation()
    const currentHover = getDragHoverTarget()
    let finalTargetIndex = props.category.items.length
    if (currentHover && currentHover.categoryId === props.category.id) {
      finalTargetIndex = currentHover.index
    }
    emit('dropCard', {
      targetCategoryId: props.category.id,
      targetIndex: finalTargetIndex
    })
    clearDragState()
    return
  }
  handleDrop(e)
}

watch(() => displayCards.value.length, () => {
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
    class="category-section w-full mb-4 rounded-2xl p-2.5 transition-colors duration-200"
    :class="[
      isDragOver ? 'bg-blue-50/70 ring-2 ring-blue-400 ring-dashed shadow-md' : 'hover:bg-slate-50/50',
      isReorderMode ? 'bg-slate-50/60 ring-1 ring-slate-200/60' : ''
    ]"
    @dragover="handleSectionDragOver"
    @dragleave="handleDragLeave"
    @drop="handleSectionDrop"
  >
    <!-- 分类头部 (纯净极简无边框) -->
    <div class="flex items-center mb-2.5 px-1 select-none">
      <div class="flex items-center gap-2 group">
        <div 
          @click="isCollapsed = !isCollapsed" 
          class="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 transition-colors hover:bg-blue-100 cursor-pointer"
        >
          <component :is="getCategoryIcon(category.icon)" class="w-3.5 h-3.5" />
        </div>
        <h2 
          @click="$emit('editCategory', category)"
          class="text-xs font-semibold text-slate-800 tracking-tight hover:text-blue-600 transition-colors cursor-pointer"
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
      <!-- 舒适透气的 3~6 列自适应网格 + FLIP 平滑挤占 TransitionGroup -->
      <TransitionGroup
        ref="reelGridRef"
        name="card-reorder"
        tag="div"
        class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 relative p-0.5"
      >
        <div
          v-for="(card, idx) in displayCards"
          :key="card.id"
          class="wave-card-wrapper relative"
          :style="getCardWaveStyle(idx)"
          :draggable="isReorderMode && !card.isGhost"
          @dragstart="handleCardDragStart($event, card.item, idx)"
          @dragend="handleCardDragEnd"
          @dragover="handleCardDragOver($event, card)"
          @drop="handleCardDrop($event)"
        >
          <!-- 高质感半透明虚线凹槽占位符 (Ghost Slot - 纯净物理隐喻，零说教) -->
          <div
            v-if="card.isGhost"
            class="ghost-card-slot w-full h-[94px] p-2.5 rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-50/40 backdrop-blur-xs flex flex-col items-center justify-center select-none shadow-[inset_0_2px_6px_rgba(59,130,246,0.06)] pointer-events-none transition-all duration-200"
          >
            <!-- 柔和微缩卡片虚影 -->
            <div class="w-10 h-10 flex items-center justify-center opacity-40 grayscale scale-95">
              <img
                v-if="card.item.icon"
                :src="card.item.icon"
                class="w-9 h-9 object-contain"
              />
              <div
                v-else
                class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-2xs"
              >
                {{ card.item.title.slice(0, 1) }}
              </div>
            </div>
            <div class="w-full mt-2 px-1 text-center">
              <span class="text-[11px] font-medium text-blue-600/50 truncate block tracking-tight leading-tight">
                {{ card.item.title }}
              </span>
            </div>
          </div>

          <!-- 真实卡片 -->
          <NavCard
            v-else
            :item="card.item"
            :open-in-new-tab="openInNewTab"
            :is-reordering="isReorderMode"
            @click-item="$emit('clickItem', $event)"
            @open-context-menu="$emit('openContextMenu', { ...$event, categoryId: category.id })"
            @start-reorder="$emit('startReorder', $event)"
          />
        </div>

        <!-- 极简加号卡片 (图标无边框设计，同样接入波浪与过渡逻辑) -->
        <div
          key="static-action-add"
          class="wave-card-wrapper"
          :style="getCardWaveStyle(displayCards.length)"
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
      </TransitionGroup>
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

/* FLIP 挤占推移动画：0.24s 极速贝塞尔曲线过渡 */
.card-reorder-move {
  transition: transform 0.24s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;
}

.card-reorder-enter-active {
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.card-reorder-leave-active {
  transition: opacity 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: absolute;
  pointer-events: none;
}

.card-reorder-enter-from,
.card-reorder-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
