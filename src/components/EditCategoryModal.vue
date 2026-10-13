<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Folder, Sparkles, CodeXml, Palette, FolderEdit, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-vue-next'
import type { NavCategory } from '../types/nav'

const props = defineProps<{
  show: boolean
  category: NavCategory | null
  isFirstCategory?: boolean
  isLastCategory?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', category: NavCategory): void
  (e: 'delete', categoryId: string): void
  (e: 'move', direction: 'up' | 'down'): void
}>()

const name = ref('')
const icon = ref('folder')
const showConfirmDelete = ref(false)

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
  if (!props.category || !name.value.trim()) return
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
              <FolderEdit class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-sm font-semibold text-slate-900">分类</h3>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="category && category.id !== 'flare' && category.id !== 'daily'"
              type="button"
              @click="showConfirmDelete = true"
              class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="删除"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              @click="$emit('close')"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
              v-model="name"
              type="text"
              placeholder="名称"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">图标</label>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="opt in iconOptions"
                :key="opt.id"
                type="button"
                @click="icon = opt.id"
                class="flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-95"
                :class="icon === opt.id 
                  ? 'bg-blue-50 border-blue-400 text-blue-600 shadow-2xs font-semibold' 
                  : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'"
              >
                <component :is="opt.icon" class="w-3.5 h-3.5" />
                <span>{{ opt.name }}</span>
              </button>
            </div>
          </div>

          <div>
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
              class="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              @click="handleSave"
              class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium shadow-xs shadow-blue-500/25 transition-all"
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
