import type { NavCategory, NavConfig } from '../types/nav'
import { DEFAULT_SEARCH_ENGINES } from '../utils/searchEngines'
import {
  LOCAL_ICON_PREFIX,
  buildIconAssetKey,
  extractLocalIconKey,
  getCachedIconSync,
  isLocalIconRef,
  saveCachedIcon
} from './iconCache'

export const LOCAL_STORAGE_KEY = 'easynavi_config_v6'
export const CLICKS_STORAGE_KEY = 'easynavi_clicks_v1'
const LEGACY_STORAGE_KEYS = [
  'easynavi_config_v1',
  'easynavi_config_v2',
  'easynavi_config_v3',
  'easynavi_config_v4',
  'easynavi_config_v5'
]

export interface StorageSaveResult {
  ok: boolean
  error?: unknown
}

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
 * 清理当前及历史版本的本地缓存配置与点击统计
 */
export function clearLocalConfig(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_STORAGE_KEY)
  localStorage.removeItem(CLICKS_STORAGE_KEY)
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(legacyKey)
  }
}

/**
 * 读取独立的轻量点击频次表
 */
export function loadClicksFromLocal(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CLICKS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, number> = {}
    for (const [id, count] of Object.entries(parsed)) {
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        result[id] = Math.floor(count)
      }
    }
    return result
  } catch {
    return {}
  }
}

/**
 * 单独持久化点击频次（高频点击不再触发整份 NavConfig 全量序列化）
 */
export function saveClicksToLocal(categories: NavCategory[]): StorageSaveResult {
  if (typeof localStorage === 'undefined') return { ok: true }
  try {
    const clicksMap: Record<string, number> = {}
    for (const cat of categories || []) {
      for (const item of cat.items || []) {
        if (item.id && item.clickCount && item.clickCount > 0) {
          clicksMap[item.id] = item.clickCount
        }
      }
    }
    localStorage.setItem(CLICKS_STORAGE_KEY, JSON.stringify(clicksMap))
    return { ok: true }
  } catch (error) {
    console.error('保存点击统计失败:', error)
    return { ok: false, error }
  }
}

/**
 * 将配置中的 DataURL 图标资产剥离至 IndexedDB/内存缓存，仅在 localStorage 保留轻量引用并分离点击数
 */
export function dehydrateConfigForStorage(config: NavConfig): NavConfig {
  return {
    ...config,
    settings: { ...config.settings },
    categories: (config.categories || []).map(cat => ({
      ...cat,
      items: (cat.items || []).map(item => {
        const { clickCount: _omitClickCount, ...rest } = item
        const icon = rest.icon?.trim()
        if (icon && icon.startsWith('data:')) {
          const assetKey = buildIconAssetKey(icon)
          void saveCachedIcon(assetKey, icon)
          return {
            ...rest,
            icon: `${LOCAL_ICON_PREFIX}${assetKey}`
          }
        }
        return { ...rest }
      })
    }))
  }
}

/**
 * 从缓存与点击统计中水合配置（还原 local-icon 引用为可用 DataURL，并合并 clickCount）
 */
export function hydrateConfigFromStorage(
  config: NavConfig,
  clicksMap: Record<string, number> = loadClicksFromLocal()
): NavConfig {
  return {
    ...config,
    settings: { ...config.settings },
    categories: (config.categories || []).map(cat => ({
      ...cat,
      items: (cat.items || []).map(item => {
        let resolvedIcon = item.icon
        if (isLocalIconRef(resolvedIcon)) {
          const cached = getCachedIconSync(extractLocalIconKey(resolvedIcon!))
          if (cached) {
            resolvedIcon = cached
          }
        }
        const mergedClicks = Math.max(item.clickCount || 0, clicksMap[item.id] || 0)
        return {
          ...item,
          icon: resolvedIcon,
          clickCount: mergedClicks
        }
      })
    }))
  }
}

function hasInlineDataIcons(raw: any): boolean {
  if (!raw || !Array.isArray(raw.categories)) return false
  return raw.categories.some((cat: any) =>
    Array.isArray(cat?.items) &&
    cat.items.some((item: any) => typeof item?.icon === 'string' && item.icon.trim().startsWith('data:'))
  )
}

/**
 * 初始载入配置：
 * 1. 优先读取 LocalStorage（并水合分层存储的图标与点击数）
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
        const hadInlineIcons = hasInlineDataIcons(parsed)
        const { config, modified } = normalizeConfig(parsed)
        const hydrated = hydrateConfigFromStorage(config, loadClicksFromLocal())
        if (modified || hadInlineIcons) {
          saveConfigToLocal(hydrated)
        }
        return hydrated
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
      const hydrated = hydrateConfigFromStorage(config, loadClicksFromLocal())
      saveConfigToLocal(hydrated)
      return hydrated
    }
  } catch (e) {
    console.error('加载 public/nav.json 失败:', e)
  }

  return createDefaultConfig()
}

/**
 * 将配置脱水后持久化保存到 LocalStorage（同时同步轻量点击表）
 */
export function saveConfigToLocal(config: NavConfig): StorageSaveResult {
  if (typeof localStorage === 'undefined') return { ok: true }
  try {
    const dehydrated = dehydrateConfigForStorage(config)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dehydrated))
    saveClicksToLocal(config.categories)
    return { ok: true }
  } catch (error) {
    console.error('保存到 LocalStorage 失败:', error)
    return { ok: false, error }
  }
}

/**
 * 纯前端导出完整可移植 JSON 物理文件并触发下载
 */
export function exportConfigFile(config: NavConfig, filename = 'nav.json'): void {
  const portable = hydrateConfigFromStorage(config, {})
  const jsonStr = JSON.stringify(portable, null, 2)
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
