import type { NavConfig } from '../types/nav'
import { DEFAULT_SEARCH_ENGINES } from '../utils/searchEngines'

export const LOCAL_STORAGE_KEY = 'easynavi_config_v6'
const LEGACY_STORAGE_KEYS = [
  'easynavi_config_v1',
  'easynavi_config_v2',
  'easynavi_config_v3',
  'easynavi_config_v4',
  'easynavi_config_v5'
]

export function createDefaultConfig(): NavConfig {
  return {
    version: '1.2.2',
    settings: {
      title: 'EasyNavi',
      background: 'white',
      searchEngine: 'google',
      searchEngines: DEFAULT_SEARCH_ENGINES.map(e => ({ ...e })),
      openInNewTab: true,
      showSearch: true
    },
    categories: []
  }
}

export const DEFAULT_CONFIG: NavConfig = createDefaultConfig()

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
 * 规范化与兼容迁移配置对象，剥离已废弃的遗留字段并补全缺失默认项
 */
export function normalizeConfig(raw: any): { config: NavConfig; modified: boolean } {
  const fallback = createDefaultConfig()
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.categories)) {
    return { config: fallback, modified: true }
  }

  let modified = false
  const rawSettings = (raw.settings && typeof raw.settings === 'object') ? raw.settings : {}

  // 清洗历史废弃背景类型 ('particles' / 'video' / 'mesh')
  let background = rawSettings.background
  if (background !== 'white' && background !== 'image') {
    background = 'white'
    modified = true
  }

  let customBackground = rawSettings.customBackground
  if (customBackground && typeof customBackground === 'object') {
    const bgType = customBackground.type
    if (bgType !== 'white' && bgType !== 'image') {
      customBackground = { ...customBackground, type: 'white' }
      modified = true
    }
  }

  let searchEngines = rawSettings.searchEngines
  if (!Array.isArray(searchEngines) || searchEngines.length === 0) {
    searchEngines = DEFAULT_SEARCH_ENGINES.map(e => ({ ...e }))
    modified = true
  }

  const normalized: NavConfig = {
    version: typeof raw.version === 'string' && raw.version ? raw.version : fallback.version,
    settings: {
      title: typeof rawSettings.title === 'string' && rawSettings.title ? rawSettings.title : fallback.settings.title,
      background,
      customBackground,
      searchEngine: typeof rawSettings.searchEngine === 'string' && rawSettings.searchEngine
        ? rawSettings.searchEngine
        : fallback.settings.searchEngine,
      searchEngines,
      openInNewTab: rawSettings.openInNewTab !== false,
      showSearch: rawSettings.showSearch !== false,
      cardDensity: rawSettings.cardDensity,
      categorySpacing: rawSettings.categorySpacing
    },
    categories: raw.categories.map((cat: any, idx: number) => ({
      id: typeof cat?.id === 'string' && cat.id ? cat.id : `cat-${idx + 1}`,
      name: typeof cat?.name === 'string' ? cat.name : '未命名',
      icon: typeof cat?.icon === 'string' ? cat.icon : 'folder',
      items: Array.isArray(cat?.items) ? cat.items.map((item: any) => ({ ...item })) : []
    }))
  }

  if (ensureUniqueItemIds(normalized)) {
    modified = true
  }

  return { config: normalized, modified }
}

/**
 * 清理当前及历史版本的本地缓存配置
 */
export function clearLocalConfig(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_STORAGE_KEY)
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(legacyKey)
  }
}

/**
 * 初始载入配置：
 * 1. 优先读取 LocalStorage
 * 2. 若无则从 public/nav.json 加载
 */
export async function loadInitialConfig(): Promise<NavConfig> {
  try {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(legacyKey)
    }
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        const { config, modified } = normalizeConfig(parsed)
        if (modified) {
          saveConfigToLocal(config)
        }
        return config
      }
    }
  } catch (e) {
    console.warn('读取本地缓存失败，回退到远程初始文件:', e)
  }

  try {
    const basePath = import.meta.env.BASE_URL || './'
    const navUrl = `${basePath.endsWith('/') ? basePath : basePath + '/'}nav.json?t=${Date.now()}`
    const res = await fetch(navUrl)
    if (res.ok) {
      const remoteConfig = await res.json()
      const { config } = normalizeConfig(remoteConfig)
      saveConfigToLocal(config)
      return config
    }
  } catch (e) {
    console.error('加载 public/nav.json 失败:', e)
  }

  return createDefaultConfig()
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
  if (!parsed || !Array.isArray(parsed.categories)) {
    throw new Error('无效的导航配置文件格式：未找到 categories 列表')
  }
  const { config } = normalizeConfig(parsed)
  return config
}
