import { ref } from 'vue'
import type { NavConfig, NavCategory, NavItem, NavSettings } from '../types/nav'
import {
  createDefaultConfig,
  loadInitialConfig,
  saveConfigToLocal,
  exportConfigFile,
  importConfigFile,
  clearLocalConfig,
  normalizeConfig
} from '../services/storage'
import {
  initIconCache,
  saveCachedIcon,
  removeCachedIcon,
  bumpIconVersion
} from '../services/iconCache'
import { resolveSiteFavicon } from '../services/faviconFetcher'
import { extractSiteTitle, getFaviconUrl, normalizeUrl } from '../utils/urlHelper'

/**
 * 对比前后配置，提取在新配置中已失效的图标缓存键（用于表格全量保存/导入时的缓存回收）
 */
export function collectStaleIconCacheKeys(prevConfig: NavConfig, nextConfig: NavConfig): string[] {
  const activeKeys = new Set<string>()
  const nextItemsById = new Map<string, NavItem>()

  for (const cat of nextConfig.categories || []) {
    for (const item of cat.items || []) {
      nextItemsById.set(item.id, item)
      if (item.url) activeKeys.add(item.url)
      const explicitIcon = item.icon?.trim()
      if (explicitIcon && !explicitIcon.startsWith('data:')) {
        activeKeys.add(explicitIcon)
      }
    }
  }

  const staleKeys = new Set<string>()
  for (const cat of prevConfig.categories || []) {
    for (const prevItem of cat.items || []) {
      const nextItem = nextItemsById.get(prevItem.id)
      const isRemoved = !nextItem
      const isModified =
        !!nextItem &&
        (nextItem.url !== prevItem.url || (nextItem.icon || '').trim() !== (prevItem.icon || '').trim())

      if (isRemoved || isModified) {
        if (prevItem.id) staleKeys.add(prevItem.id)
        if (prevItem.url && !activeKeys.has(prevItem.url)) {
          staleKeys.add(prevItem.url)
        }
        const prevIcon = prevItem.icon?.trim()
        if (prevIcon && !prevIcon.startsWith('data:') && !activeKeys.has(prevIcon)) {
          staleKeys.add(prevIcon)
        }
      }
    }
  }

  return Array.from(staleKeys)
}

/**
 * 统一导航配置与状态管理 Store（单一事实来源 + 持久化与缓存回收闭环）
 */
export function useNavStore() {
  const config = ref<NavConfig>(createDefaultConfig())
  const isLoaded = ref(false)
  const toastMessage = ref('')
  let toastTimer: number | null = null

  const showToast = (msg: string) => {
    toastMessage.value = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastMessage.value = ''
    }, 1800)
  }

  const persist = () => {
    saveConfigToLocal(config.value)
  }

  const findItemInStore = (itemId: string): NavItem | null => {
    for (const cat of config.value.categories) {
      const found = cat.items.find(i => i.id === itemId)
      if (found) return found
    }
    return null
  }

  const cacheResolvedIcon = async (siteUrl: string, resolvedIcon: string) => {
    if (!resolvedIcon.startsWith('data:')) {
      await saveCachedIcon(resolvedIcon, resolvedIcon)
    }
    if (siteUrl) {
      await saveCachedIcon(siteUrl, resolvedIcon)
    }
  }

  /**
   * 后台静默探测真实站点图标并持久化（用于新建卡片/拖入链接，消除“新建后还需手动右键刷新”的割裂）
   */
  const resolveAndUpgradeNewItemIcon = async (itemId: string, siteUrl: string, siteTitle?: string) => {
    try {
      const newIcon = await resolveSiteFavicon(siteUrl, siteTitle)
      if (!newIcon) return

      const target = findItemInStore(itemId)
      // 若卡片已被删除或用户期间已修改网址/上传了自定义 data 图标，则不覆盖
      if (!target || target.url !== siteUrl || target.icon?.startsWith('data:')) return

      target.icon = newIcon
      await cacheResolvedIcon(siteUrl, newIcon)
      bumpIconVersion(itemId)
      persist()
    } catch {
      // 静默回退至已有默认图标
    }
  }

  const initStore = async () => {
    await initIconCache()
    config.value = await loadInitialConfig()
    isLoaded.value = true
  }

  const updateSettings = (partial: Partial<NavSettings>) => {
    config.value.settings = {
      ...config.value.settings,
      ...partial
    }
    persist()
  }

  const updateFullConfig = (newConfig: NavConfig, toast = '已保存') => {
    const { config: normalized } = normalizeConfig(newConfig)
    const staleKeys = collectStaleIconCacheKeys(config.value, normalized)
    config.value = normalized
    persist()
    if (staleKeys.length > 0) {
      Promise.all(staleKeys.map(key => removeCachedIcon(key))).catch(() => {})
    }
    if (toast) showToast(toast)
  }

  const exportConfig = (filename = 'easynavi.json') => {
    exportConfigFile(config.value, filename)
    showToast('已导出')
  }

  const importConfig = async (file: File) => {
    const imported = await importConfigFile(file)
    updateFullConfig(imported, '已导入')
  }

  const resetToDefault = async () => {
    const previous = config.value
    clearLocalConfig()
    const reloaded = await loadInitialConfig()
    const staleKeys = collectStaleIconCacheKeys(previous, reloaded)
    config.value = reloaded
    if (staleKeys.length > 0) {
      Promise.all(staleKeys.map(key => removeCachedIcon(key))).catch(() => {})
    }
    showToast('已重置')
  }

  const recordItemClick = (item: NavItem) => {
    item.clickCount = (item.clickCount || 0) + 1
    persist()
  }

  const saveItem = async (payload: { item: NavItem; categoryId: string }) => {
    const { item, categoryId } = payload
    let previousItem: NavItem | undefined

    for (const cat of config.value.categories) {
      const idx = cat.items.findIndex(i => i.id === item.id)
      if (idx !== -1) {
        previousItem = cat.items[idx]
        cat.items.splice(idx, 1)
        break
      }
    }

    if (previousItem) {
      if (previousItem.url !== item.url || previousItem.icon !== item.icon) {
        await removeCachedIcon(previousItem.id)
        if (previousItem.icon) await removeCachedIcon(previousItem.icon)
        if (previousItem.url) await removeCachedIcon(previousItem.url)
        bumpIconVersion(item.id)
      }
    }

    let targetCat = config.value.categories.find(c => c.id === categoryId)
    if (!targetCat) {
      targetCat = config.value.categories[0]
    }

    if (targetCat) {
      if (item.pinned) {
        targetCat.items.unshift(item)
      } else {
        targetCat.items.push(item)
      }
      persist()
      showToast('已保存')

      // 全新站点且非用户手动上传的 DataURL 图标：后台静默异步探测真实图标并固化
      if (!previousItem && !item.icon?.startsWith('data:')) {
        void resolveAndUpgradeNewItemIcon(item.id, item.url, item.title)
      }
    }
  }

  const deleteItem = async (item: NavItem, categoryId?: string | null) => {
    const cleanCaches = async () => {
      await removeCachedIcon(item.id)
      if (item.icon) await removeCachedIcon(item.icon)
      if (item.url) await removeCachedIcon(item.url)
    }

    if (categoryId) {
      const cat = config.value.categories.find(c => c.id === categoryId)
      if (cat) {
        const idx = cat.items.findIndex(i => i.id === item.id)
        if (idx !== -1) {
          cat.items.splice(idx, 1)
          persist()
          await cleanCaches()
          showToast('已删除')
          return
        }
      }
    }

    for (const cat of config.value.categories) {
      const idx = cat.items.findIndex(i => i.id === item.id)
      if (idx !== -1) {
        cat.items.splice(idx, 1)
        persist()
        await cleanCaches()
        showToast('已删除')
        break
      }
    }
  }

  const refreshItemIcon = async (item: NavItem) => {
    const originalIcon = item.icon
    showToast('正在获取')
    try {
      await removeCachedIcon(item.id)
      if (originalIcon) await removeCachedIcon(originalIcon)
      if (item.url) await removeCachedIcon(item.url)

      const newIcon = await resolveSiteFavicon(item.url, item.title)
      if (newIcon) {
        item.icon = newIcon
        const target = findItemInStore(item.id)
        if (target) {
          target.icon = newIcon
        }
        await cacheResolvedIcon(item.url, newIcon)
        bumpIconVersion(item.id)
        persist()
        showToast('已更新')
      } else {
        item.icon = originalIcon
        showToast('已保留原图标')
      }
    } catch {
      item.icon = originalIcon
      showToast('已保留原图标')
    }
  }

  const dropUrlOnCategory = (categoryId: string, rawUrl: string) => {
    const finalUrl = normalizeUrl(rawUrl)
    const defaultTitle = extractSiteTitle(finalUrl)
    const favicon = getFaviconUrl(finalUrl, defaultTitle)

    const newItem: NavItem = {
      id: 'item-' + Date.now().toString(36),
      title: defaultTitle,
      url: finalUrl,
      icon: favicon,
      createdAt: Date.now(),
      clickCount: 0
    }

    const cat = config.value.categories.find(c => c.id === categoryId)
    if (cat) {
      cat.items.push(newItem)
      persist()
      showToast('已添加')
      if (!newItem.icon?.startsWith('data:')) {
        void resolveAndUpgradeNewItemIcon(newItem.id, newItem.url, newItem.title)
      }
    }
  }

  const saveCategory = (updatedCat: NavCategory, isCreating: boolean): boolean => {
    const cleanName = updatedCat.name.trim().toLowerCase()
    if (!cleanName) return false

    const isDuplicate = config.value.categories.some(c =>
      c.id !== updatedCat.id && c.name.trim().toLowerCase() === cleanName
    )
    if (isDuplicate) {
      showToast('名称已存在')
      return false
    }

    if (isCreating) {
      config.value.categories.push(updatedCat)
      persist()
      showToast('已创建')
      return true
    }

    const idx = config.value.categories.findIndex(c => c.id === updatedCat.id)
    if (idx !== -1) {
      config.value.categories[idx] = updatedCat
      persist()
      showToast('已更新')
      return true
    }

    return false
  }

  const deleteCategory = (categoryId: string) => {
    const idx = config.value.categories.findIndex(c => c.id === categoryId)
    if (idx === -1) return
    const [removed] = config.value.categories.splice(idx, 1)
    const staleKeys = collectStaleIconCacheKeys(
      { ...config.value, categories: [removed] },
      config.value
    )
    persist()
    if (staleKeys.length > 0) {
      Promise.all(staleKeys.map(key => removeCachedIcon(key))).catch(() => {})
    }
    showToast('已删除')
  }

  const moveCategory = (categoryId: string, direction: 'up' | 'down') => {
    const list = config.value.categories
    const idx = list.findIndex(c => c.id === categoryId)
    if (idx === -1) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= list.length) return

    const temp = list[idx]
    list[idx] = list[targetIdx]
    list[targetIdx] = temp

    persist()
    showToast(direction === 'up' ? '已上移' : '已下移')
  }

  const moveOrReorderCard = (
    sourceCategoryId: string,
    itemId: string,
    targetCategoryId: string,
    targetIndex: number
  ) => {
    const sourceCat = config.value.categories.find(c => c.id === sourceCategoryId)
    const targetCat = config.value.categories.find(c => c.id === targetCategoryId)
    if (!sourceCat || !targetCat) return false

    const itemIdx = sourceCat.items.findIndex(i => i.id === itemId)
    if (itemIdx === -1) return false

    const [movedItem] = sourceCat.items.splice(itemIdx, 1)
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetCat.items.length))
    targetCat.items.splice(clampedIndex, 0, movedItem)

    if (sourceCategoryId !== targetCategoryId) {
      showToast('已移动')
    }
    persist()
    return true
  }

  const dispose = () => {
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
  }

  return {
    config,
    isLoaded,
    toastMessage,
    showToast,
    initStore,
    persist,
    updateSettings,
    updateFullConfig,
    exportConfig,
    importConfig,
    resetToDefault,
    recordItemClick,
    saveItem,
    deleteItem,
    refreshItemIcon,
    dropUrlOnCategory,
    saveCategory,
    deleteCategory,
    moveCategory,
    moveOrReorderCard,
    dispose
  }
}
