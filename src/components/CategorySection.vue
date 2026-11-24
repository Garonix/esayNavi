<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, TransitionGroup } from 'vue'
import { 
  Sparkles, 
  CodeXml, 
  Palette, 
  Folder, 
  Plus,
  ChevronUp,
  ChevronDown
} from 'lucide-vue-next'
import type { CSSProperties } from 'vue'
import type { NavCategory, NavItem } from '../types/nav'
import NavCard from './NavCard.vue'
import { 
  activeDraggedCard, 
  dragHoverTarget,
  activeReorderCategoryId
} from '../services/dragState'
import { useGridReorder } from '../composables/useGridReorder'

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
  focusedCardId?: string | null
  isFirstCategory?: boolean
  isLastCategory?: boolean
  isSearchActive?: boolean
  cardDensity?: 'compact' | 'normal' | 'relaxed'
  categorySpacing?: 'compact' | 'normal' | 'relaxed'
}>(), {
  isContextMenuActive: false,
  isAnyContextMenuActive: false,
  isReorderMode: false,
  draggedCard: null,
  focusedCardId: null,
  isFirstCategory: false,
  isLastCategory: false,
  isSearchActive: false,
  cardDensity: 'normal',
  categorySpacing: 'normal'
})

const emit = defineEmits<{
  (e: 'clickItem', item: NavItem): void
  (e: 'openContextMenu', payload: { item: NavItem; x: number; y: number; categoryId: string }): void
  (e: 'addItemToCategory', categoryId: string): void
  (e: 'dropUrlOnCategory', categoryId: string, url: string): void
  (e: 'editCategory', category: NavCategory): void
  (e: 'deleteCategory', categoryId: string): void
  (e: 'moveCategory', payload: { categoryId: string; direction: 'up' | 'down' }): void
  (e: 'startReorder', payload: { categoryId: string; item: NavItem }): void
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

// 动态响应式列数检测 (根据 density 与屏宽智能适配，确保第一排卡片永不误判)
const columnsCount = ref(6)

const updateColumnsCount = () => {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const density = props.cardDensity || 'normal'

  if (density === 'compact') {
    // 紧凑：间距更小，单行容纳更多卡片
    if (w < 640) {
      columnsCount.value = 3
    } else if (w < 768) {
      columnsCount.value = 4
    } else if (w < 1024) {
      columnsCount.value = 6
    } else if (w < 1280) {
      columnsCount.value = 7
    } else {
      columnsCount.value = 8
    }
  } else if (density === 'relaxed') {
    // 宽松：间距更大，单行容纳较少卡片
    if (w < 640) {
      columnsCount.value = 2
    } else if (w < 768) {
      columnsCount.value = 3
    } else if (w < 1024) {
      columnsCount.value = 4
    } else {
      columnsCount.value = 5
    }
  } else {
    // 标准
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
}

watch(() => props.cardDensity, () => {
  updateColumnsCount()
  nextTick(updateReelHeight)
})

// 图标网格布局类名 (通过同行图标间距控制单行容量)
const gridDensityClass = computed(() => {
  switch (props.cardDensity) {
    case 'compact':
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2'
    case 'relaxed':
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5'
    case 'normal':
    default:
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3'
  }
})

// 分类显示垂直间距类名
const categorySpacingClass = computed(() => {
  switch (props.categorySpacing) {
    case 'compact':
      return 'mb-2.5'
    case 'relaxed':
      return 'mb-8'
    case 'normal':
    default:
      return 'mb-4'
  }
})

// 方案 C（原地稳定模式）：计算当前分类在换位模式下是否需要保持展开
// 仅当前被长按的主活动分类、正在拖拽的源分类、跨分类拖入吸附的目标分类展开
// 上方与其他所有分类严格保持紧凑单排，彻底消除下方卡片被下推位移的根源！
const shouldExpandInReorderMode = computed(() => {
  if (!props.isReorderMode) return false

  // 1. 鼠标当前正停留在本分类区域内
  if (isMouseInside.value || isHovered.value) return true

  // 2. 本分类是长按起步的主活动分类
  if (activeReorderCategoryId.value && activeReorderCategoryId.value === props.category.id) return true

  // 3. 本分类是当前正在拖拽的源分类
  const drag = activeDraggedCard.value
  if (drag && drag.categoryId === props.category.id) return true

  // 4. 本分类是当前拖拽悬停的目标分类（跨分类拖入智能吸附）
  const hover = dragHoverTarget.value
  if (hover && hover.categoryId === props.category.id) return true

  return false
})

// 物理高度连续插值
const updateReelHeight = () => {
  if (isCollapsed.value && !props.isReorderMode) {
    currentHeight.value = '0px'
    return
  }
  const el = reelGridRef.value?.$el || reelGridRef.value
  if (props.isReorderMode) {
    // 方案 C 原地稳定：仅展开活动分类，非活动分类严格维持单排高度（98px），零推搡！
    if (shouldExpandInReorderMode.value) {
      if (el) {
        currentHeight.value = `${el.scrollHeight + 6}px`
      }
    } else {
      currentHeight.value = `${SINGLE_ROW_HEIGHT}px`
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
    if (shouldExpandInReorderMode.value) {
      isHovered.value = true
      isRevealed.value = true
    } else {
      isHovered.value = false
      isRevealed.value = false
    }
    nextTick(updateReelHeight)
  } else {
    isHovered.value = false
    isRevealed.value = false
    nextTick(updateReelHeight)
  }
})

watch(shouldExpandInReorderMode, (expanded) => {
  if (props.isReorderMode) {
    if (expanded) {
      isHovered.value = true
      isRevealed.value = true
    } else {
      isHovered.value = false
      isRevealed.value = false
    }
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
  // 调整模式下：若是展开的活动分类，返回空样式，完全交给 Vue TransitionGroup 的原生 FLIP
  if (props.isReorderMode && shouldExpandInReorderMode.value) {
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

// “添加”按钮悬停感知显隐 (平时静默淡出，鼠标 hover 到分类时平滑淡入)
const isAddBtnVisible = computed(() => {
  if (props.isReorderMode) return false
  if (props.category.items.length === 0) return true
  return isMouseInside.value || isHovered.value
})

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

// Pointer 拖拽物理动力学与滞回状态（由独立 composable 托管并自动随生命周期卸载监听器）
const { handleCardPointerDown, handleCardStartReorder } = useGridReorder({
  categoryId: () => props.category.id,
  isReorderMode: () => !!props.isReorderMode,
  onStartReorder: (payload) => emit('startReorder', payload),
  onDragStartCard: (payload) => emit('dragStartCard', payload),
  onDragEndCard: () => emit('dragEndCard'),
  onDropCard: (payload) => emit('dropCard', payload)
})

// 外部 URL 拖入分类的处理 (非换位模式)
const handleSectionDragOver = (e: DragEvent) => {
  if (props.isReorderMode) return
  handleDragOver(e)
}

const handleSectionDrop = (e: DragEvent) => {
  if (props.isReorderMode) return
  handleDrop(e)
}

watch(() => displayCards.value.length, () => {
  nextTick(updateReelHeight)
})

watch(isCollapsed, () => {
  nextTick(updateReelHeight)
})

const handleWindowResize = () => {
  updateColumnsCount()
  updateReelHeight()
}

onMounted(() => {
  updateColumnsCount()
  updateReelHeight()
  window.addEventListener('resize', handleWindowResize, { passive: true })
})

onUnmounted(() => {
  if (revealTimer) clearTimeout(revealTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
  window.removeEventListener('resize', handleWindowResize)
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
    class="category-section w-full rounded-2xl p-2.5 transition-all duration-200"
    :class="[
      categorySpacingClass,
      isDragOver ? 'bg-blue-50/70 ring-2 ring-blue-400 ring-dashed shadow-md' : 'hover:bg-slate-50/50',
      isReorderMode ? 'bg-slate-50/60 ring-1 ring-slate-200/60' : ''
    ]"
    :data-category-section-id="category.id"
    @dragover="handleSectionDragOver"
    @dragleave="handleDragLeave"
    @drop="handleSectionDrop"
  >
    <!-- 分类头部 (纯净极简无边框) -->
    <div class="flex items-center mb-2.5 px-1 select-none">
      <div class="flex items-center gap-2 group/cat-header">
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

        <!-- 极简排序微控制箭头 (仅在正常模式且无搜索时 Hover 出现) -->
        <div 
          v-if="!isSearchActive && !isReorderMode"
          class="flex items-center gap-0.5 opacity-0 group-hover/cat-header:opacity-100 transition-opacity duration-150 ml-0.5"
        >
          <button
            v-if="!isFirstCategory"
            type="button"
            @click.stop="$emit('moveCategory', { categoryId: category.id, direction: 'up' })"
            class="p-0.5 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="上移"
          >
            <ChevronUp class="w-3 h-3" />
          </button>
          <button
            v-if="!isLastCategory"
            type="button"
            @click.stop="$emit('moveCategory', { categoryId: category.id, direction: 'down' })"
            class="p-0.5 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="下移"
          >
            <ChevronDown class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- 物理卷轴容器 (高度基于贝塞尔曲线展开) -->
    <div 
      class="scroll-reel-container overflow-hidden"
      :style="{ height: currentHeight }"
    >
      <!-- 动态响应式自适应网格 (紧凑/标准/宽松同行图标间距控制) + FLIP 平滑挤占 TransitionGroup -->
      <TransitionGroup
        ref="reelGridRef"
        name="card-reorder"
        tag="div"
        class="grid relative p-0.5 transition-all duration-200"
        :class="gridDensityClass"
      >
        <div
          v-for="(card, idx) in displayCards"
          :key="card.id"
          class="wave-card-wrapper relative select-none"
          :style="getCardWaveStyle(idx)"
          :data-reorder-card="card.item.id"
          :data-category-id="category.id"
          :data-card-index="idx"
          :data-is-ghost="card.isGhost ? 'true' : 'false'"
          @pointerdown="handleCardPointerDown($event, card.item, idx, card.isGhost)"
        >
          <!-- 高质感半透明虚线凹槽占位符 (Ghost Slot - 纯净物理隐喻，零说教) -->
          <div
            v-if="card.isGhost"
            class="ghost-card-slot w-full h-[94px] p-2.5 rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-50/40 backdrop-blur-xs flex flex-col items-center justify-center select-none shadow-[inset_0_2px_6px_rgba(59,130,246,0.06)] transition-all duration-200"
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
            :is-focused="focusedCardId === card.item.id"
            @click-item="$emit('clickItem', $event)"
            @open-context-menu="$emit('openContextMenu', { ...$event, categoryId: category.id })"
            @start-reorder="handleCardStartReorder($event, idx)"
          />
        </div>

        <!-- 极简加号卡片 (平时静默淡出，鼠标 Hover 到分类时平滑淡入) -->
        <div
          v-if="!isReorderMode"
          key="static-action-add"
          class="wave-card-wrapper transition-all duration-200 ease-out"
          :class="isAddBtnVisible 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none'"
          :style="getCardWaveStyle(displayCards.length)"
        >
          <button
            @click="$emit('addItemToCategory', category.id)"
            class="w-full h-[94px] rounded-2xl border border-transparent hover:bg-slate-100/70 text-slate-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 p-2 select-none cursor-pointer"
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
