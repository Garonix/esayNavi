<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { FolderPlus, HelpCircle, CheckCircle2, Settings, Check } from 'lucide-vue-next'
import type { NavConfig, NavCategory, NavItem } from './types/nav'
import { getFaviconUrl, isDirectUrl, toDirectUrl } from './utils/urlHelper'
import { buildSearchUrl } from './utils/searchEngines'
import { filterAndRankCategories } from './services/bookmarkSuggestions'
import { useNavStore } from './composables/useNavStore'

import Header from './components/Header.vue'
import CategorySection from './components/CategorySection.vue'
import SearchEmptyReel from './components/SearchEmptyReel.vue'
import AddSiteModal from './components/AddSiteModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import EditCategoryModal from './components/EditCategoryModal.vue'
import BackgroundLayer from './components/BackgroundLayer.vue'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.vue'
import ContextMenu from './components/ContextMenu.vue'
import TableEditorModal from './components/TableEditorModal.vue'
import {
  getDraggedCard,
  clearDragState,
  activeFloatingCard,
  floatingPointer,
  updateFloatingPointer,
  setActiveReorderCategory
} from './services/dragState'

const {
  config,
  toastMessage,
  showToast,
  initStore,
  updateSettings,
  updateFullConfig,
  exportConfig,
  importConfig,
  resetToDefault,
  recordItemClick,
  saveItem,
  deleteItem,
  refreshItemIcon,
  dropUrlOnCategory,
  saveCategory,
  deleteCategory,
  moveCategory,
  moveOrReorderCard,
  dispose: disposeStore
} = useNavStore()

const headerRef = ref<InstanceType<typeof Header> | null>(null)
const searchQuery = ref('')
const showAddModal = ref(false)
const showSettingsModal = ref(false)
const showCategoryModal = ref(false)
const showShortcutsModal = ref(false)
const showTableEditorModal = ref(false)
const isZenMode = ref(false)

// 右键上下文菜单状态
const contextMenuState = ref({
  show: false,
  x: 0,
  y: 0,
  item: null as NavItem | null,
  categoryId: null as string | null
})
const activeContextMenuCategoryId = ref<string | null>(null)

const handleCloseContextMenu = () => {
  contextMenuState.value.show = false
  activeContextMenuCategoryId.value = null
  contextMenuState.value.categoryId = null
}

const targetCategoryIdForAdd = ref<string | undefined>()
const editingItem = ref<NavItem | null>(null)
const editingCategory = ref<NavCategory | null>(null)
const isCreatingCategory = ref(false)

const getFloatingIcon = (item: NavItem) => {
  if (item.icon && item.icon.trim()) return item.icon.trim()
  return getFaviconUrl(item.url, item.title)
}

// 浮动卡片坐标计算：卡片标准尺寸 116px * 94px，图标几何正中心水平 58px，垂直 35.5px
const floatingCardStyle = computed(() => {
  const x = floatingPointer.value.x - 58
  const y = floatingPointer.value.y - 35.5
  return {
    transform: `translate3d(${x}px, ${y}px, 0)`
  }
})

// 拖拽阶段视口自动滚屏与滚轮滑动引擎
let autoScrollRafId: number | null = null
let currentScrollSpeed = 0
const EDGE_THRESHOLD = 96
const MAX_SCROLL_SPEED = 18

const stepAutoScroll = () => {
  if (!isReorderMode.value || !activeFloatingCard.value || currentScrollSpeed === 0) {
    if (autoScrollRafId) {
      cancelAnimationFrame(autoScrollRafId)
      autoScrollRafId = null
    }
    return
  }
  window.scrollBy(0, currentScrollSpeed)
  autoScrollRafId = requestAnimationFrame(stepAutoScroll)
}

const stopAutoScroll = () => {
  currentScrollSpeed = 0
  if (autoScrollRafId) {
    cancelAnimationFrame(autoScrollRafId)
    autoScrollRafId = null
  }
}

const handleGlobalWheel = (e: WheelEvent) => {
  if (isReorderMode.value && activeFloatingCard.value) {
    window.scrollBy({ top: e.deltaY, behavior: 'instant' })
  }
}

const checkEdgeAutoScroll = (clientY: number) => {
  const winH = window.innerHeight
  if (clientY < EDGE_THRESHOLD) {
    const intensity = (EDGE_THRESHOLD - Math.max(0, clientY)) / EDGE_THRESHOLD
    currentScrollSpeed = -Math.round(intensity * MAX_SCROLL_SPEED)
  } else if (clientY > winH - EDGE_THRESHOLD) {
    const intensity = (Math.min(winH, clientY) - (winH - EDGE_THRESHOLD)) / EDGE_THRESHOLD
    currentScrollSpeed = Math.round(intensity * MAX_SCROLL_SPEED)
  } else {
    currentScrollSpeed = 0
  }

  if (currentScrollSpeed !== 0 && !autoScrollRafId) {
    autoScrollRafId = requestAnimationFrame(stepAutoScroll)
  }
}

const handleGlobalPointerMove = (e: PointerEvent) => {
  if (isReorderMode.value && activeFloatingCard.value) {
    checkEdgeAutoScroll(e.clientY)
  }
}

const handleGlobalDragOver = (e: DragEvent) => {
  if (isReorderMode.value && activeFloatingCard.value && e.clientX && e.clientY) {
    updateFloatingPointer(e.clientX, e.clientY)
    checkEdgeAutoScroll(e.clientY)
  }
}

const handleUpdateFullConfig = (newConfig: NavConfig) => {
  updateFullConfig(newConfig, '配置已更新')
}

onMounted(async () => {
  await initStore()
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true })
  window.addEventListener('pointerup', stopAutoScroll)
  window.addEventListener('dragover', handleGlobalDragOver, { passive: true })
  window.addEventListener('wheel', handleGlobalWheel, { passive: true })
  window.addEventListener('dragend', stopAutoScroll)
})

onUnmounted(() => {
  stopAutoScroll()
  disposeStore()
  if (bottomLeaveTimer) {
    clearTimeout(bottomLeaveTimer)
    bottomLeaveTimer = null
  }
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('pointermove', handleGlobalPointerMove)
  window.removeEventListener('pointerup', stopAutoScroll)
  window.removeEventListener('dragover', handleGlobalDragOver)
  window.removeEventListener('wheel', handleGlobalWheel)
  window.removeEventListener('dragend', stopAutoScroll)
})

// 全局活跃模态框状态判定
const hasActiveModal = computed(() => {
  return showAddModal.value || showSettingsModal.value || showCategoryModal.value || showShortcutsModal.value || showTableEditorModal.value
})

watch(hasActiveModal, (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (hasActiveModal.value) {
    if (e.key === 'Escape') {
      if (showTableEditorModal.value) showTableEditorModal.value = false
      else if (showShortcutsModal.value) showShortcutsModal.value = false
      else if (showAddModal.value) showAddModal.value = false
      else if (showSettingsModal.value) showSettingsModal.value = false
      else if (showCategoryModal.value) showCategoryModal.value = false
    }
    return
  }

  if (contextMenuState.value.show) {
    if (e.key === 'Escape') handleCloseContextMenu()
    return
  }

  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return

  if (e.code === 'Space') {
    e.preventDefault()
    isZenMode.value = !isZenMode.value
  } else if (e.key === 'Escape') {
    if (isReorderMode.value) isReorderMode.value = false
    else if (isZenMode.value) isZenMode.value = false
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    openAddModal()
  } else if (e.key === 'j' || e.key === 'J') {
    e.preventDefault()
    showTableEditorModal.value = true
  } else if (e.key === '/') {
    e.preventDefault()
    headerRef.value?.focus()
  } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault()
    showShortcutsModal.value = !showShortcutsModal.value
  }
}

const handleRootDblClick = (e: MouseEvent) => {
  if (hasActiveModal.value || contextMenuState.value.show) return
  const target = e.target as HTMLElement
  if (target.closest('button, input, textarea, a, select, .glass-card, .glass-panel, form, .category-section')) return
  isZenMode.value = !isZenMode.value
}

// 统一使用与下拉联想一致的得分与高频加权排序
const filteredCategories = computed(() => {
  return filterAndRankCategories(searchQuery.value, config.value.categories)
})

const flatFilteredCards = computed<NavItem[]>(() => {
  const list: NavItem[] = []
  for (const cat of filteredCategories.value) {
    for (const item of cat.items) {
      list.push(item)
    }
  }
  return list
})

const activeKeyboardIndex = ref<number>(-1)

const activeFocusedCard = computed<NavItem | null>(() => {
  if (activeKeyboardIndex.value >= 0 && activeKeyboardIndex.value < flatFilteredCards.value.length) {
    return flatFilteredCards.value[activeKeyboardIndex.value]
  }
  return null
})

watch(searchQuery, (newVal) => {
  if (newVal.trim() && flatFilteredCards.value.length > 0) {
    activeKeyboardIndex.value = 0
  } else {
    activeKeyboardIndex.value = -1
  }
})

const handleNavigateCards = (direction: 'next' | 'prev') => {
  const total = flatFilteredCards.value.length
  if (total === 0) return

  if (direction === 'next') {
    activeKeyboardIndex.value = activeKeyboardIndex.value === -1 ? 0 : (activeKeyboardIndex.value + 1) % total
  } else {
    activeKeyboardIndex.value = activeKeyboardIndex.value === -1 ? total - 1 : (activeKeyboardIndex.value - 1 + total) % total
  }
}

const handleOpenDirectUrl = (url: string) => {
  if (config.value.settings.openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = url
  }
}

const handleSelectFocusedCard = () => {
  if (activeFocusedCard.value) {
    const card = activeFocusedCard.value
    recordItemClick(card)
    handleOpenDirectUrl(card.url)
  }
}

const handleClearFocus = () => {
  activeKeyboardIndex.value = -1
}

const handleSearchSubmit = (query: string, engineBaseUrl: string) => {
  if (isDirectUrl(query)) {
    handleOpenDirectUrl(toDirectUrl(query))
    return
  }
  const targetUrl = buildSearchUrl(engineBaseUrl, query)
  window.open(targetUrl, '_blank', 'noopener,noreferrer')
}

const openAddModal = (categoryId?: string) => {
  editingItem.value = null
  targetCategoryIdForAdd.value = categoryId
  showAddModal.value = true
}

const handleEditItem = (item: NavItem) => {
  editingItem.value = item
  const catId = contextMenuState.value.categoryId
  if (catId) {
    targetCategoryIdForAdd.value = catId
  } else {
    const foundCat = config.value.categories.find(c => c.items.some(i => i.id === item.id))
    targetCategoryIdForAdd.value = foundCat?.id
  }
  showAddModal.value = true
}

const handleDeleteItem = (item: NavItem) => {
  deleteItem(item, contextMenuState.value.categoryId)
}

// 图标位置调整模式
const isReorderMode = ref(false)
const draggedCardInfo = ref<{
  categoryId: string
  item: NavItem
  index: number
} | null>(null)

const handleStartReorder = (payload?: { categoryId: string; item: NavItem } | NavItem) => {
  clearDragState()
  draggedCardInfo.value = null
  isReorderMode.value = true
  if (contextMenuState.value.show) {
    handleCloseContextMenu()
  }

  let targetCatId: string | null = null
  if (payload && 'categoryId' in payload) {
    targetCatId = payload.categoryId
  } else if (payload && 'id' in payload) {
    const found = config.value.categories.find(c => c.items.some(i => i.id === payload.id))
    targetCatId = found?.id || null
  } else if (contextMenuState.value.categoryId) {
    targetCatId = contextMenuState.value.categoryId
  }

  setActiveReorderCategory(targetCatId)
  showToast('调整模式')
}

watch(isReorderMode, (val) => {
  if (!val) {
    stopAutoScroll()
    clearDragState()
    draggedCardInfo.value = null
  }
})

const handleDragStartCard = (payload: { categoryId: string; item: NavItem; index: number }) => {
  draggedCardInfo.value = payload
}

const handleDragEndCard = () => {
  stopAutoScroll()
  draggedCardInfo.value = null
}

const handleDropCard = ({ targetCategoryId, targetIndex }: { targetCategoryId: string; targetIndex: number }) => {
  stopAutoScroll()
  const currentDrag = getDraggedCard() || draggedCardInfo.value
  if (!currentDrag) return

  moveOrReorderCard(currentDrag.categoryId, currentDrag.item.id, targetCategoryId, targetIndex)
  clearDragState()
  draggedCardInfo.value = null
}

const handleOpenContextMenu = (payload: { item: NavItem; x: number; y: number; categoryId?: string }) => {
  let targetCatId = payload.categoryId
  if (!targetCatId) {
    const foundCat = config.value.categories.find(c => c.items.some(i => i.id === payload.item.id))
    targetCatId = foundCat ? foundCat.id : undefined
  }
  activeContextMenuCategoryId.value = targetCatId || null
  contextMenuState.value = {
    show: true,
    x: payload.x,
    y: payload.y,
    item: payload.item,
    categoryId: targetCatId || null
  }
}

const handleCopyUrl = (item: NavItem) => {
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(item.url)
    showToast('已复制')
  }
}

const handleOpenInNewTab = (item: NavItem) => {
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

const handleAddCategory = () => {
  const newCat: NavCategory = {
    id: 'cat-' + Date.now().toString(36),
    name: '',
    icon: 'folder',
    items: []
  }
  isCreatingCategory.value = true
  editingCategory.value = newCat
  showCategoryModal.value = true
}

const handleEditCategory = (cat: NavCategory) => {
  isCreatingCategory.value = false
  editingCategory.value = cat
  showCategoryModal.value = true
}

const handleSaveCategory = (updatedCat: NavCategory) => {
  const ok = saveCategory(updatedCat, isCreatingCategory.value)
  if (ok && isCreatingCategory.value) {
    isCreatingCategory.value = false
  }
}

const handleMoveCategory = (payload: { categoryId: string; direction: 'up' | 'down' }) => {
  moveCategory(payload.categoryId, payload.direction)
}

const handleModalMoveCategory = (direction: 'up' | 'down') => {
  if (!editingCategory.value) return
  moveCategory(editingCategory.value.id, direction)
}

const isEditingFirstCategory = computed(() => {
  if (!editingCategory.value || config.value.categories.length === 0) return true
  return config.value.categories[0].id === editingCategory.value.id
})

const isEditingLastCategory = computed(() => {
  if (!editingCategory.value || config.value.categories.length === 0) return true
  return config.value.categories[config.value.categories.length - 1].id === editingCategory.value.id
})

// 页面下方区域“新建分类”悬停感知
const isBottomHovered = ref(false)
let bottomLeaveTimer: number | null = null

const handleBottomMouseEnter = () => {
  if (bottomLeaveTimer) {
    clearTimeout(bottomLeaveTimer)
    bottomLeaveTimer = null
  }
  isBottomHovered.value = true
}

const handleBottomMouseLeave = () => {
  if (bottomLeaveTimer) clearTimeout(bottomLeaveTimer)
  bottomLeaveTimer = window.setTimeout(() => {
    isBottomHovered.value = false
  }, 240)
}

const isAddCategoryVisible = computed(() => {
  if (searchQuery.value.trim()) return false
  if (config.value.categories.length === 0) return true
  return isBottomHovered.value
})

const handleImportFile = async (file: File) => {
  try {
    await importConfig(file)
  } catch (e: any) {
    alert(e.message || '导入失败')
  }
}

const handleResetDefault = async () => {
  if (confirm('恢复默认配置？')) {
    await resetToDefault()
  }
}
</script>

<template>
  <div 
    @dblclick="handleRootDblClick"
    class="min-h-screen relative font-sans selection:bg-blue-100 selection:text-blue-900"
  >
    <!-- 统一动态背景与视差层 -->
    <BackgroundLayer :config="config.settings.customBackground" :zen-mode="isZenMode" />

    <!-- 前景工作台 (Zen 模式下平滑景深淡出) -->
    <div 
      class="transition-all duration-300 transform"
      :class="isZenMode ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'"
    >
      <!-- 极简聚焦搜索栏 -->
      <Header
        ref="headerRef"
        :settings="config.settings"
        :categories="config.categories"
        v-model:search-query="searchQuery"
        :has-active-card-focus="!!activeFocusedCard"
        :focused-card-title="activeFocusedCard?.title"
        @submit-search="handleSearchSubmit"
        @open-direct-url="handleOpenDirectUrl"
        @navigate-cards="handleNavigateCards"
        @select-focused-card="handleSelectFocusedCard"
        @clear-focus="handleClearFocus"
        @update-engine="updateSettings({ searchEngine: $event })"
      />

      <!-- 分类站点列表 -->
      <main class="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-12 md:px-16 pb-28">
        <TransitionGroup 
          v-if="filteredCategories.length > 0"
          name="category-flow" 
          tag="div"
        >
          <CategorySection
            v-for="(cat, idx) in filteredCategories"
            :key="cat.id"
            :category="cat"
            :open-in-new-tab="config.settings.openInNewTab"
            :card-density="config.settings.cardDensity"
            :category-spacing="config.settings.categorySpacing"
            :is-context-menu-active="activeContextMenuCategoryId === cat.id"
            :is-any-context-menu-active="contextMenuState.show"
            :is-reorder-mode="isReorderMode"
            :dragged-card="draggedCardInfo"
            :focused-card-id="activeFocusedCard?.id"
            :is-first-category="idx === 0"
            :is-last-category="idx === filteredCategories.length - 1"
            :is-search-active="!!searchQuery.trim()"
            @click-item="recordItemClick"
            @open-context-menu="handleOpenContextMenu"
            @add-item-to-category="openAddModal"
            @drop-url-on-category="dropUrlOnCategory"
            @edit-category="handleEditCategory"
            @delete-category="deleteCategory"
            @move-category="handleMoveCategory"
            @start-reorder="handleStartReorder"
            @drag-start-card="handleDragStartCard"
            @drag-end-card="handleDragEndCard"
            @drop-card="handleDropCard"
          />
        </TransitionGroup>

        <!-- 搜索空状态画卷胶囊流 -->
        <SearchEmptyReel
          v-else-if="searchQuery.trim()"
          :show="filteredCategories.length === 0 && !!searchQuery.trim()"
          :search-query="searchQuery"
          :active-engine-id="config.settings.searchEngine || 'google'"
          :custom-engines="config.settings.searchEngines"
          @search="handleSearchSubmit"
        />

        <!-- 页面下方悬停感知区 -->
        <div 
          v-if="!searchQuery.trim()"
          @mouseenter="handleBottomMouseEnter"
          @mouseleave="handleBottomMouseLeave"
          class="relative w-full pt-8 pb-14 mt-1 flex justify-center items-center"
        >
          <button
            @click="handleAddCategory"
            class="group flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-slate-100/90 text-slate-400 hover:text-blue-600 text-xs font-medium transition-all duration-300 ease-out active:scale-95 select-none cursor-pointer"
            :class="isAddCategoryVisible 
              ? 'opacity-100 translate-y-0 pointer-events-auto shadow-2xs' 
              : 'opacity-0 translate-y-2 pointer-events-none'"
          >
            <FolderPlus class="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span>新建分类</span>
          </button>
        </div>
      </main>
    </div>

    <!-- 右下角固定微控制坞 -->
    <div 
      v-if="!isZenMode"
      class="fixed bottom-6 right-6 z-40 flex items-center gap-1 p-1 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-md shadow-slate-900/5 select-none transition-transform duration-200 hover:scale-102"
    >
      <button
        @click="showSettingsModal = true"
        class="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/90 border border-transparent hover:border-slate-200/60 transition-all active:scale-90"
        title="设置"
      >
        <Settings class="w-4 h-4" />
      </button>

      <button
        @click="showShortcutsModal = true"
        class="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/90 border border-transparent hover:border-slate-200/60 transition-all active:scale-90"
        title="快捷键"
      >
        <HelpCircle class="w-4 h-4" />
      </button>
    </div>

    <!-- Zen 模式退出胶囊 -->
    <transition
      enter-active-class="transform transition ease-out duration-200"
      enter-from-class="translate-y-4 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transform transition ease-in duration-150"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-4 opacity-0 scale-95"
    >
      <div 
        v-if="isZenMode"
        @click="isZenMode = false"
        class="fixed bottom-6 right-6 z-50 px-3.5 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white text-xs backdrop-blur-md border border-white/10 shadow-xl cursor-pointer transition-all flex items-center gap-2 select-none active:scale-95"
      >
        <span>退出</span>
        <span class="keycap text-[9px] px-1.5 py-0.2 bg-white/20 text-white border-white/20 border-b-white/40">Space</span>
      </div>
    </transition>

    <!-- 弹窗集群 -->
    <AddSiteModal
      :show="showAddModal"
      :categories="config.categories"
      :default-category-id="targetCategoryIdForAdd"
      :edit-item-data="editingItem"
      @close="showAddModal = false"
      @save="saveItem"
    />

    <SettingsModal
      :show="showSettingsModal"
      :config="config"
      @close="showSettingsModal = false"
      @update-settings="updateSettings"
      @update-full-config="handleUpdateFullConfig"
      @export-file="exportConfig('easynavi.json')"
      @import-file="handleImportFile"
      @open-table-editor="showTableEditorModal = true"
      @reset-default="handleResetDefault"
    />

    <TableEditorModal
      :show="showTableEditorModal"
      :config="config"
      @close="showTableEditorModal = false"
      @save="handleUpdateFullConfig"
    />

    <EditCategoryModal
      :show="showCategoryModal"
      :category="editingCategory"
      :existing-categories="config.categories"
      :is-creating="isCreatingCategory"
      :is-first-category="isEditingFirstCategory"
      :is-last-category="isEditingLastCategory"
      @close="showCategoryModal = false; isCreatingCategory = false"
      @save="handleSaveCategory"
      @delete="deleteCategory"
      @move="handleModalMoveCategory"
    />

    <KeyboardShortcutsModal
      :show="showShortcutsModal"
      @close="showShortcutsModal = false"
    />

    <!-- 图标位置调整模式（浮动完成控制胶囊） -->
    <transition
      enter-active-class="transform transition ease-out duration-250"
      enter-from-class="-translate-y-8 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transform transition ease-in duration-200"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="-translate-y-8 opacity-0 scale-95"
    >
      <div 
        v-if="isReorderMode"
        class="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs backdrop-blur-xl shadow-2xl border border-white/10 select-none"
      >
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-medium text-slate-200">调整位置</span>
        </div>
        <button
          @click="isReorderMode = false"
          class="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium text-xs transition-all shadow-xs"
        >
          <Check class="w-3.5 h-3.5" />
          <span>完成</span>
        </button>
      </div>
    </transition>

    <!-- 右键上下文菜单 -->
    <ContextMenu
      :show="contextMenuState.show"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      :item="contextMenuState.item"
      @close="handleCloseContextMenu"
      @open-item="handleOpenInNewTab"
      @copy-url="handleCopyUrl"
      @refresh-icon="refreshItemIcon"
      @start-reorder="handleStartReorder"
      @edit-item="handleEditItem"
      @delete-item="handleDeleteItem"
    />

    <!-- 极简 Toast 反馈 -->
    <transition
      enter-active-class="transform transition ease-out duration-200"
      enter-from-class="translate-y-4 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transform transition ease-in duration-150"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-4 opacity-0 scale-95"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium shadow-2xl backdrop-blur-md pointer-events-none flex items-center gap-1.5 border border-white/10"
      >
        <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- 调整模式下专属浮动虚影 -->
    <div
      v-if="isReorderMode && activeFloatingCard"
      class="fixed top-0 left-0 pointer-events-none z-[9999999] will-change-transform"
      :style="floatingCardStyle"
    >
      <div class="glass-card w-[116px] h-[94px] p-2.5 rounded-2xl flex flex-col items-center justify-center bg-white/95 shadow-[0_20px_45px_-4px_rgba(59,130,246,0.32),0_8px_20px_-2px_rgba(0,0,0,0.12)] ring-2 ring-blue-500 scale-105 select-none">
        <div class="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <img
            v-if="getFloatingIcon(activeFloatingCard)"
            :src="getFloatingIcon(activeFloatingCard)"
            class="w-9 h-9 object-contain drop-shadow-md"
            @error="($event.target as HTMLElement).style.display = 'none'"
          />
          <div 
            v-else 
            class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs"
          >
            {{ activeFloatingCard.title.slice(0, 1) }}
          </div>
        </div>
        <div class="w-full mt-2 px-1 text-center">
          <span class="text-[11px] font-medium text-slate-700 truncate block tracking-tight leading-tight">
            {{ activeFloatingCard.title }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-flow-move {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
