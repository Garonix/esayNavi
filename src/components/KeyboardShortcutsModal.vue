<script setup lang="ts">
import { X, Command } from 'lucide-vue-next'

defineProps<{
  show: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()

const shortcuts = [
  { key: '/', name: '聚焦搜索' },
  { key: '↓ / Tab', name: '遍历卡片' },
  { key: 'Enter', name: '直达选定' },
  { key: 'g / b / gh', name: 'Bang 直达' },
  { key: 'N', name: '添加站点' },
  { key: 'J', name: '批量管理' },
  { key: 'Space', name: '沉浸视窗' },
  { key: '右键', name: '快捷菜单' },
  { key: '?', name: '帮助指南' },
  { key: 'Esc', name: '关闭/取消' }
]
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
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-xs rounded-2xl p-5 shadow-2xl border border-slate-200/90 relative transform transition-all"
        >
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Command class="w-3.5 h-3.5" />
              </div>
              <h3 class="text-sm font-semibold text-slate-900">快捷键</h3>
            </div>
            <button
              @click="$emit('close')"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-1.5">
            <div 
              v-for="s in shortcuts" 
              :key="s.key"
              class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100/80"
            >
              <span class="text-xs font-medium text-slate-700">{{ s.name }}</span>
              <span class="keycap text-xs px-2 py-0.5">{{ s.key }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
