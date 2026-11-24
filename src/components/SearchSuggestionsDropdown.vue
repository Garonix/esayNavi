<script setup lang="ts">
import { ref } from 'vue'
import { 
  Bookmark, 
  CornerLeftUp 
} from 'lucide-vue-next'
import type { BookmarkSuggestion } from '../types/nav'
import { getCleanUrlInfo } from '../utils/pinyinHelper'
import { getFallbackAvatar } from '../utils/urlHelper'
import { resolveItemDisplayIcon } from '../services/iconCache'

defineProps<{
  show: boolean
  items: BookmarkSuggestion[]
  selectedIndex: number
}>()

defineEmits<{
  (e: 'select', item: BookmarkSuggestion): void
  (e: 'fill', item: BookmarkSuggestion): void
  (e: 'hover', index: number): void
}>()

const failedIcons = ref(new Set<string>())

const getIconSrc = (item: BookmarkSuggestion) => resolveItemDisplayIcon(item)

const handleIconError = (item: BookmarkSuggestion, src: string) => {
  failedIcons.value.add(`${item.id}::${src}`)
}
</script>

<template>
  <transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 -translate-y-1.5 scale-[0.99]"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-1.5 scale-[0.99]"
  >
    <div
      v-if="show && items.length > 0"
      @mousedown.prevent
      class="search-suggestions-panel absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-1.5 z-50 select-none overflow-hidden"
    >
      <div class="space-y-0.5">
        <div
          v-for="(item, idx) in items"
          :key="item.id"
          @mouseenter="$emit('hover', idx)"
          @click="$emit('select', item)"
          class="group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors text-xs"
          :class="selectedIndex === idx 
            ? 'bg-blue-50 text-blue-900 font-medium' 
            : 'text-slate-700 hover:bg-slate-50/80'"
        >
          <!-- 左侧：书签图标与主体内容 -->
          <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <!-- 图标标识 -->
            <div 
              class="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors overflow-hidden"
              :class="selectedIndex === idx ? 'bg-blue-100/70 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'"
            >
              <img 
                v-if="getIconSrc(item) && !failedIcons.has(`${item.id}::${getIconSrc(item)}`)" 
                :src="getIconSrc(item)" 
                class="w-3.5 h-3.5 object-contain"
                @error="handleIconError(item, getIconSrc(item))"
              />
              <div 
                v-else-if="item.title"
                class="w-full h-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center"
              >
                {{ getFallbackAvatar(item.title).letter }}
              </div>
              <Bookmark v-else class="w-3 h-3" />
            </div>

            <!-- 主文本、分类标签与域名 -->
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <span class="truncate block text-xs">
                {{ item.title }}
              </span>
              <span 
                v-if="item.categoryName" 
                class="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-400 group-hover:bg-slate-200/70 group-hover:text-slate-600 flex-shrink-0 font-normal"
              >
                {{ item.categoryName }}
              </span>
              <span 
                v-if="item.url" 
                class="text-[10px] text-slate-400 truncate font-mono hidden sm:inline"
              >
                {{ getCleanUrlInfo(item.url).host }}
              </span>
            </div>
          </div>

          <!-- 右侧：一键回填按钮 -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              @click.stop="$emit('fill', item)"
              title="回填"
              class="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white transition-colors"
            >
              <CornerLeftUp class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
