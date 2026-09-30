<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { FolderPlus, Search, HelpCircle, CheckCircle2, Settings, Check } from 'lucide-vue-next'
import type { NavConfig, NavCategory, NavItem, NavSettings } from './types/nav'
import { 
  loadInitialConfig, 
  saveConfigToLocal, 
  exportConfigFile, 
  importConfigFile, 
  linkLocalConfigFile, 
  syncToLinkedFile,
  DEFAULT_CONFIG 
} from './services/storage'
import { extractSiteTitle, getFaviconUrl, normalizeUrl } from './utils/urlHelper'

import Header from './components/Header.vue'
import CategorySection from './components/CategorySection.vue'
import AddSiteModal from './components/AddSiteModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import EditCategoryModal from './components/EditCategoryModal.vue'
import BackgroundLayer from './components/BackgroundLayer.vue'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.vue'
import ContextMenu from './components/ContextMenu.vue'
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
const linkedFileName = ref<string | null>(null)

const searchQuery = ref('')
const showAddModal = ref(false)
const showSettingsModal = ref(false)
const showCategoryModal = ref(false)
const showShortcutsModal = ref(false)

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

const persistChanges = async () => {
  saveConfigToLocal(config.value)
  if (linkedFileName.value) {
    const success = await syncToLinkedFile(config.value)
    if (success) {
      showToast('已写回')
    }
  }
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

const handleGlobalDragOver = (e: DragEvent) => {
  if (isReorderMode.value && activeFloatingCard.value && e.clientX && e.clientY) {
    updateFloatingPointer(e.clientX, e.clientY)
  }
}

onMounted(async () => {
  config.value = await loadInitialConfig()
  isLoaded.value = true
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('dragover', handleGlobalDragOver, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('dragover', handleGlobalDragOver)
})

const isZenMode = ref(false)

// 全局活跃模态框状态判定
const hasActiveModal = computed(() => {
  return showAddModal.value || showSettingsModal.value || showCategoryModal.value || showShortcutsModal.value
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
      if (showShortcutsModal.value) {
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
        item.title.toLowerCase().includes(query) ||
        item.url.toLowerCase().includes(query)
      )
      return {
        ...cat,
        items: matchedItems
      }
    })
    .filter(cat => cat.items.length > 0)
})

const handleSearchSubmit = (query: string, engineBaseUrl: string) => {
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
    clearDragState()
    draggedCardInfo.value = null
  }
})

const handleDragStartCard = (payload: { categoryId: string; item: NavItem; index: number }) => {
  draggedCardInfo.value = payload
}

const handleDragEndCard = () => {
  draggedCardInfo.value = null
}

const handleDropCard = ({ targetCategoryId, targetIndex }: { targetCategoryId: string; targetIndex: number }) => {
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

const handleAddCategory = () => {
  const newCat: NavCategory = {
    id: 'cat-' + Date.now().toString(36),
    name: '新建分类',
    icon: 'folder',
    items: []
  }
  config.value.categories.push(newCat)
  persistChanges()
  handleEditCategory(newCat)
}

const handleEditCategory = (cat: NavCategory) => {
  editingCategory.value = cat
  showCategoryModal.value = true
}

const handleSaveCategory = (updatedCat: NavCategory) => {
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

const handleConnectFile = async () => {
  try {
    const res = await linkLocalConfigFile()
    config.value = res.config
    linkedFileName.value = res.fileName
    saveConfigToLocal(res.config)
    showToast('已关联')
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      alert(err.message || '关联失败')
    }
  }
}

const handleSyncFile = async () => {
  const success = await syncToLinkedFile(config.value)
  if (success) {
    showToast('已写回')
  } else {
    showToast('写回失败')
  }
}

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
        :linked-file-name="linkedFileName"
        v-model:search-query="searchQuery"
        @submit-search="handleSearchSubmit"
      />

      <!-- 分类站点列表 (左右留白充沛优雅，max-w-4xl 黄金居中) -->
      <main class="relative z-10 w-full max-w-4xl mx-auto px-6 sm:px-12 md:px-16 pb-28">
        <div v-if="filteredCategories.length > 0">
          <CategorySection
            v-for="cat in filteredCategories"
            :key="cat.id"
            :category="cat"
            :open-in-new-tab="config.settings.openInNewTab"
            :is-context-menu-active="activeContextMenuCategoryId === cat.id"
            :is-any-context-menu-active="contextMenuState.show"
            :is-reorder-mode="isReorderMode"
            :dragged-card="draggedCardInfo"
            @click-item="handleClickItem"
            @open-context-menu="handleOpenContextMenu"
            @add-item-to-category="openAddModal"
            @drop-url-on-category="handleDropUrlOnCategory"
            @edit-category="handleEditCategory"
            @delete-category="handleDeleteCategory"
            @start-reorder="handleStartReorder"
            @drag-start-card="handleDragStartCard"
            @drag-end-card="handleDragEndCard"
            @drop-card="handleDropCard"
          />
        </div>

        <!-- 搜索空状态 (极致降噪) -->
        <div 
          v-else-if="searchQuery.trim()" 
          class="max-w-xs mx-auto text-center py-16"
        >
          <div class="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col items-center">
            <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
              <Search class="w-5 h-5" />
            </div>
            <p class="text-xs font-medium text-slate-600 mb-4">无结果</p>
            <button
              @click="handleSearchSubmit(searchQuery, 'https://www.google.com/search?q=')"
              class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs shadow-blue-500/20 transition-all active:scale-95"
            >
              搜索
            </button>
          </div>
        </div>

        <!-- 底部添加分类 (无边框扁平设计) -->
        <div class="w-full flex justify-center pt-2 pb-6">
          <button
            @click="handleAddCategory"
            class="group flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-slate-100/80 text-slate-400 hover:text-blue-600 text-xs font-medium transition-all active:scale-95 select-none"
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
      :linked-file-name="linkedFileName"
      @close="showSettingsModal = false"
      @update-settings="handleUpdateSettings"
      @connect-file="handleConnectFile"
      @sync-file="handleSyncFile"
      @export-file="handleExportFile"
      @import-file="handleImportFile"
      @reset-default="handleResetDefault"
    />

    <EditCategoryModal
      :show="showCategoryModal"
      :category="editingCategory"
      @close="showCategoryModal = false"
      @save="handleSaveCategory"
      @delete="handleDeleteCategory"
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
