<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Table, 
  Plus, 
  Trash2, 
  Pin, 
  Upload, 
  Search, 
  CheckCircle2
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

// 初始化表格数据
watch(
  () => props.show,
  (val) => {
    if (val) {
      searchFilter.value = ''
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

// 新增一行站点
const handleAddRow = () => {
  const defaultCategory = existingCategoryNames.value[0] || '默认分类'
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
  // 1. 过滤掉完全无意义的空行
  const validRows = rows.value.filter(r => r.url.trim() || r.title.trim())

  // 2. 按分类名称聚合
  const categoryOrder: string[] = []
  const groupedItems = new Map<string, TableRow[]>()

  // 保持原有分类顺序优先
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

  // 3. 构建新的分类列表
  const newCategories: NavCategory[] = []
  for (const catName of categoryOrder) {
    const itemsInCat = groupedItems.get(catName) || []
    // 如果该分类下有卡片，或者它是原本就存在分类，则予以保留
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
              <h3 class="text-sm font-semibold text-slate-900">批量表格管理</h3>
            </div>

            <div class="flex items-center gap-2">
              <!-- 快捷搜索 -->
              <div class="relative w-40 sm:w-56">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="searchFilter"
                  type="text"
                  placeholder="过滤站点..."
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <!-- 添加站点按钮 -->
              <button
                type="button"
                @click="handleAddRow"
                class="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 rounded-lg text-xs font-medium transition-colors active:scale-95"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>新增</span>
              </button>

              <!-- 关闭按钮 -->
              <button
                type="button"
                @click="$emit('close')"
                class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 预留的分类 datalist (供所有分类输入框快捷选择已有或直接打字新建) -->
          <datalist id="category-datalist">
            <option v-for="name in existingCategoryNames" :key="name" :value="name" />
          </datalist>

          <!-- 隐藏的文件上传输入框 -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileChange"
          />

          <!-- 表格主体工作区 (高密度表格，支持独立纵向滚动) -->
          <div class="flex-1 my-3 overflow-auto border border-slate-200/90 rounded-xl bg-white shadow-2xs">
            <table class="w-full border-collapse text-left text-xs">
              <!-- 表头 -->
              <thead class="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-slate-600 font-semibold select-none">
                <tr>
                  <th class="py-2.5 px-3 w-10 text-center">置顶</th>
                  <th class="py-2.5 px-3 w-40">名称</th>
                  <th class="py-2.5 px-3 min-w-[200px]">网址</th>
                  <th class="py-2.5 px-3 w-44">分类 (可直接输入新分类)</th>
                  <th class="py-2.5 px-3 min-w-[200px]">图标 (链接或上传)</th>
                  <th class="py-2.5 px-3 w-14 text-center">操作</th>
                </tr>
              </thead>

              <!-- 表格体 -->
              <tbody class="divide-y divide-slate-100">
                <tr 
                  v-for="row in filteredRows" 
                  :key="row.id"
                  class="hover:bg-slate-50/80 transition-colors group"
                >
                  <!-- 1. 置顶状态 -->
                  <td class="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      @click="row.pinned = !row.pinned"
                      class="p-1 rounded transition-colors"
                      :class="row.pinned ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500'"
                      title="切换置顶"
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
                      class="w-full bg-transparent hover:bg-slate-100/60 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none transition-colors"
                    />
                  </td>

                  <!-- 3. 网址 -->
                  <td class="py-1.5 px-2">
                    <input
                      v-model="row.url"
                      @blur="handleUrlBlur(row)"
                      type="text"
                      placeholder="https://..."
                      class="w-full bg-transparent hover:bg-slate-100/60 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:outline-none transition-colors"
                    />
                  </td>

                  <!-- 4. 分类 (可输入任意新分类或下拉选择已有) -->
                  <td class="py-1.5 px-2">
                    <div class="relative">
                      <input
                        v-model="row.categoryName"
                        list="category-datalist"
                        type="text"
                        placeholder="分类名称"
                        class="w-full bg-slate-50/90 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none transition-colors"
                      />
                    </div>
                  </td>

                  <!-- 5. 图标 (预览 + 链接输入 + 本地上传按钮) -->
                  <td class="py-1.5 px-2">
                    <div class="flex items-center gap-1.5">
                      <!-- 图标缩略预览 -->
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

                      <!-- 图标 URL 输入框 -->
                      <input
                        v-model="row.icon"
                        type="text"
                        placeholder="图标 URL 或点击右侧上传"
                        class="flex-1 bg-transparent hover:bg-slate-100/60 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:outline-none transition-colors truncate"
                      />

                      <!-- 本地上传触发按钮 -->
                      <button
                        type="button"
                        @click="triggerUpload(row)"
                        title="上传本地图片作为图标"
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
                      title="删除该站点"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>

                <!-- 空数据提示 -->
                <tr v-if="filteredRows.length === 0">
                  <td colspan="6" class="py-12 text-center text-slate-400 text-xs">
                    未找到相关站点记录，点击右上角「新增」即可添加
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 底部动作与统计栏 -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 class="w-3.5 h-3.5 text-blue-500" />
              <span>共 {{ stats.totalItems }} 个站点 · {{ stats.totalCategories }} 个分类</span>
            </div>

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
                class="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs active:scale-95"
              >
                保存并应用
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
