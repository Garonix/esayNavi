<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  Upload,
  Globe2,
  RotateCcw,
  Loader2
} from 'lucide-vue-next'
import type { NavCategory, NavItem } from '../types/nav'
import { 
  normalizeUrl, 
  extractSiteTitle, 
  getFaviconUrl, 
  getFallbackAvatar 
} from '../utils/urlHelper'
import { getHomelabIconUrl } from '../utils/homelabIcons'
import { 
  normalizeToCompactIcon, 
  extractImageFromClipboard, 
  extractImageFromDrag 
} from '../utils/imageHelper'

const props = defineProps<{
  show: boolean
  categories: NavCategory[]
  defaultCategoryId?: string
  editItemData?: NavItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { item: NavItem; categoryId: string }): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const iconFileInputRef = ref<HTMLInputElement | null>(null)

const url = ref('')
const title = ref('')
const icon = ref('')
const selectedCategoryId = ref('')
const showAdvanced = ref(false)
const previewIconError = ref(false)
const isProcessingIcon = ref(false)
const isDragging = ref(false)

watch(
  () => props.show,
  (val) => {
    if (val) {
      if (props.editItemData) {
        url.value = props.editItemData.url
        title.value = props.editItemData.title
        icon.value = props.editItemData.icon || ''
        selectedCategoryId.value = props.defaultCategoryId || props.categories[0]?.id || ''
        showAdvanced.value = true
      } else {
        url.value = ''
        title.value = ''
        icon.value = ''
        selectedCategoryId.value = props.defaultCategoryId || props.categories[0]?.id || ''
        showAdvanced.value = false
      }
      previewIconError.value = false
      isProcessingIcon.value = false
      isDragging.value = false

      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
)

const handleUrlInput = () => {
  if (!url.value.trim()) return

  const normalized = normalizeUrl(url.value)
  if (!props.editItemData && (!title.value || title.value === extractSiteTitle(url.value))) {
    title.value = extractSiteTitle(normalized)
  }
  if (!props.editItemData && !icon.value) {
    const homelab = getFaviconUrl(normalized, title.value)
    if (homelab) {
      icon.value = homelab
      previewIconError.value = false
    }
  }
}

const handleTitleInput = () => {
  const homelabIcon = getHomelabIconUrl(title.value)
  if (homelabIcon) {
    icon.value = homelabIcon
    previewIconError.value = false
  }
}

/**
 * 核心管线：处理并设置图标（保持宽高比、居中透明、128x128 紧凑 PNG）
 */
const processAndSetIcon = async (fileOrBlob: Blob | File) => {
  try {
    isProcessingIcon.value = true
    const compactDataUrl = await normalizeToCompactIcon(fileOrBlob, 128)
    icon.value = compactDataUrl
    previewIconError.value = false
  } catch (err) {
    console.error('图标规范化转换失败:', err)
  } finally {
    isProcessingIcon.value = false
  }
}

const handleIconUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    await processAndSetIcon(file)
    target.value = ''
  }
}

const handleModalPaste = async (e: ClipboardEvent) => {
  const imageFile = extractImageFromClipboard(e)
  if (imageFile) {
    e.preventDefault()
    await processAndSetIcon(imageFile)
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  // 避免进入子元素时闪烁
  const currentTarget = e.currentTarget as HTMLElement
  const relatedTarget = e.relatedTarget as Node
  if (!currentTarget.contains(relatedTarget)) {
    isDragging.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const imageFile = extractImageFromDrag(e)
  if (imageFile) {
    await processAndSetIcon(imageFile)
  }
}

const handleResetIcon = () => {
  const normalized = normalizeUrl(url.value)
  icon.value = getFaviconUrl(normalized, title.value)
  previewIconError.value = false
}

const handleSubmit = () => {
  if (!url.value.trim()) return

  const finalUrl = normalizeUrl(url.value)
  const finalTitle = title.value.trim() || extractSiteTitle(finalUrl)
  const finalIcon = icon.value.trim() || getFaviconUrl(finalUrl, finalTitle)

  const newItem: NavItem = {
    id: props.editItemData?.id || 'item-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: finalTitle,
    url: finalUrl,
    icon: finalIcon,
    pinned: props.editItemData?.pinned || false,
    createdAt: props.editItemData?.createdAt || Date.now(),
    clickCount: props.editItemData?.clickCount || 0
  }

  emit('save', {
    item: newItem,
    categoryId: selectedCategoryId.value || props.categories[0]?.id || 'flare'
  })
  emit('close')
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show"
        @keydown="handleKeydown"
        @click.self="$emit('close')"
        @paste="handleModalPaste"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200/90 relative transform transition-all duration-200"
        >
        <!-- 弹窗标题 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Globe2 class="w-4 h-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-900">
              {{ editItemData ? '编辑' : '添加' }}
            </h3>
          </div>
          <button
            @click="$emit('close')"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- 表单 -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">网址</label>
            <input
              ref="inputRef"
              v-model="url"
              @input="handleUrlInput"
              @paste="handleUrlInput"
              type="text"
              placeholder="网址"
              required
              class="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all font-mono"
            />
          </div>

          <!-- 自动识别预览卡片 (支持点击换图、拖拽放图与剪贴板粘贴) -->
          <div 
            v-if="url.trim()" 
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            :class="[
              'p-2.5 rounded-xl border flex items-center gap-3 transition-all relative',
              isDragging 
                ? 'bg-blue-50/80 border-dashed border-blue-400 ring-2 ring-blue-500/20 scale-[1.01]' 
                : 'bg-slate-50 border-slate-200/80'
            ]"
          >
            <!-- 点击更换图标触发器 -->
            <button
              type="button"
              @click="iconFileInputRef?.click()"
              title="更换图标"
              class="relative w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs group cursor-pointer hover:border-blue-400 transition-all"
            >
              <div v-if="isProcessingIcon" class="w-full h-full flex items-center justify-center bg-blue-50">
                <Loader2 class="w-4 h-4 animate-spin text-blue-600" />
              </div>
              <img
                v-else-if="icon && !previewIconError"
                :src="icon"
                @error="previewIconError = true"
                class="w-5 h-5 object-contain transition-transform group-hover:scale-105"
              />
              <div 
                v-else 
                class="w-full h-full bg-blue-50 text-blue-600 font-bold text-[11px] flex items-center justify-center"
              >
                {{ getFallbackAvatar(title || 'Site').letter }}
              </div>
              <!-- 悬浮小覆盖层 -->
              <div class="absolute inset-0 bg-blue-600/15 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload class="w-3.5 h-3.5 text-blue-700" />
              </div>
            </button>

            <div class="flex-1 min-w-0">
              <span class="text-xs font-semibold text-slate-800 truncate block">
                {{ title || url }}
              </span>
              <span class="text-[10px] font-mono text-slate-400 truncate block mt-0.5">
                {{ url }}
              </span>
            </div>
          </div>

          <!-- 展开高级设置 -->
          <div>
            <button
              type="button"
              @click="showAdvanced = !showAdvanced"
              class="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
            >
              <span>高级</span>
              <component :is="showAdvanced ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 高级配置项 -->
          <div v-if="showAdvanced" class="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">名称</label>
              <input
                v-model="title"
                @input="handleTitleInput"
                type="text"
                placeholder="名称"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">分类</label>
              <select
                v-model="selectedCategoryId"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              >
                <option 
                  v-for="cat in categories" 
                  :key="cat.id" 
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-medium text-slate-600">图标</label>
                <button
                  v-if="icon && icon.startsWith('data:')"
                  type="button"
                  @click="handleResetIcon"
                  class="text-[10px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors"
                  title="重置"
                >
                  <RotateCcw class="w-2.5 h-2.5" />
                  <span>重置</span>
                </button>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="icon"
                  type="text"
                  placeholder="链接"
                  class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                />
                <button
                  type="button"
                  :disabled="isProcessingIcon"
                  @click="iconFileInputRef?.click()"
                  class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-60 rounded-xl text-xs text-slate-700 font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  <Loader2 v-if="isProcessingIcon" class="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <Upload v-else class="w-3.5 h-3.5 text-slate-500" />
                  <span>上传</span>
                </button>
                <input
                  ref="iconFileInputRef"
                  type="file"
                  accept="image/*,.ico,.svg,.png,.jpg,.jpeg,.webp,.bmp,.gif"
                  class="hidden"
                  @change="handleIconUpload"
                />
              </div>
            </div>
          </div>

          <!-- 底部动作 -->
          <div class="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-3.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium shadow-xs shadow-blue-500/25 transition-all"
            >
              {{ editItemData ? '保存' : '添加' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </transition>
  </teleport>
</template>
