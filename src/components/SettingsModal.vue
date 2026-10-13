<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  X, 
  Download, 
  Upload, 
  Image as ImageIcon,
  Sliders,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  HardDrive,
  Table,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-vue-next'
import type { NavConfig, NavSettings, BackgroundConfig, BackgroundType, SearchEngineItemConfig } from '../types/nav'
import { DEFAULT_SEARCH_ENGINES, getEngineIcon } from '../utils/searchEngines'
import { saveLocalMedia } from '../services/mediaStorage'

const props = defineProps<{
  show: boolean
  config: NavConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updateSettings', settings: Partial<NavSettings>): void
  (e: 'updateFullConfig', config: NavConfig): void
  (e: 'exportFile'): void
  (e: 'importFile', file: File): void
  (e: 'openTableEditor'): void
  (e: 'resetDefault'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const mediaInputRef = ref<HTMLInputElement | null>(null)

// 默认折叠偏好设置
const isPreferencesOpen = ref(false)

// 搜索引擎自定义与管理状态
const showAddEngineForm = ref(false)
const newEngineName = ref('')
const newEngineUrl = ref('')
const addEngineError = ref('')

const currentEngines = computed<SearchEngineItemConfig[]>(() => {
  return props.config.settings.searchEngines && props.config.settings.searchEngines.length > 0
    ? props.config.settings.searchEngines
    : DEFAULT_SEARCH_ENGINES
})

const updateEngines = (newList: SearchEngineItemConfig[]) => {
  emit('updateSettings', {
    searchEngines: newList
  })
}

const setDefaultEngine = (engineId: string) => {
  emit('updateSettings', {
    searchEngine: engineId
  })
}

const toggleEngineEnabled = (engineId: string) => {
  const next = currentEngines.value.map(e => 
    e.id === engineId ? { ...e, enabled: !e.enabled } : e
  )
  updateEngines(next)
}

const moveEngine = (index: number, direction: 'up' | 'down') => {
  const list = [...currentEngines.value]
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= list.length) return
  const temp = list[index]
  list[index] = list[targetIndex]
  list[targetIndex] = temp
  updateEngines(list)
}

const removeEngine = (engineId: string) => {
  const list = currentEngines.value.filter(e => e.id !== engineId)
  if (props.config.settings.searchEngine === engineId) {
    const fallback = list.find(e => e.enabled)?.id || list[0]?.id || 'google'
    emit('updateSettings', {
      searchEngines: list,
      searchEngine: fallback
    })
  } else {
    updateEngines(list)
  }
}

const resetDefaultEngines = () => {
  updateEngines([...DEFAULT_SEARCH_ENGINES])
  emit('updateSettings', { searchEngine: 'google' })
}

const handleAddEngine = () => {
  const name = newEngineName.value.trim()
  const url = newEngineUrl.value.trim()
  if (!name) {
    addEngineError.value = '请输入引擎名称'
    return
  }
  if (!url) {
    addEngineError.value = '请输入搜索网址'
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    addEngineError.value = '网址必须以 http:// 或 https:// 开头'
    return
  }

  const newEngine: SearchEngineItemConfig = {
    id: `custom-${Date.now()}`,
    name,
    url,
    enabled: true,
    isCustom: true
  }

  updateEngines([...currentEngines.value, newEngine])
  newEngineName.value = ''
  newEngineUrl.value = ''
  addEngineError.value = ''
  showAddEngineForm.value = false
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    emit('importFile', target.files[0])
    target.value = ''
  }
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const bgConfig = computed<BackgroundConfig>(() => {
  return props.config.settings.customBackground || {
    type: 'white',
    url: '',
    opacity: 70,
    blur: 8,
    parallax: true
  }
})

const updateBg = (partial: Partial<BackgroundConfig>) => {
  emit('updateSettings', {
    customBackground: {
      ...bgConfig.value,
      ...partial
    }
  })
}

const setBgType = (type: BackgroundType) => {
  updateBg({ type })
}

const handleMediaUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const { key, objectUrl } = await saveLocalMedia(file)
    updateBg({
      type: 'image',
      url: objectUrl,
      localKey: key
    })
    target.value = ''
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
        @click.self="$emit('close')"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md select-none"
      >
        <div 
          @click.stop
          class="bg-white/95 w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200/90 relative max-h-[90vh] overflow-y-auto transform transition-all duration-200"
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Sliders class="w-3.5 h-3.5" />
              </div>
              <h3 class="text-sm font-semibold text-slate-900">设置</h3>
            </div>
            <button
              @click="$emit('close')"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- 1. 背景 -->
            <div class="space-y-2.5">
              <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-blue-600" />
                <span>背景</span>
              </span>

              <!-- 极简两段选择器 (纯白 / 图片，移除高能耗流光) -->
              <div class="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  v-for="t in [
                    { id: 'white', label: '纯白' },
                    { id: 'image', label: '图片' }
                  ]"
                  :key="t.id"
                  type="button"
                  @click="setBgType(t.id as any)"
                  class="py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                  :class="bgConfig.type === t.id 
                    ? 'bg-white text-blue-600 shadow-xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'"
                >
                  {{ t.label }}
                </button>
              </div>

              <!-- 图片设置 -->
              <div v-if="bgConfig.type === 'image'" class="space-y-2 pt-1">
                <div class="flex gap-2">
                  <input
                    :value="bgConfig.url"
                    @input="updateBg({ url: ($event.target as HTMLInputElement).value, localKey: undefined })"
                    type="text"
                    placeholder="图片链接"
                    class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono"
                  />
                  <button
                    type="button"
                    @click="mediaInputRef?.click()"
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl text-xs text-slate-700 font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  >
                    <ImageIcon class="w-3.5 h-3.5 text-slate-500" />
                    <span>上传</span>
                  </button>
                  <input
                    ref="mediaInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleMediaUpload"
                  />
                </div>

                <!-- 遮罩与模糊调节 -->
                <div class="grid grid-cols-2 gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <div class="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>遮罩</span>
                      <span class="font-mono text-slate-700">{{ bgConfig.opacity }}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      :value="bgConfig.opacity"
                      @input="updateBg({ opacity: Number(($event.target as HTMLInputElement).value) })"
                      class="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div class="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                      <span>模糊</span>
                      <span class="font-mono text-slate-700">{{ bgConfig.blur }}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      :value="bgConfig.blur"
                      @input="updateBg({ blur: Number(($event.target as HTMLInputElement).value) })"
                      class="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <!-- 视差开关 -->
                <div class="flex items-center justify-between text-xs text-slate-600 px-1 pt-0.5">
                  <span>视差</span>
                  <button
                    type="button"
                    @click="updateBg({ parallax: !bgConfig.parallax })"
                    class="w-8 h-4.5 rounded-full transition-colors relative p-0.5"
                    :class="bgConfig.parallax ? 'bg-blue-600' : 'bg-slate-200'"
                  >
                    <div 
                      class="w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform"
                      :class="bgConfig.parallax ? 'translate-x-3.5' : 'translate-x-0'"
                    ></div>
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. 偏好 (默认折叠) -->
            <div class="space-y-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                @click="isPreferencesOpen = !isPreferencesOpen"
                class="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none py-0.5 group"
              >
                <span class="flex items-center gap-1.5">
                  <SlidersHorizontal class="w-3.5 h-3.5 text-blue-600" />
                  <span>偏好</span>
                </span>
                <span class="flex items-center gap-1 text-[11px] font-normal text-slate-400 group-hover:text-slate-600">
                  <span>{{ isPreferencesOpen ? '收起' : '展开' }}</span>
                  <ChevronDown 
                    class="w-3.5 h-3.5 transition-transform duration-200" 
                    :class="isPreferencesOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'"
                  />
                </span>
              </button>

              <div v-show="isPreferencesOpen" class="space-y-3 pt-1">
                <!-- 新标签页打开 -->
                <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>新标签页打开</span>
                  <button
                    @click="$emit('updateSettings', { openInNewTab: !config.settings.openInNewTab })"
                    class="w-8 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer"
                    :class="config.settings.openInNewTab ? 'bg-blue-600' : 'bg-slate-200'"
                  >
                    <div 
                      class="w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform"
                      :class="config.settings.openInNewTab ? 'translate-x-3.5' : 'translate-x-0'"
                    ></div>
                  </button>
                </div>

                <!-- 单行图标数量 (调节间距实现数量变化) -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                    <span>单行图标数量</span>
                    <span class="text-[11px] text-slate-400 font-normal">
                      {{ (config.settings.cardDensity === 'compact') ? '紧凑 · 容纳更多' : (config.settings.cardDensity === 'relaxed') ? '宽松 · 容纳较少' : '标准' }}
                    </span>
                  </div>
                  <div class="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      v-for="d in [
                        { id: 'compact', label: '紧凑' },
                        { id: 'normal', label: '标准' },
                        { id: 'relaxed', label: '宽松' }
                      ]"
                      :key="d.id"
                      type="button"
                      @click="$emit('updateSettings', { cardDensity: d.id as any })"
                      class="py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                      :class="(config.settings.cardDensity || 'normal') === d.id 
                        ? 'bg-white text-blue-600 shadow-xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'"
                    >
                      {{ d.label }}
                    </button>
                  </div>
                </div>

                <!-- 分类显示间距 -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                    <span>分类显示间距</span>
                    <span class="text-[11px] text-slate-400 font-normal">
                      {{ (config.settings.categorySpacing === 'compact') ? '紧凑小间距' : (config.settings.categorySpacing === 'relaxed') ? '开阔大间距' : '标准间距' }}
                    </span>
                  </div>
                  <div class="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      v-for="s in [
                        { id: 'compact', label: '紧凑' },
                        { id: 'normal', label: '标准' },
                        { id: 'relaxed', label: '开阔' }
                      ]"
                      :key="s.id"
                      type="button"
                      @click="$emit('updateSettings', { categorySpacing: s.id as any })"
                      class="py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                      :class="(config.settings.categorySpacing || 'normal') === s.id 
                        ? 'bg-white text-blue-600 shadow-xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'"
                    >
                      {{ s.label }}
                    </button>
                  </div>
                </div>

                <!-- 搜索引擎管理 (空状态胶囊与默认主引擎) -->
                <div class="space-y-2 pt-2 border-t border-slate-100">
                  <div class="flex items-center justify-between px-1">
                    <div>
                      <span class="text-xs font-medium text-slate-700 block">搜索引擎</span>
                      <span class="text-[10px] text-slate-400">管理空状态直达胶囊与默认回车引擎</span>
                    </div>
                    <button
                      type="button"
                      @click="resetDefaultEngines"
                      class="text-[10px] text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      title="重置为默认引擎列表"
                    >
                      重置默认
                    </button>
                  </div>

                  <!-- 引擎列表 -->
                  <div class="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    <div
                      v-for="(eng, eIdx) in currentEngines"
                      :key="eng.id"
                      class="flex items-center justify-between p-2 rounded-xl border transition-all"
                      :class="eng.enabled 
                        ? 'bg-slate-50 border-slate-100' 
                        : 'bg-slate-50/50 border-transparent opacity-60'"
                    >
                      <!-- 左侧: 图标 + 引擎信息 -->
                      <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <component :is="getEngineIcon(eng.icon || eng.id)" class="w-3.5 h-3.5 flex-shrink-0" />
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-xs font-medium text-slate-800 truncate">{{ eng.name }}</span>
                            <span 
                              v-if="config.settings.searchEngine === eng.id"
                              class="px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-600 text-[9px] font-semibold border border-blue-200/60 flex-shrink-0"
                            >
                              默认回车
                            </span>
                          </div>
                          <span class="text-[10px] text-slate-400 truncate block font-mono">{{ eng.url }}</span>
                        </div>
                      </div>

                      <!-- 右侧操作栏: 设为默认 + 显示开关 + 排序 + 删除 -->
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <!-- 设为默认按钮 -->
                        <button
                          v-if="config.settings.searchEngine !== eng.id"
                          type="button"
                          @click="setDefaultEngine(eng.id)"
                          class="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-blue-600 hover:bg-white transition-colors cursor-pointer"
                          title="设为默认回车引擎"
                        >
                          设为默认
                        </button>

                        <!-- 显示/隐藏在胶囊流中 -->
                        <button
                          type="button"
                          @click="toggleEngineEnabled(eng.id)"
                          class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                          :title="eng.enabled ? '在胶囊流中显示 (点击隐藏)' : '已在胶囊流中隐藏 (点击显示)'"
                        >
                          <Eye v-if="eng.enabled" class="w-3 h-3 text-blue-600" />
                          <EyeOff v-else class="w-3 h-3 text-slate-300" />
                        </button>

                        <!-- 排序微箭头 -->
                        <button
                          v-if="eIdx > 0"
                          type="button"
                          @click="moveEngine(eIdx, 'up')"
                          class="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                          title="上移"
                        >
                          <ChevronUp class="w-3 h-3" />
                        </button>
                        <button
                          v-if="eIdx < currentEngines.length - 1"
                          type="button"
                          @click="moveEngine(eIdx, 'down')"
                          class="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                          title="下移"
                        >
                          <ChevronDown class="w-3 h-3" />
                        </button>

                        <!-- 自定义引擎删除按钮 -->
                        <button
                          v-if="eng.isCustom"
                          type="button"
                          @click="removeEngine(eng.id)"
                          class="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-0.5"
                          title="删除此搜索引擎"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- 添加自定义搜索引擎表单/按钮 -->
                  <div v-if="!showAddEngineForm" class="pt-1">
                    <button
                      type="button"
                      @click="showAddEngineForm = true; addEngineError = ''"
                      class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 hover:bg-blue-50/30 text-xs transition-all cursor-pointer"
                    >
                      <Plus class="w-3.5 h-3.5" />
                      <span>添加搜索引擎</span>
                    </button>
                  </div>

                  <!-- 展开添加表单 -->
                  <div 
                    v-else 
                    class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2"
                  >
                    <div class="text-xs font-semibold text-slate-700">添加自定义搜索引擎</div>
                    <div class="space-y-1.5">
                      <input
                        v-model="newEngineName"
                        type="text"
                        placeholder="引擎名称 (如: 知乎)"
                        class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        v-model="newEngineUrl"
                        type="text"
                        placeholder="搜索网址 (如: https://www.zhihu.com/search?type=content&q=%s)"
                        class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                      />
                      <p class="text-[10px] text-slate-400 leading-tight">
                        提示: 支持在网址中使用 <code class="font-mono text-blue-600">%s</code> 占位符，或直接以搜索参数结尾。
                      </p>
                      <p v-if="addEngineError" class="text-[10px] text-rose-500 font-medium">
                        {{ addEngineError }}
                      </p>
                    </div>

                    <div class="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        @click="showAddEngineForm = false; newEngineName = ''; newEngineUrl = ''; addEngineError = ''"
                        class="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-200/70 transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        @click="handleAddEngine"
                        class="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all cursor-pointer shadow-2xs"
                      >
                        保存添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. 数据管理 (去除繁杂不知所云的物理文件概念，只保留核心导入/导出) -->
            <div class="space-y-2 pt-3 border-t border-slate-100">
              <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <HardDrive class="w-3.5 h-3.5 text-blue-600" />
                <span>数据</span>
              </span>

              <div class="space-y-1.5">
                <div class="grid grid-cols-2 gap-2">
                  <button
                    @click="$emit('exportFile')"
                    class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition-all active:scale-[0.98]"
                  >
                    <Download class="w-3.5 h-3.5 text-slate-500" />
                    <span>导出配置</span>
                  </button>

                  <button
                    @click="triggerFileInput"
                    class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition-all active:scale-[0.98]"
                  >
                    <Upload class="w-3.5 h-3.5 text-slate-500" />
                    <span>导入配置</span>
                  </button>
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".json"
                    class="hidden"
                    @change="handleFileChange"
                  />
                </div>

                <button
                  @click="$emit('openTableEditor')"
                  class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition-all active:scale-[0.98]"
                >
                  <Table class="w-3.5 h-3.5 text-blue-600" />
                  <span>站点管理</span>
                </button>
              </div>
            </div>

            <!-- 4. 底部版本与重置 -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-[11px] text-slate-400">EasyNavi v{{ config.version }}</span>
              <button
                @click="$emit('resetDefault')"
                class="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 transition-colors"
              >
                <RotateCcw class="w-3 h-3" />
                <span>恢复默认</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
