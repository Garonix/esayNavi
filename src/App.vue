<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { FolderPlus, HelpCircle, CheckCircle2, Settings, Check, Zap } from 'lucide-vue-next'
import type { NavConfig, NavCategory, NavItem, NavSettings } from './types/nav'
import { 
  loadInitialConfig, 
  saveConfigToLocal, 
  exportConfigFile, 
  importConfigFile, 
  DEFAULT_CONFIG 
} from './services/storage'
import { extractSiteTitle, getFaviconUrl, normalizeUrl, isDirectUrl, toDirectUrl } from './utils/urlHelper'
import { matchPinyinQuery } from './utils/pinyinHelper'
import { resolveSiteFavicon } from './services/faviconFetcher'
import { saveCachedIcon, initIconCache } from './services/iconCache'

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

const config = ref<NavConfig>({ ...DEFAULT_CONFIG })
const isLoaded = ref(false)

const searchQuery = ref('')
const showAddModal = ref(false)
const showSettingsModal = ref(false)
const showCategoryModal = ref(false)
const showShortcutsModal = ref(false)
const showTableEditorModal = ref(false)

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
const toastMessage = ref('')
let toastTimer: number | null = null

const showToast = (msg: string) => {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 1800)
}

const persistChanges = () => {
  saveConfigToLocal(config.value)
}

const getFloatingIcon = (item: NavItem) => {
  if (item.icon && item.icon.trim()) return item.icon.trim()
  return getFaviconUrl(item.url, item.title)
}

// 浮动卡片坐标计算：卡片标准尺寸 116px * 94px，图标几何正中心水平 58px，垂直 35.5px
// 鼠标指针严格、零误差（0.0px）对齐在图标几何正中心！
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
  // 拖拽阶段用户滑动滚轮或触控板双指时，保证视口顺畅滚动
  if (isReorderMode.value && activeFloatingCard.value) {
    // 原生滚轮在 Pointer 模式下完全通畅，提供即时响应保障
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

// 高频常用推荐流 (基于真实点击量加权提炼)
const frequentItems = computed<NavItem[]>(() => {
  if (!config.value.settings.showFrequentBar || searchQuery.value.trim()) return []
  const all: NavItem[] = []
  for (const cat of config.value.categories) {
    for (const item of cat.items) {
      if ((item.clickCount || 0) > 0) {
        all.push(item)
      }
    }
  }
  return all.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0)).slice(0, 8)
})

const handleUpdateFullConfig = (newConfig: NavConfig) => {
  config.value = newConfig
  persistChanges()
  showToast('云端配置已载入')
}

onMounted(async () => {
  await initIconCache()
  config.value = await loadInitialConfig()
  isLoaded.value = true
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true })
  window.addEventListener('pointerup', stopAutoScroll)
  window.addEventListener('dragover', handleGlobalDragOver, { passive: true })
  window.addEventListener('wheel', handleGlobalWheel, { passive: true })
  window.addEventListener('dragend', stopAutoScroll)
})

onUnmounted(() => {
  stopAutoScroll()
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

const isZenMode = ref(false)

// 全局活跃模态框状态判定
const hasActiveModal = computed(() => {
  return showAddModal.value || showSettingsModal.value || showCategoryModal.value || showShortcutsModal.value || showTableEditorModal.value
})

// 模态框打开时自动锁定页面背景滚动，关闭后无缝还原
watch(hasActiveModal, (isOpen) => {
  if (typeof document === 'undefined') return
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

const handleGlobalKeydown = (e: KeyboardEvent) => {
  // 1. 若当前存在打开的模态框：严格锁定操作区域，除 Escape 键外禁止响应任何背景快捷键
  if (hasActiveModal.value) {
    if (e.key === 'Escape') {
      if (showTableEditorModal.value) {
        showTableEditorModal.value = false
      } else if (showShortcutsModal.value) {
        showShortcutsModal.value = false
      } else if (showAddModal.value) {
        showAddModal.value = false
      } else if (showSettingsModal.value) {
        showSettingsModal.value = false
      } else if (showCategoryModal.value) {
        showCategoryModal.value = false
      }
    }
    return
  }

  // 2. 若右键菜单处于激活状态：仅响应 Escape 键关闭
  if (contextMenuState.value.show) {
    if (e.key === 'Escape') {
      handleCloseContextMenu()
    }
    return
  }

  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return

  if (e.code === 'Space') {
    e.preventDefault()
    isZenMode.value = !isZenMode.value
  } else if (e.key === 'Escape') {
    if (isReorderMode.value) {
      isReorderMode.value = false
    } else if (isZenMode.value) {
      isZenMode.value = false
    }
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    openAddModal()
  } else if (e.key === 'j' || e.key === 'J') {
    e.preventDefault()
    showTableEditorModal.value = true
  } else if (e.key === '/') {
    e.preventDefault()
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    searchInput?.focus()
  } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault()
    showShortcutsModal.value = !showShortcutsModal.value
  }
}

const handleRootDblClick = (e: MouseEvent) => {
  // 模态框打开或右键菜单激活时，禁止触发沉浸模式双击
  if (hasActiveModal.value || contextMenuState.value.show) return
  const target = e.target as HTMLElement
  if (target.closest('button, input, textarea, a, select, .glass-card, .glass-panel, form, .category-section')) return
  isZenMode.value = !isZenMode.value
}

const filteredCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return config.value.categories
  }

  return config.value.categories
    .map(cat => {
      const matchedItems = cat.items.filter(item => 
        matchPinyinQuery(item.title, item.url, query)
      )
      return {
        ...cat,
        items: matchedItems
      }
    })
    .filter(cat => cat.items.length > 0)
})

// 当前过滤状态下的全部卡片扁平列表 (供键盘无缝跨分类网格漫游)
const flatFilteredCards = computed<NavItem[]>(() => {
  const list: NavItem[] = []
  for (const cat of filteredCategories.value) {
    for (const item of cat.items) {
      list.push(item)
    }
  }
  return list
})

// 全键盘游标索引
const activeKeyboardIndex = ref<number>(-1)

const activeFocusedCard = computed<NavItem | null>(() => {
  if (
    activeKeyboardIndex.value >= 0 && 
    activeKeyboardIndex.value < flatFilteredCards.value.length
  ) {
    return flatFilteredCards.value[activeKeyboardIndex.value]
  }
  return null
})

// 搜索文字变化时，若有匹配结果自动激活首张卡片焦点
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
    if (activeKeyboardIndex.value === -1) {
      activeKeyboardIndex.value = 0
    } else {
      activeKeyboardIndex.value = (activeKeyboardIndex.value + 1) % total
    }
  } else {
    if (activeKeyboardIndex.value === -1) {
      activeKeyboardIndex.value = total - 1
    } else {
      activeKeyboardIndex.value = (activeKeyboardIndex.value - 1 + total) % total
    }
  }
}

const handleSelectFocusedCard = () => {
  if (activeFocusedCard.value) {
    const card = activeFocusedCard.value
    handleClickItem(card)
    if (config.value.settings.openInNewTab) {
      window.open(card.url, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = card.url
    }
  }
}

const handleClearFocus = () => {
  activeKeyboardIndex.value = -1
}

const handleOpenDirectUrl = (url: string) => {
  if (config.value.settings.openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = url
  }
}

const handleSearchSubmit = (query: string, engineBaseUrl: string) => {
  if (isDirectUrl(query)) {
    handleOpenDirectUrl(toDirectUrl(query))
    return
  }
  window.open(`${engineBaseUrl}${encodeURIComponent(query)}`, '_blank')
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

const handleSaveItem = ({ item, categoryId }: { item: NavItem; categoryId: string }) => {
  for (const cat of config.value.categories) {
    const idx = cat.items.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      cat.items.splice(idx, 1)
      break
    }
  }

  let targetCat = config.value.categories.find(c => c.id === categoryId)
  if (!targetCat) {
    targetCat = config.value.categories[0]
  }

  if (targetCat) {
    if (item.pinned) {
      // 置顶站点插入到置顶项的最前端
      targetCat.items.unshift(item)
    } else {
      targetCat.items.push(item)
    }
    persistChanges()
    showToast('已保存')
  }
}

const handleDeleteItem = (item: NavItem) => {
  const catId = contextMenuState.value.categoryId
  if (catId) {
    const cat = config.value.categories.find(c => c.id === catId)
    if (cat) {
      const idx = cat.items.findIndex(i => i.id === item.id)
      if (idx !== -1) {
        cat.items.splice(idx, 1)
        persistChanges()
        showToast('已删除')
        return
      }
    }
  }

  for (const cat of config.value.categories) {
    const idx = cat.items.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      cat.items.splice(idx, 1)
      persistChanges()
      showToast('已删除')
      break
    }
  }
}

// 图标位置调整模式 (类似手机 App 长按抖动排序)
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

  // 记录长按起步的主活动分类 ID（原地稳定模式核心：非活动分类绝不擅自膨胀，彻底消灭下方卡片被推搡位移的根源）
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

  const { categoryId: sourceCatId } = currentDrag
  const sourceCat = config.value.categories.find(c => c.id === sourceCatId)
  const targetCat = config.value.categories.find(c => c.id === targetCategoryId)

  if (!sourceCat || !targetCat) {
    clearDragState()
    draggedCardInfo.value = null
    return
  }

  // 1. 同分类内调整位置
  if (sourceCatId === targetCategoryId) {
    const itemIdx = sourceCat.items.findIndex(i => i.id === currentDrag.item.id)
    if (itemIdx === -1) {
      clearDragState()
      draggedCardInfo.value = null
      return
    }
    const [movedItem] = sourceCat.items.splice(itemIdx, 1)
    const clampedIndex = Math.max(0, Math.min(targetIndex, sourceCat.items.length))
    sourceCat.items.splice(clampedIndex, 0, movedItem)
  } else {
    // 2. 跨分类移动
    const itemIdx = sourceCat.items.findIndex(i => i.id === currentDrag.item.id)
    if (itemIdx !== -1) {
      const [movedItem] = sourceCat.items.splice(itemIdx, 1)
      const clampedIndex = Math.max(0, Math.min(targetIndex, targetCat.items.length))
      targetCat.items.splice(clampedIndex, 0, movedItem)
      showToast('已移动')
    }
  }

  persistChanges()
  clearDragState()
  draggedCardInfo.value = null
}

const handleClickItem = (item: NavItem) => {
  item.clickCount = (item.clickCount || 0) + 1
  saveConfigToLocal(config.value)
}

const openItemDirect = (item: NavItem) => {
  if (config.value.settings.openInNewTab) {
    window.open(item.url, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = item.url
  }
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

const handleRefreshIcon = async (item: NavItem) => {
  const originalIcon = item.icon
  showToast('正在获取')
  try {
    const newIcon = await resolveSiteFavicon(item.url, item.title)
    if (newIcon) {
      item.icon = newIcon
      await saveCachedIcon(item.id, newIcon)
      await saveCachedIcon(item.url, newIcon)
      await persistChanges()
      showToast('已更新')
    } else {
      // 若探测不到新图标，严格保留原图标
      item.icon = originalIcon
      showToast('已保留原图标')
    }
  } catch {
    item.icon = originalIcon
    showToast('已保留原图标')
  }
}

const handleDropUrlOnCategory = (categoryId: string, rawUrl: string) => {
  const finalUrl = normalizeUrl(rawUrl)
  const defaultTitle = extractSiteTitle(finalUrl)
  const favicon = getFaviconUrl(finalUrl)

  const newItem: NavItem = {
    id: 'item-' + Date.now().toString(36),
    title: defaultTitle,
    url: finalUrl,
    icon: favicon,
    createdAt: Date.now(),
    clickCount: 0
  }

  const cat = config.value.categories.find(c => c.id === categoryId)
  if (cat) {
    cat.items.push(newItem)
    persistChanges()
    showToast('已添加')
  }
}

const isCreatingCategory = ref(false)

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
  if (isCreatingCategory.value) {
    config.value.categories.push(updatedCat)
    persistChanges()
    showToast('已新建分类')
    isCreatingCategory.value = false
    return
  }

  const idx = config.value.categories.findIndex(c => c.id === updatedCat.id)
  if (idx !== -1) {
    config.value.categories[idx] = updatedCat
    persistChanges()
    showToast('已更新')
  }
}

const handleDeleteCategory = (categoryId: string) => {
  const idx = config.value.categories.findIndex(c => c.id === categoryId)
  if (idx !== -1) {
    config.value.categories.splice(idx, 1)
    persistChanges()
    showToast('已删除')
  }
}

// 分类排序微调与互换
const handleMoveCategory = (payload: { categoryId: string; direction: 'up' | 'down' }) => {
  const { categoryId, direction } = payload
  const list = config.value.categories
  const idx = list.findIndex(c => c.id === categoryId)
  if (idx === -1) return

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= list.length) return

  const temp = list[idx]
  list[idx] = list[targetIdx]
  list[targetIdx] = temp

  persistChanges()
  showToast(direction === 'up' ? '已上移分类' : '已下移分类')
}

const handleModalMoveCategory = (direction: 'up' | 'down') => {
  if (!editingCategory.value) return
  handleMoveCategory({ categoryId: editingCategory.value.id, direction })
}

const isEditingFirstCategory = computed(() => {
  if (!editingCategory.value || config.value.categories.length === 0) return true
  return config.value.categories[0].id === editingCategory.value.id
})

const isEditingLastCategory = computed(() => {
  if (!editingCategory.value || config.value.categories.length === 0) return true
  return config.value.categories[config.value.categories.length - 1].id === editingCategory.value.id
})

// 页面下方区域“新建分类”悬停感知 (解绑最后一个分类，给下方区域加上充沛的感知热区，避免鼠标挪动中途失焦而闪烁消失)
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

const handleExportFile = () => {
  exportConfigFile(config.value, 'easynavi.json')
  showToast('已导出')
}

const handleImportFile = async (file: File) => {
  try {
    const imported = await importConfigFile(file)
    config.value = imported
    persistChanges()
    showToast('已导入')
  } catch (e: any) {
    alert(e.message || '导入失败')
  }
}

const handleResetDefault = async () => {
  if (confirm('恢复默认配置？')) {
    localStorage.removeItem('easynavi_config_v5')
    config.value = await loadInitialConfig()
    showToast('已重置')
  }
}

const handleUpdateSettings = (newSettings: Partial<NavSettings>) => {
  config.value.settings = {
    ...config.value.settings,
    ...newSettings
  }
  persistChanges()
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
      <!-- 极简聚焦搜索栏 (左右对称对齐) -->
      <Header
        :settings="config.settings"
        v-model:search-query="searchQuery"
        :has-active-card-focus="!!activeFocusedCard"
        :focused-card-title="activeFocusedCard?.title"
        @submit-search="handleSearchSubmit"
        @open-direct-url="handleOpenDirectUrl"
        @navigate-cards="handleNavigateCards"
        @select-focused-card="handleSelectFocusedCard"
        @clear-focus="handleClearFocus"
      />

      <!-- 分类站点列表 (左右留白充沛优雅，max-w-4xl 黄金居中) -->
      <main class="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-12 md:px-16 pb-28">
        <!-- 高频常用智能推荐流 (点击加权自学习复利) -->
        <div v-if="frequentItems.length > 0" class="mb-5 px-1 select-none">
          <div class="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-slate-400">
            <Zap class="w-3 h-3 text-amber-500 fill-amber-500/20" />
            <span>高频常用</span>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5" style="scrollbar-width: none;">
            <div
              v-for="item in frequentItems"
              :key="'freq-' + item.id"
              @click="handleClickItem(item); openItemDirect(item)"
              class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-xs text-xs font-medium text-slate-700 transition-all cursor-pointer flex-shrink-0 active:scale-95 group shadow-2xs backdrop-blur-md"
            >
              <img
                v-if="item.icon"
                :src="item.icon"
                class="w-4 h-4 object-contain group-hover:scale-110 transition-transform pointer-events-none"
                @error="($event.target as HTMLElement).style.display = 'none'"
              />
              <span class="max-w-[80px] truncate text-slate-700 group-hover:text-blue-600 transition-colors">
                {{ item.title }}
              </span>
            </div>
          </div>
        </div>

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
            :is-context-menu-active="activeContextMenuCategoryId === cat.id"
            :is-any-context-menu-active="contextMenuState.show"
            :is-reorder-mode="isReorderMode"
            :dragged-card="draggedCardInfo"
            :focused-card-id="activeFocusedCard?.id"
            :is-first-category="idx === 0"
            :is-last-category="idx === filteredCategories.length - 1"
            :is-search-active="!!searchQuery.trim()"
            @click-item="handleClickItem"
            @open-context-menu="handleOpenContextMenu"
            @add-item-to-category="openAddModal"
            @drop-url-on-category="handleDropUrlOnCategory"
            @edit-category="handleEditCategory"
            @delete-category="handleDeleteCategory"
            @move-category="handleMoveCategory"
            @start-reorder="handleStartReorder"
            @drag-start-card="handleDragStartCard"
            @drag-end-card="handleDragEndCard"
            @drop-card="handleDropCard"
          />
        </TransitionGroup>

        <!-- 搜索空状态画卷胶囊流 (方案C: 物理卷轴级联波浪展开/收起) -->
        <SearchEmptyReel
          v-else-if="searchQuery.trim()"
          :show="filteredCategories.length === 0 && !!searchQuery.trim()"
          :search-query="searchQuery"
          :active-engine-id="config.settings.searchEngine || 'google'"
          @search="handleSearchSubmit"
        />

        <!-- 页面下方悬停感知区 (给下方区域加上充沛的 hover 感知，按钮自然浮现，绝不中途消失) -->
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

    <!-- 右下角固定微控制坞 (仅保留极简扁平设置与快捷键胶囊) -->
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
      @save="handleSaveItem"
    />

    <SettingsModal
      :show="showSettingsModal"
      :config="config"
      @close="showSettingsModal = false"
      @update-settings="handleUpdateSettings"
      @update-full-config="handleUpdateFullConfig"
      @export-file="handleExportFile"
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
      :is-creating="isCreatingCategory"
      :is-first-category="isEditingFirstCategory"
      :is-last-category="isEditingLastCategory"
      @close="showCategoryModal = false; isCreatingCategory = false"
      @save="handleSaveCategory"
      @delete="handleDeleteCategory"
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
      @refresh-icon="handleRefreshIcon"
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

    <!-- 调整模式下专属：超丝滑、零延迟、绝对跟手的高清浮动虚影 (Custom Floating Drag Ghost) -->
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
/* 分类换位 FLIP 平滑位移动画 */
.category-flow-move {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
