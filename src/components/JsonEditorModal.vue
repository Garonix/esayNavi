<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { 
  X, 
  Code2, 
  Copy, 
  Check, 
  Wand2, 
  AlertCircle,
  CheckCircle2
} from 'lucide-vue-next'
import type { NavConfig } from '../types/nav'
import { ensureUniqueItemIds } from '../services/storage'

const props = defineProps<{
  show: boolean
  config: NavConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newConfig: NavConfig): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const jsonContent = ref('')
const copySuccess = ref(false)
let copyTimer: number | null = null

// 实时语法与结构校验
const validation = computed(() => {
  const text = jsonContent.value.trim()
  if (!text) {
    return { valid: false, error: '内容不能为空', data: null, stats: null }
  }

  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: '根节点必须为 JSON 对象', data: null, stats: null }
    }
    if (!Array.isArray(parsed.categories)) {
      return { valid: false, error: '缺少 categories 分类数组', data: null, stats: null }
    }

    const categoryCount = parsed.categories.length
    let itemCount = 0
    for (const cat of parsed.categories) {
      if (Array.isArray(cat.items)) {
        itemCount += cat.items.length
      }
    }

    return { 
      valid: true, 
      error: null, 
      data: parsed as NavConfig,
      stats: { categoryCount, itemCount }
    }
  } catch (err: any) {
    return { 
      valid: false, 
      error: err?.message || 'JSON 语法错误', 
      data: null, 
      stats: null 
    }
  }
})

watch(
  () => props.show,
  (val) => {
    if (val) {
      jsonContent.value = JSON.stringify(props.config, null, 2)
      copySuccess.value = false
      nextTick(() => {
        textareaRef.value?.focus()
      })
    }
  }
)

// 格式化 JSON
const handleFormat = () => {
  if (validation.value.valid && validation.value.data) {
    jsonContent.value = JSON.stringify(validation.value.data, null, 2)
  }
}

// 复制到剪贴板
const handleCopy = async () => {
  if (!jsonContent.value.trim()) return
  try {
    await navigator.clipboard.writeText(jsonContent.value)
    copySuccess.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copySuccess.value = false
    }, 1500)
  } catch {
    // 忽略剪贴板权限异常
  }
}

// 拦截键盘事件 (支持 Tab 键缩进 2 空格与 Ctrl/Cmd+S 保存)
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const val = jsonContent.value

    jsonContent.value = val.substring(0, start) + '  ' + val.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

// 提交保存
const handleSave = () => {
  if (!validation.value.valid || !validation.value.data) return

  const targetConfig = validation.value.data
  ensureUniqueItemIds(targetConfig)
  emit('save', targetConfig)
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
        class="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-2xl rounded-2xl p-5 shadow-2xl border border-slate-200/90 flex flex-col max-h-[90vh] overflow-hidden transform transition-all"
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Code2 class="w-4 h-4" />
              </div>
              <h3 class="text-sm font-semibold text-slate-900">配置源码</h3>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="handleFormat"
                :disabled="!validation.valid"
                title="格式化 JSON"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <Wand2 class="w-3.5 h-3.5" />
                <span>格式化</span>
              </button>

              <button
                type="button"
                @click="handleCopy"
                title="复制全部内容"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Check v-if="copySuccess" class="w-3.5 h-3.5 text-emerald-600" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copySuccess ? '已复制' : '复制' }}</span>
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

          <!-- 代码编辑核心视窗 (深色极客等宽工作台，支持原生 Tab 缩进) -->
          <div class="relative flex-1 my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col min-h-[360px]">
            <textarea
              ref="textareaRef"
              v-model="jsonContent"
              @keydown="handleKeydown"
              spellcheck="false"
              placeholder="在此输入或粘贴 JSON 配置..."
              class="w-full flex-1 p-3.5 bg-transparent text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-blue-600/40 tab-size-2 overflow-auto"
              style="tab-size: 2;"
            ></textarea>
          </div>

          <!-- 底部动作与校验栏 -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 flex-shrink-0">
            <!-- 校验状态反馈 -->
            <div class="flex items-center gap-1.5 text-xs truncate max-w-[60%]">
              <template v-if="validation.valid && validation.stats">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span class="text-slate-600 truncate">
                  {{ validation.stats.categoryCount }} 个分类 · {{ validation.stats.itemCount }} 个站点
                </span>
              </template>
              <template v-else>
                <AlertCircle class="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                <span class="text-rose-500 truncate font-mono text-[11px]">
                  {{ validation.error }}
                </span>
              </template>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="$emit('close')"
                class="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                @click="handleSave"
                :disabled="!validation.valid"
                class="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95"
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
