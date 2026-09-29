<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  ExternalLink, 
  Move, 
  Edit3, 
  Copy, 
  Trash2 
} from 'lucide-vue-next'
import type { NavItem } from '../types/nav'

const props = defineProps<{
  show: boolean
  x: number
  y: number
  item: NavItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openItem', item: NavItem, inNewTab: boolean): void
  (e: 'startReorder', item: NavItem): void
  (e: 'editItem', item: NavItem): void
  (e: 'copyUrl', item: NavItem): void
  (e: 'deleteItem', item: NavItem): void
}>()

const menuRef = ref<HTMLElement | null>(null)

const menuStyle = computed(() => {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1000
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800
  const safeX = Math.min(props.x, winW - 190)
  const safeY = Math.min(props.y, winH - 220)
  return {
    left: `${Math.max(10, safeX)}px`,
    top: `${Math.max(10, safeY)}px`
  }
})

const handleGlobalClick = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
  window.addEventListener('contextmenu', handleGlobalClick)
  window.addEventListener('scroll', () => emit('close'), { passive: true })
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('contextmenu', handleGlobalClick)
  window.removeEventListener('scroll', () => emit('close'))
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <teleport to="body">
    <!-- 全屏透明阻断遮罩：防止点击穿透到背景控件，点击任意空白处仅关闭菜单 -->
    <div 
      v-if="show && item" 
      class="fixed inset-0 z-40 bg-transparent select-none" 
      @click="emit('close')" 
      @contextmenu.prevent="emit('close')"
    ></div>

    <transition
      enter-active-class="transition duration-120 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-90 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="show && item"
        ref="menuRef"
        @click.stop
        class="fixed z-50 w-44 bg-white/95 backdrop-blur-xl rounded-xl p-1.5 shadow-xl shadow-slate-900/12 border border-slate-200/90 text-xs text-slate-700 select-none animate-in fade-in"
        :style="menuStyle"
      >
        <!-- 头部提示：站点名 -->
        <div class="px-2.5 py-1 text-[10px] font-medium text-slate-400 truncate border-b border-slate-100 mb-1">
          {{ item.title }}
        </div>

        <button
          @click="emit('openItem', item, true); emit('close')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors text-left"
        >
          <ExternalLink class="w-3.5 h-3.5 text-slate-400" />
          <span>新标签打开</span>
        </button>

        <button
          @click="emit('copyUrl', item); emit('close')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
        >
          <Copy class="w-3.5 h-3.5 text-slate-400" />
          <span>复制链接</span>
        </button>

        <button
          @click="emit('startReorder', item); emit('close')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
        >
          <Move class="w-3.5 h-3.5 text-slate-400" />
          <span>调整位置</span>
        </button>

        <button
          @click="emit('editItem', item); emit('close')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
        >
          <Edit3 class="w-3.5 h-3.5 text-slate-400" />
          <span>编辑</span>
        </button>

        <div class="h-px bg-slate-100 my-1"></div>

        <button
          @click="emit('deleteItem', item); emit('close')"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors text-left"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>删除</span>
        </button>
      </div>
    </transition>
  </teleport>
</template>
