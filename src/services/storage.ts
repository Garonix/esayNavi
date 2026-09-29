import type { NavConfig } from '../types/nav'

const LOCAL_STORAGE_KEY = 'easynavi_config_v5'
let activeFileHandle: FileSystemFileHandle | null = null

export const DEFAULT_CONFIG: NavConfig = {
  version: '1.2.2',
  settings: {
    title: 'EasyNavi',
    theme: 'light',
    background: 'white',
    searchEngine: 'google',
    openInNewTab: true,
    showClock: false,
    showSearch: true
  },
  categories: []
}

/**
 * 确保配置中所有卡片的 ID 全局唯一（防止复制粘贴造成的重复 ID 导致状态绑定错乱）
 */
export function ensureUniqueItemIds(config: NavConfig): boolean {
  if (!config || !Array.isArray(config.categories)) return false
  let hasModified = false
  const seenIds = new Set<string>()

  for (const cat of config.categories) {
    if (!cat.items || !Array.isArray(cat.items)) continue
    for (let i = 0; i < cat.items.length; i++) {
      const item = cat.items[i]
      if (!item.id || seenIds.has(item.id)) {
        item.id = `item-${cat.id}-${i + 1}-${Date.now().toString(36).slice(-4)}`
        hasModified = true
      }
      seenIds.add(item.id)
    }
  }

  return hasModified
}

/**
 * 初始载入配置：
 * 1. 优先读取 LocalStorage
 * 2. 若无则从 public/nav.json 加载
 */
export async function loadInitialConfig(): Promise<NavConfig> {
  try {
    localStorage.removeItem('easynavi_config_v1')
    localStorage.removeItem('easynavi_config_v2')
    localStorage.removeItem('easynavi_config_v3')
    localStorage.removeItem('easynavi_config_v4')
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed && parsed.categories && parsed.categories.length > 0) {
        let needSave = ensureUniqueItemIds(parsed)
        if (parsed.settings && parsed.settings.background === 'mesh' && !parsed.settings.customBackground) {
          parsed.settings.background = 'white'
          needSave = true
        }
        if (needSave) {
          saveConfigToLocal(parsed)
        }
        return parsed
      }
    }
  } catch (e) {
    console.warn('读取本地缓存失败，回退到远程初始文件:', e)
  }

  try {
    const res = await fetch('/nav.json?t=' + Date.now())
    if (res.ok) {
      const remoteConfig = await res.json()
      ensureUniqueItemIds(remoteConfig)
      saveConfigToLocal(remoteConfig)
      return remoteConfig
    }
  } catch (e) {
    console.error('加载 public/nav.json 失败:', e)
  }

  return DEFAULT_CONFIG
}

/**
 * 将配置持久化保存到 LocalStorage
 */
export function saveConfigToLocal(config: NavConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('保存到 LocalStorage 失败:', e)
  }
}

/**
 * 纯前端导出 JSON 物理文件并触发下载
 */
export function exportConfigFile(config: NavConfig, filename = 'nav.json'): void {
  const jsonStr = JSON.stringify(config, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 从上传的文件读取配置
 */
export async function importConfigFile(file: File): Promise<NavConfig> {
  const text = await file.text()
  const parsed = JSON.parse(text)
  if (!parsed.categories || !Array.isArray(parsed.categories)) {
    throw new Error('无效的导航配置文件格式：未找到 categories 列表')
  }
  ensureUniqueItemIds(parsed as NavConfig)
  return parsed as NavConfig
}

/**
 * 检测当前浏览器是否支持 File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/**
 * 关联本地已有的 JSON 物理文件 (通过 File System Access API)
 */
export async function linkLocalConfigFile(): Promise<{ config: NavConfig; fileName: string }> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持直接连接本地物理文件，请使用导入/导出功能')
  }

  // @ts-expect-error File System Access API
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: 'JSON Navigation Config',
        accept: { 'application/json': ['.json'] }
      }
    ],
    multiple: false
  })

  activeFileHandle = handle
  const file = await handle.getFile()
  const content = await file.text()
  const parsed = JSON.parse(content)

  if (!parsed.categories || !Array.isArray(parsed.categories)) {
    throw new Error('所选文件格式不符合 EasyNavi 配置规范')
  }

  return { config: parsed, fileName: file.name }
}

/**
 * 写回已关联的本地物理文件
 */
export async function syncToLinkedFile(config: NavConfig): Promise<boolean> {
  if (!activeFileHandle) return false
  try {
    const writable = await (activeFileHandle as any).createWritable()
    await writable.write(JSON.stringify(config, null, 2))
    await writable.close()
    return true
  } catch (e) {
    console.error('写回本地物理文件失败:', e)
    return false
  }
}

/**
 * 获取当前已关联的文件名
 */
export async function getActiveLinkedFileName(): Promise<string | null> {
  if (!activeFileHandle) return null
  try {
    const file = await activeFileHandle.getFile()
    return file.name
  } catch {
    return null
  }
}
