<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { X, Folder, Sparkles, CodeXml, Palette, FolderEdit, FolderPlus, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-vue-next'
import type { NavCategory } from '../types/nav'

const props = withDefaults(defineProps<{
  show: boolean
  category: NavCategory | null
  existingCategories?: NavCategory[]
  isCreating?: boolean
  isFirstCategory?: boolean
  isLastCategory?: boolean
}>(), {
  existingCategories: () => [],
  isCreating: false,
  isFirstCategory: false,
  isLastCategory: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', category: NavCategory): void
  (e: 'delete', categoryId: string): void
  (e: 'move', direction: 'up' | 'down'): void
}>()

const name = ref('')
const icon = ref('folder')
const showConfirmDelete = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// 校验分类名是否与已有其他分类重名 (忽略首尾空格，大小写不敏感)
const isDuplicateName = computed(() => {
  const clean = name.value.trim().toLowerCase()
  if (!clean) return false
  const currentId = props.category?.id
  return (props.existingCategories || []).some(cat => {
    if (currentId && cat.id === currentId) return false
    return cat.name.trim().toLowerCase() === clean
  })
})

const iconOptions = [
  { id: 'folder', name: '常规', icon: Folder },
  { id: 'sparkles', name: '精选', icon: Sparkles },
  { id: 'code-xml', name: '开发', icon: CodeXml },
  { id: 'palette', name: '设计', icon: Palette }
]

watch(
  () => props.show,
  (val) => {
    if (val) {
      showConfirmDelete.value = false
      nextTick(() => {
        inputRef.value?.focus()
        if (props.isCreating && name.value) {
          inputRef.value?.select()
        }
      })
    }
  }
)

watch(
  () => props.category,
  (val) => {
    if (val) {
      name.value = val.name
      icon.value = val.icon || 'folder'
    }
  },
  { immediate: true }
)

const handleSave = () => {
  if (!props.category || !name.value.trim() || isDuplicateName.value) return
  emit('save', {
    ...props.category,
    name: name.value.trim(),
    icon: icon.value
  })
  emit('close')
}

const handleConfirmDelete = () => {
  if (!props.category) return
  emit('delete', props.category.id)
  emit('close')
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
        @click.self="$emit('close')"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-xs rounded-2xl p-5 shadow-2xl border border-slate-200/90 relative transform transition-all duration-200 overflow-hidden"
        >
        <!-- 标题栏 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FolderPlus v-if="isCreating" class="w-3.5 h-3.5" />
              <FolderEdit v-else class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-sm font-semibold text-slate-900">{{ isCreating ? '新建分类' : '编辑分类' }}</h3>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="!isCreating && category && category.id !== 'flare' && category.id !== 'daily'"
              type="button"
              @click="showConfirmDelete = true"
              class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="删除分类"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              @click="$emit('close')"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 自研二次确认删除弹窗 (丝滑微缩放与毛玻璃动效) -->
        <transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-120 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div 
            v-if="showConfirmDelete" 
            class="absolute inset-0 bg-white/98 backdrop-blur-xl p-5 flex flex-col justify-between z-20"
          >
            <div class="flex items-center gap-3 pt-2">
              <div class="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                <AlertTriangle class="w-4 h-4" />
              </div>
              <h4 class="text-xs font-semibold text-slate-900">确认删除？</h4>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                @click="showConfirmDelete = false"
                class="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                @click="handleConfirmDelete"
                class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-medium shadow-xs shadow-rose-500/20 transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </transition>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">名称</label>
            <input
              ref="inputRef"
              v-model="name"
              type="text"
              placeholder="请输入分类名称"
              @keydown.enter.prevent="handleSave"
              class="w-full bg-slate-50 border rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white transition-all"
              :class="isDuplicateName 
                ? 'border-rose-300 focus:border-rose-500 ring-2 ring-rose-500/10' 
                : 'border-slate-200 focus:border-blue-500'"
            />
            <p v-if="isDuplicateName" class="text-[11px] text-rose-500 font-medium mt-1 flex items-center gap-1">
              <AlertTriangle class="w-3 h-3 text-rose-500" />
              <span>该分类名称已存在，请换一个名称</span>
            </p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">图标</label>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="opt in iconOptions"
                :key="opt.id"
                type="button"
                @click="icon = opt.id"
                class="flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-95 cursor-pointer"
                :class="icon === opt.id 
                  ? 'bg-blue-50 border-blue-400 text-blue-600 shadow-2xs font-semibold' 
                  : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
              >
                <component :is="opt.icon" class="w-3.5 h-3.5" />
                <span>{{ opt.name }}</span>
              </button>
            </div>
          </div>

          <!-- 显示顺序 (仅在编辑已有分类时展示) -->
          <div v-if="!isCreating">
            <label class="block text-xs font-medium text-slate-600 mb-1.5">显示顺序</label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isFirstCategory"
                @click="$emit('move', 'up')"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
                :class="isFirstCategory 
                  ? 'opacity-40 border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50' 
                  : 'border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 active:scale-95 cursor-pointer'"
              >
                <ChevronUp class="w-3.5 h-3.5" />
                <span>上移</span>
              </button>
              <button
                type="button"
                :disabled="isLastCategory"
                @click="$emit('move', 'down')"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
                :class="isLastCategory 
                  ? 'opacity-40 border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50' 
                  : 'border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 active:scale-95 cursor-pointer'"
              >
                <ChevronDown class="w-3.5 h-3.5" />
                <span>下移</span>
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="$emit('close')"
              class="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              :disabled="!name.trim() || isDuplicateName"
              @click="handleSave"
              class="px-4 py-1.5 rounded-xl text-xs font-medium transition-all"
              :class="name.trim() && !isDuplicateName
                ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs shadow-blue-500/25 cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
            >
              {{ isCreating ? '创建' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
  </teleport>
</template>
