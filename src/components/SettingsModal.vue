<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  X, 
  Download, 
  Upload, 
  Image as ImageIcon,
  Sliders,
  Sparkles,
  RotateCcw,
  Cloud,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  HardDrive,
  Code2
} from 'lucide-vue-next'
import type { NavConfig, NavSettings, BackgroundConfig, BackgroundType, WebDavConfig } from '../types/nav'
import { saveLocalMedia } from '../services/mediaStorage'
import { testWebDavConnection, pullFromWebDav, pushToWebDav } from '../services/webdav'

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
  (e: 'openJsonEditor'): void
  (e: 'resetDefault'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const mediaInputRef = ref<HTMLInputElement | null>(null)

// WebDAV 状态（默认折叠）
const isWebdavExpanded = ref(false)
const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const isTestingWebdav = ref(false)
const isPullingWebdav = ref(false)
const isPushingWebdav = ref(false)
const webdavFeedback = ref<{ success: boolean; msg: string } | null>(null)

watch(
  () => props.show,
  (val) => {
    if (val) {
      const wd = props.config.settings.webdav
      webdavUrl.value = wd?.url || ''
      webdavUsername.value = wd?.username || ''
      webdavPassword.value = wd?.password || ''
      webdavFeedback.value = null
    }
  }
)

const saveWebDavConfig = () => {
  const newWd: WebDavConfig = {
    enabled: !!webdavUrl.value.trim(),
    url: webdavUrl.value.trim(),
    username: webdavUsername.value.trim(),
    password: webdavPassword.value,
    filename: 'nav.json'
  }
  emit('updateSettings', { webdav: newWd })
}

const handleTestWebDav = async () => {
  if (!webdavUrl.value.trim()) {
    webdavFeedback.value = { success: false, msg: '请输入服务器地址' }
    return
  }
  isTestingWebdav.value = true
  webdavFeedback.value = null
  const tempConfig: WebDavConfig = {
    enabled: true,
    url: webdavUrl.value.trim(),
    username: webdavUsername.value.trim(),
    password: webdavPassword.value,
    filename: 'nav.json'
  }
  const res = await testWebDavConnection(tempConfig)
  webdavFeedback.value = { success: res.success, msg: res.message }
  isTestingWebdav.value = false
  if (res.success) {
    saveWebDavConfig()
  }
}

const handlePullWebDav = async () => {
  if (!webdavUrl.value.trim()) return
  try {
    isPullingWebdav.value = true
    webdavFeedback.value = null
    const tempConfig: WebDavConfig = {
      enabled: true,
      url: webdavUrl.value.trim(),
      username: webdavUsername.value.trim(),
      password: webdavPassword.value,
      filename: 'nav.json'
    }
    const remote = await pullFromWebDav(tempConfig)
    emit('updateFullConfig', remote)
    webdavFeedback.value = { success: true, msg: '拉取成功' }
  } catch (err: any) {
    webdavFeedback.value = { success: false, msg: err?.message || '拉取失败' }
  } finally {
    isPullingWebdav.value = false
  }
}

const handlePushWebDav = async () => {
  if (!webdavUrl.value.trim()) return
  try {
    isPushingWebdav.value = true
    webdavFeedback.value = null
    const tempConfig: WebDavConfig = {
      enabled: true,
      url: webdavUrl.value.trim(),
      username: webdavUsername.value.trim(),
      password: webdavPassword.value,
      filename: 'nav.json'
    }
    await pushToWebDav(tempConfig, props.config)
    saveWebDavConfig()
    webdavFeedback.value = { success: true, msg: '上传成功' }
  } catch (err: any) {
    webdavFeedback.value = { success: false, msg: err?.message || '上传失败' }
  } finally {
    isPushingWebdav.value = false
  }
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

              <!-- 极简三段选择器 -->
              <div class="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  v-for="t in [
                    { id: 'white', label: '纯白' },
                    { id: 'mesh', label: '流光' },
                    { id: 'image', label: '图片' }
                  ]"
                  :key="t.id"
                  type="button"
                  @click="setBgType(t.id as any)"
                  class="py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
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

            <!-- 2. 偏好 -->
            <div class="space-y-2 pt-3 border-t border-slate-100">
              <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <SlidersHorizontal class="w-3.5 h-3.5 text-blue-600" />
                <span>偏好</span>
              </span>

              <div class="space-y-2 pt-0.5">
                <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>新标签页打开</span>
                  <button
                    @click="$emit('updateSettings', { openInNewTab: !config.settings.openInNewTab })"
                    class="w-8 h-4.5 rounded-full transition-colors relative p-0.5"
                    :class="config.settings.openInNewTab ? 'bg-blue-600' : 'bg-slate-200'"
                  >
                    <div 
                      class="w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform"
                      :class="config.settings.openInNewTab ? 'translate-x-3.5' : 'translate-x-0'"
                    ></div>
                  </button>
                </div>

                <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span>常用推荐流</span>
                  <button
                    @click="$emit('updateSettings', { showFrequentBar: !config.settings.showFrequentBar })"
                    class="w-8 h-4.5 rounded-full transition-colors relative p-0.5"
                    :class="config.settings.showFrequentBar ? 'bg-blue-600' : 'bg-slate-200'"
                  >
                    <div 
                      class="w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform"
                      :class="config.settings.showFrequentBar ? 'translate-x-3.5' : 'translate-x-0'"
                    ></div>
                  </button>
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
                  @click="$emit('openJsonEditor')"
                  class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition-all active:scale-[0.98]"
                >
                  <Code2 class="w-3.5 h-3.5 text-blue-600" />
                  <span>在线编辑源码</span>
                </button>
              </div>
            </div>

            <!-- 4. WebDAV (默认折叠) -->
            <div class="pt-3 border-t border-slate-100">
              <button
                type="button"
                @click="isWebdavExpanded = !isWebdavExpanded"
                class="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors py-1 px-0.5"
              >
                <div class="flex items-center gap-1.5">
                  <Cloud class="w-3.5 h-3.5 text-blue-600" />
                  <span>WebDAV</span>
                  <span v-if="config.settings.webdav?.enabled" class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/80">
                    已配置
                  </span>
                </div>
                <component :is="isWebdavExpanded ? ChevronUp : ChevronDown" class="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div v-if="isWebdavExpanded" class="space-y-2 p-2.5 mt-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <label class="block text-[11px] font-medium text-slate-600 mb-1">服务器</label>
                  <input
                    v-model="webdavUrl"
                    @change="saveWebDavConfig"
                    type="text"
                    placeholder="https://..."
                    class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[11px] font-medium text-slate-600 mb-1">用户名</label>
                    <input
                      v-model="webdavUsername"
                      @change="saveWebDavConfig"
                      type="text"
                      placeholder="用户名"
                      class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-medium text-slate-600 mb-1">密码</label>
                    <input
                      v-model="webdavPassword"
                      @change="saveWebDavConfig"
                      type="password"
                      placeholder="密码"
                      class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div class="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60">
                  <button
                    type="button"
                    :disabled="isTestingWebdav"
                    @click="handleTestWebDav"
                    class="flex-1 py-1 px-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
                  >
                    <Loader2 v-if="isTestingWebdav" class="w-3 h-3 animate-spin text-blue-600" />
                    <span>测试</span>
                  </button>
                  <button
                    type="button"
                    :disabled="isPullingWebdav"
                    @click="handlePullWebDav"
                    class="flex-1 py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
                  >
                    <Loader2 v-if="isPullingWebdav" class="w-3 h-3 animate-spin text-blue-600" />
                    <span>拉取</span>
                  </button>
                  <button
                    type="button"
                    :disabled="isPushingWebdav"
                    @click="handlePushWebDav"
                    class="flex-1 py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-60"
                  >
                    <Loader2 v-if="isPushingWebdav" class="w-3 h-3 animate-spin text-white" />
                    <span>上传</span>
                  </button>
                </div>

                <div v-if="webdavFeedback" class="text-[11px] pt-0.5" :class="webdavFeedback.success ? 'text-emerald-600' : 'text-rose-500'">
                  {{ webdavFeedback.msg }}
                </div>
              </div>
            </div>

            <!-- 5. 底部版本与重置 -->
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
