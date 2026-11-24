<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { 
  X, 
  Table, 
  Plus, 
  Trash2, 
  Pin, 
  Upload, 
  Search, 
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-vue-next'
import type { NavConfig, NavCategory, NavItem } from '../types/nav'
import { normalizeToCompactIcon } from '../utils/imageHelper'
import { normalizeUrl, extractSiteTitle, getFallbackAvatar } from '../utils/urlHelper'
import { ensureUniqueItemIds } from '../services/storage'

const props = defineProps<{
  show: boolean
  config: NavConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newConfig: NavConfig): void
}>()

interface TableRow {
  id: string
  title: string
  url: string
  categoryName: string
  icon: string
  pinned: boolean
}

const rows = ref<TableRow[]>([])
const searchFilter = ref('')
const existingCategoryMap = ref<Map<string, { id: string; icon?: string }>>(new Map())
const existingCategoryNames = ref<string[]>([])
const activeUploadRowIndex = ref<number | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 当前展开分类下拉菜单的行 ID 及空白新增输入内容
const activeDropdownRowId = ref<string | null>(null)
const newCategoryInput = ref('')

// 分类删除相关状态与警告
const categoryPendingDelete = ref<string | null>(null)
const categoryDeleteWarning = ref<string | null>(null)
let warningTimer: ReturnType<typeof setTimeout> | null = null
let dropdownBlurTimer: ReturnType<typeof setTimeout> | null = null

// 站点行多选与批量操作
const selectedRowIds = ref<Set<string>>(new Set())
const batchCategoryDropdownOpen = ref(false)

const handleGlobalClick = () => {
  activeDropdownRowId.value = null
  newCategoryInput.value = ''
  batchCategoryDropdownOpen.value = false
  categoryPendingDelete.value = null
  categoryDeleteWarning.value = null
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
  if (warningTimer) clearTimeout(warningTimer)
  if (dropdownBlurTimer) clearTimeout(dropdownBlurTimer)
})

const showCategoryWarning = (msg: string) => {
  categoryDeleteWarning.value = msg
  if (warningTimer) clearTimeout(warningTimer)
  warningTimer = setTimeout(() => {
    categoryDeleteWarning.value = null
  }, 2500)
}

const toggleDropdown = (rowId: string, e: MouseEvent) => {
  e.stopPropagation()
  batchCategoryDropdownOpen.value = false
  if (activeDropdownRowId.value === rowId) {
    activeDropdownRowId.value = null
    newCategoryInput.value = ''
    categoryPendingDelete.value = null
    categoryDeleteWarning.value = null
  } else {
    activeDropdownRowId.value = rowId
    newCategoryInput.value = ''
    categoryPendingDelete.value = null
    categoryDeleteWarning.value = null
  }
}

// 分类单元格失焦自动关闭（利用 FocusEvent 检测焦点是否真正离开单元格）
const handleCategoryCellFocusOut = (rowId: string, e: FocusEvent) => {
  const currentTarget = e.currentTarget as HTMLElement | null
  const relatedTarget = e.relatedTarget as HTMLElement | null

  // 若焦点移向了本单元格内部的输入框或按钮，不关闭
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return
  }

  if (dropdownBlurTimer) clearTimeout(dropdownBlurTimer)
  dropdownBlurTimer = setTimeout(() => {
    if (activeDropdownRowId.value === rowId) {
      if (currentTarget && document.activeElement && currentTarget.contains(document.activeElement)) {
        return
      }
      activeDropdownRowId.value = null
      newCategoryInput.value = ''
      categoryPendingDelete.value = null
      categoryDeleteWarning.value = null
    }
  }, 160)
}

const selectCategory = (row: TableRow, name: string) => {
  row.categoryName = name
  activeDropdownRowId.value = null
  newCategoryInput.value = ''
  categoryPendingDelete.value = null
  categoryDeleteWarning.value = null
}

// 删除分类操作（若占用则提示禁止，若未占用需二次确认）
const handleDeleteCategoryClick = (catName: string, e: MouseEvent) => {
  e.stopPropagation()
  const isUsedByAnyRow = rows.value.some(r => r.categoryName.trim() === catName)
  if (isUsedByAnyRow) {
    showCategoryWarning(`「${catName}」下已有站点，不允许删除`)
    categoryPendingDelete.value = null
    return
  }

  if (categoryPendingDelete.value === catName) {
    // 二次确认，真正执行删除
    existingCategoryNames.value = existingCategoryNames.value.filter(n => n !== catName)
    existingCategoryMap.value.delete(catName)
    categoryPendingDelete.value = null
    categoryDeleteWarning.value = null
  } else {
    // 首次点击，进入二次确认态
    categoryPendingDelete.value = catName
    categoryDeleteWarning.value = null
  }
}

// 在空白新增位失焦或回车后自动创建新分类
const handleCreateCategoryOnBlur = (row: TableRow) => {
  const trimmed = newCategoryInput.value.trim()
  if (!trimmed) return

  // 查重（不区分大小写）
  const matchedExisting = existingCategoryNames.value.find(
    name => name.toLowerCase() === trimmed.toLowerCase()
  )

  if (!matchedExisting) {
    // 自动新建新分类并加入现有分类列表
    existingCategoryNames.value.push(trimmed)
    existingCategoryMap.value.set(trimmed, {
      id: `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      icon: 'folder'
    })
    row.categoryName = trimmed
  } else {
    // 若重名，自动归入该已有分类，避免重复创建
    row.categoryName = matchedExisting
  }

  newCategoryInput.value = ''
  activeDropdownRowId.value = null
  categoryPendingDelete.value = null
  categoryDeleteWarning.value = null
}

// 检查是否存在未填写完整名称或网址的行
const hasIncompleteRows = computed(() => {
  return rows.value.some(r => !r.title.trim() || !r.url.trim())
})

// 初始化表格数据
watch(
  () => props.show,
  (val) => {
    if (val) {
      searchFilter.value = ''
      activeDropdownRowId.value = null
      newCategoryInput.value = ''
      const list: TableRow[] = []
      const catMap = new Map<string, { id: string; icon?: string }>()
      const catNames: string[] = []

      for (const cat of props.config.categories) {
        catMap.set(cat.name.trim(), { id: cat.id, icon: cat.icon })
        catNames.push(cat.name.trim())

        if (Array.isArray(cat.items)) {
          for (const item of cat.items) {
            list.push({
              id: item.id || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              title: item.title || '',
              url: item.url || '',
              categoryName: cat.name.trim(),
              icon: item.icon || '',
              pinned: !!item.pinned
            })
          }
        }
      }

      rows.value = list
      existingCategoryMap.value = catMap
      existingCategoryNames.value = catNames
      selectedRowIds.value.clear()
      batchCategoryDropdownOpen.value = false
      categoryPendingDelete.value = null
      categoryDeleteWarning.value = null
    }
  }
)

// 过滤后的行
const filteredRows = computed(() => {
  const query = searchFilter.value.trim().toLowerCase()
  if (!query) return rows.value
  return rows.value.filter(r => 
    r.title.toLowerCase().includes(query) ||
    r.url.toLowerCase().includes(query) ||
    r.categoryName.toLowerCase().includes(query)
  )
})

// 多选与批量操作
const isAllFilteredSelected = computed(() => {
  if (filteredRows.value.length === 0) return false
  return filteredRows.value.every(r => selectedRowIds.value.has(r.id))
})

const isIndeterminate = computed(() => {
  if (selectedRowIds.value.size === 0) return false
  return !isAllFilteredSelected.value && filteredRows.value.some(r => selectedRowIds.value.has(r.id))
})

const toggleSelectAll = () => {
  if (isAllFilteredSelected.value) {
    for (const r of filteredRows.value) {
      selectedRowIds.value.delete(r.id)
    }
  } else {
    for (const r of filteredRows.value) {
      selectedRowIds.value.add(r.id)
    }
  }
}

const toggleSelectRow = (rowId: string) => {
  if (selectedRowIds.value.has(rowId)) {
    selectedRowIds.value.delete(rowId)
  } else {
    selectedRowIds.value.add(rowId)
  }
}

const clearSelection = () => {
  selectedRowIds.value.clear()
}

// 批量删除已选站点
const handleBatchDelete = () => {
  if (selectedRowIds.value.size === 0) return
  rows.value = rows.value.filter(r => !selectedRowIds.value.has(r.id))
  selectedRowIds.value.clear()
}

// 批量修改已选站点的分类
const handleBatchSetCategory = (catName: string) => {
  for (const r of rows.value) {
    if (selectedRowIds.value.has(r.id)) {
      r.categoryName = catName
    }
  }
  batchCategoryDropdownOpen.value = false
}

// 统计信息
const stats = computed(() => {
  const catSet = new Set<string>()
  for (const r of rows.value) {
    if (r.categoryName.trim()) catSet.add(r.categoryName.trim())
  }
  return {
    totalItems: rows.value.length,
    totalCategories: catSet.size
  }
})

// 新增一行站点（未填完名称和网址前禁止新增）
const handleAddRow = () => {
  if (hasIncompleteRows.value) return

  const defaultCategory = existingCategoryNames.value[0] || '常用应用'
  const newRow: TableRow = {
    id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    url: '',
    categoryName: defaultCategory,
    icon: '',
    pinned: false
  }
  rows.value.unshift(newRow)
}

// 删除某行
const handleDeleteRow = (targetId: string) => {
  rows.value = rows.value.filter(r => r.id !== targetId)
  selectedRowIds.value.delete(targetId)
}

// 触发图片上传
const triggerUpload = (row: TableRow) => {
  const index = rows.value.findIndex(r => r.id === row.id)
  if (index !== -1) {
    activeUploadRowIndex.value = index
    fileInputRef.value?.click()
  }
}

// 处理图片上传
const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0] && activeUploadRowIndex.value !== null) {
    try {
      const file = target.files[0]
      const compactDataUrl = await normalizeToCompactIcon(file, 128)
      if (rows.value[activeUploadRowIndex.value]) {
        rows.value[activeUploadRowIndex.value].icon = compactDataUrl
      }
    } catch (err) {
      console.error('图标规范化失败:', err)
    } finally {
      activeUploadRowIndex.value = null
      target.value = ''
    }
  }
}

// 网址失焦时智能补充标题
const handleUrlBlur = (row: TableRow) => {
  if (row.url.trim() && !row.title.trim()) {
    row.title = extractSiteTitle(row.url)
  }
}

// 保存并转化回 NavConfig 结构
const handleSave = () => {
  if (hasIncompleteRows.value) return

  const validRows = rows.value.filter(r => r.url.trim() && r.title.trim())

  const categoryOrder: string[] = []
  const groupedItems = new Map<string, TableRow[]>()

  for (const catName of existingCategoryNames.value) {
    categoryOrder.push(catName)
    groupedItems.set(catName, [])
  }

  for (const row of validRows) {
    const catName = row.categoryName.trim() || '未分类'
    if (!groupedItems.has(catName)) {
      categoryOrder.push(catName)
      groupedItems.set(catName, [])
    }
    groupedItems.get(catName)!.push(row)
  }

  const newCategories: NavCategory[] = []
  for (const catName of categoryOrder) {
    const itemsInCat = groupedItems.get(catName) || []
    if (itemsInCat.length > 0 || existingCategoryMap.value.has(catName)) {
      const existingMeta = existingCategoryMap.value.get(catName)
      const catId = existingMeta?.id || `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const catIcon = existingMeta?.icon || 'folder'

      const mappedItems: NavItem[] = itemsInCat.map(r => ({
        id: r.id,
        title: r.title.trim() || extractSiteTitle(r.url),
        url: normalizeUrl(r.url),
        icon: r.icon.trim(),
        pinned: r.pinned
      }))

      newCategories.push({
        id: catId,
        name: catName,
        icon: catIcon,
        items: mappedItems
      })
    }
  }

  const updatedConfig: NavConfig = {
    ...props.config,
    categories: newCategories
  }

  ensureUniqueItemIds(updatedConfig)
  emit('save', updatedConfig)
  emit('close')
}
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="show"
        @click.self="$emit('close')"
        class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-5xl rounded-2xl p-5 shadow-2xl border border-slate-200/90 flex flex-col h-[88vh] max-h-[850px] overflow-hidden transform transition-all"
        >
          <!-- 头部操作栏 -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Table class="w-4 h-4" />
              </div>
              <h3 class="text-sm font-semibold text-slate-900">站点管理</h3>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative w-40 sm:w-56">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="searchFilter"
                  type="text"
                  placeholder="搜索"
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <!-- 新增站点按钮：未填写完名称和网址前置灰禁用 -->
              <button
                type="button"
                @click="handleAddRow"
                :disabled="hasIncompleteRows"
                class="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all"
                :class="hasIncompleteRows 
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 active:scale-95 cursor-pointer'"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>新增</span>
              </button>

              <button
                type="button"
                @click="$emit('close')"
                class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 隐藏的文件上传输入框 -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileChange"
          />

          <!-- 批量操作工具栏（当勾选一行或多行时显式出现） -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-[0.99]"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-1 scale-[0.99]"
          >
            <div 
              v-if="selectedRowIds.size > 0"
              class="mt-2.5 px-3 py-1.5 bg-blue-50/90 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs text-blue-900 select-none shadow-2xs"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium text-blue-950">已选择 {{ selectedRowIds.size }} 项</span>
                <span class="text-blue-300">|</span>
                <button 
                  type="button" 
                  @click="clearSelection" 
                  class="text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  取消选择
                </button>
              </div>

              <div class="flex items-center gap-2">
                <!-- 批量修改分类下拉菜单 -->
                <div class="relative">
                  <button
                    type="button"
                    @click.stop="batchCategoryDropdownOpen = !batchCategoryDropdownOpen"
                    class="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>修改分类</span>
                    <ChevronDown class="w-3 h-3 transition-transform" :class="batchCategoryDropdownOpen ? 'rotate-180' : ''" />
                  </button>

                  <div
                    v-if="batchCategoryDropdownOpen"
                    @click.stop
                    class="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 max-h-48 overflow-y-auto"
                  >
                    <div
                      v-for="catName in existingCategoryNames"
                      :key="catName"
                      @click="handleBatchSetCategory(catName)"
                      class="px-3 py-1.5 hover:bg-blue-50 hover:text-blue-600 cursor-pointer flex items-center justify-between text-slate-700 text-xs"
                    >
                      <span class="truncate">{{ catName }}</span>
                    </div>
                  </div>
                </div>

                <!-- 批量删除按钮 -->
                <button
                  type="button"
                  @click="handleBatchDelete"
                  class="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              </div>
            </div>
          </transition>

          <!-- 表格主体工作区 -->
          <div class="flex-1 my-3 overflow-auto border border-slate-200/90 rounded-xl bg-white shadow-2xs">
            <table class="w-full border-collapse text-left text-xs">
              <!-- 表头 -->
              <thead class="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-slate-600 font-semibold select-none">
                <tr>
                  <th class="py-2.5 px-3 w-8 text-center">
                    <input 
                      type="checkbox" 
                      :checked="isAllFilteredSelected"
                      :indeterminate.prop="isIndeterminate"
                      @change="toggleSelectAll"
                      class="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th class="py-2.5 px-2 w-10 text-center">置顶</th>
                  <th class="py-2.5 px-3 w-40">名称</th>
                  <th class="py-2.5 px-3 min-w-[200px]">网址</th>
                  <th class="py-2.5 px-3 w-48">分类</th>
                  <th class="py-2.5 px-3 min-w-[200px]">图标</th>
                  <th class="py-2.5 px-3 w-14 text-center">操作</th>
                </tr>
              </thead>

              <!-- 表格体 -->
              <tbody class="divide-y divide-slate-100">
                <tr 
                  v-for="row in filteredRows" 
                  :key="row.id"
                  class="transition-colors group"
                  :class="selectedRowIds.has(row.id) ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50/80'"
                >
                  <!-- 0. 多选复选框 -->
                  <td class="py-1.5 px-3 text-center" @click.stop>
                    <input 
                      type="checkbox" 
                      :checked="selectedRowIds.has(row.id)"
                      @change="toggleSelectRow(row.id)"
                      class="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </td>

                  <!-- 1. 置顶状态 -->
                  <td class="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      @click="row.pinned = !row.pinned"
                      class="p-1 rounded transition-colors"
                      :class="row.pinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500'"
                      title="置顶"
                    >
                      <Pin class="w-3.5 h-3.5 transform" :class="row.pinned ? 'rotate-45' : ''" />
                    </button>
                  </td>

                  <!-- 2. 名称 -->
                  <td class="py-1.5 px-2">
                    <input
                      v-model="row.title"
                      type="text"
                      placeholder="名称"
                      class="w-full bg-transparent hover:bg-slate-100/60 focus:bg-white border rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none transition-colors"
                      :class="!row.title.trim() && row.url.trim() ? 'border-amber-300 bg-amber-50/30' : 'border-transparent hover:border-slate-200 focus:border-blue-500'"
                    />
                  </td>

                  <!-- 3. 网址 -->
                  <td class="py-1.5 px-2">
                    <input
                      v-model="row.url"
                      @blur="handleUrlBlur(row)"
                      type="text"
                      placeholder="https://..."
                      class="w-full bg-transparent hover:bg-slate-100/60 focus:bg-white border rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:outline-none transition-colors"
                      :class="row.title.trim() && !row.url.trim() ? 'border-amber-300 bg-amber-50/30' : 'border-transparent hover:border-slate-200 focus:border-blue-500'"
                    />
                  </td>

                  <!-- 4. 分类 (带空白新增位下拉框，失焦自动关闭，支持分类删除与防误删校验) -->
                  <td class="py-1.5 px-2 relative" @focusout="handleCategoryCellFocusOut(row.id, $event)">
                    <div class="relative flex items-center">
                      <input
                        v-model="row.categoryName"
                        type="text"
                        placeholder="分类"
                        @click="toggleDropdown(row.id, $event)"
                        class="w-full bg-slate-50/90 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-lg pl-2 pr-6 py-1 text-xs text-slate-800 focus:outline-none transition-colors cursor-text"
                      />
                      <button
                        type="button"
                        @click="toggleDropdown(row.id, $event)"
                        class="absolute right-1 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                        tabindex="-1"
                      >
                        <ChevronDown 
                          class="w-3 h-3 transition-transform duration-150" 
                          :class="activeDropdownRowId === row.id ? 'rotate-180 text-blue-600' : ''" 
                        />
                      </button>
                    </div>

                    <!-- 下拉面板：顶部包含空白新增位，下方完整展示全部分类 -->
                    <div
                      v-if="activeDropdownRowId === row.id"
                      @click.stop
                      class="absolute top-full left-2 right-2 mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden select-none ring-1 ring-black/5"
                    >
                      <!-- 警告提示条：当尝试删除带有站点的分类时展现 -->
                      <div 
                        v-if="categoryDeleteWarning"
                        class="px-2.5 py-1.5 bg-rose-50 border-b border-rose-100 text-[11px] text-rose-600 flex items-center gap-1.5 font-medium animate-pulse"
                      >
                        <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />
                        <span class="truncate">{{ categoryDeleteWarning }}</span>
                      </div>

                      <!-- 专属空白新增位 -->
                      <div class="p-1.5 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <Plus class="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <input
                          v-model="newCategoryInput"
                          @click.stop
                          @blur="handleCreateCategoryOnBlur(row)"
                          @keydown.enter.prevent="handleCreateCategoryOnBlur(row)"
                          type="text"
                          placeholder="新增分类"
                          class="w-full bg-white border border-slate-200 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                        />
                      </div>

                      <!-- 已有分类完整列表 -->
                      <div class="max-h-44 overflow-y-auto py-1">
                        <div
                          v-for="catName in existingCategoryNames"
                          :key="catName"
                          @click="selectCategory(row, catName)"
                          class="px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer flex items-center justify-between transition-colors group/cat"
                          :class="row.categoryName.trim() === catName ? 'bg-slate-50 font-medium text-blue-600' : ''"
                        >
                          <div class="flex items-center gap-1.5 truncate mr-1">
                            <span class="truncate">{{ catName }}</span>
                            <Check v-if="row.categoryName.trim() === catName" class="w-3 h-3 text-blue-600 flex-shrink-0" />
                          </div>

                          <!-- 删除分类按钮与二次确认 -->
                          <div class="flex items-center flex-shrink-0" @click.stop>
                            <button
                              v-if="categoryPendingDelete === catName"
                              type="button"
                              @click="handleDeleteCategoryClick(catName, $event)"
                              class="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded hover:bg-rose-600 font-medium transition-colors"
                              title="确认"
                            >
                              确认
                            </button>
                            <button
                              v-else
                              type="button"
                              @click="handleDeleteCategoryClick(catName, $event)"
                              class="p-0.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover/cat:opacity-100"
                              title="删除"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- 5. 图标 -->
                  <td class="py-1.5 px-2">
                    <div class="flex items-center gap-1.5">
                      <div class="w-6 h-6 rounded-md bg-slate-100 border border-slate-200/70 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img 
                          v-if="row.icon" 
                          :src="row.icon" 
                          @error="($event.target as HTMLElement).style.display = 'none'"
                          class="w-5 h-5 object-contain" 
                        />
                        <span v-else class="text-[10px] font-bold text-slate-400">
                          {{ getFallbackAvatar(row.title || 'S').letter }}
                        </span>
                      </div>

                      <input
                        v-model="row.icon"
                        type="text"
                        placeholder="图标"
                        class="flex-1 bg-transparent hover:bg-slate-100/60 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:outline-none transition-colors truncate"
                      />

                      <button
                        type="button"
                        @click="triggerUpload(row)"
                        title="上传"
                        class="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 bg-white flex-shrink-0 transition-colors"
                      >
                        <Upload class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  <!-- 6. 行操作 -->
                  <td class="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      @click="handleDeleteRow(row.id)"
                      class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredRows.length === 0">
                  <td colspan="7" class="py-12 text-center text-slate-400 text-xs">
                    无匹配数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 底部动作与统计栏 -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-2 text-xs">
              <span class="text-slate-500">
                {{ stats.totalItems }} 站点 · {{ stats.totalCategories }} 分类
              </span>
              <span v-if="hasIncompleteRows" class="text-amber-500 flex items-center gap-1 font-medium">
                <AlertCircle class="w-3.5 h-3.5" />
                <span>待补全</span>
              </span>
            </div>

            <!-- 操作按钮：未填写完整前禁止保存 -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="$emit('close')"
                class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                @click="handleSave"
                :disabled="hasIncompleteRows || rows.length === 0"
                class="px-4 py-1.5 rounded-xl text-xs font-medium transition-all shadow-xs"
                :class="(hasIncompleteRows || rows.length === 0)
                  ? 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
