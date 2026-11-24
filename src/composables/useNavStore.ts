import { ref } from 'vue'
import type { NavConfig, NavCategory, NavItem, NavSettings } from '../types/nav'
import {
  createDefaultConfig,
  loadInitialConfig,
  saveConfigToLocal,
  exportConfigFile,
  importConfigFile,
  clearLocalConfig
} from '../services/storage'
import { initIconCache, saveCachedIcon, removeCachedIcon } from '../services/iconCache'
import { resolveSiteFavicon } from '../services/faviconFetcher'
import { extractSiteTitle, getFaviconUrl, normalizeUrl } from '../utils/urlHelper'

/**
 * 统一导航配置与状态管理 Store（单一事实来源 + 持久化闭环）
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
    config.value = newConfig
    persist()
    if (toast) showToast(toast)
  }

  const exportConfig = (filename = 'easynavi.json') => {
    exportConfigFile(config.value, filename)
    showToast('已导出')
  }

  const importConfig = async (file: File) => {
    const imported = await importConfigFile(file)
    config.value = imported
    persist()
    showToast('已导入')
  }

  const resetToDefault = async () => {
    clearLocalConfig()
    config.value = await loadInitialConfig()
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

    // 若 URL 或显式图标发生变化，清除旧图标缓存防止误命中
    if (previousItem) {
      if (previousItem.url !== item.url || previousItem.icon !== item.icon) {
        await removeCachedIcon(previousItem.id)
        if (previousItem.icon) await removeCachedIcon(previousItem.icon)
        if (previousItem.url) await removeCachedIcon(previousItem.url)
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
        await saveCachedIcon(newIcon, newIcon)
        await saveCachedIcon(item.url, newIcon)
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
    if (idx !== -1) {
      config.value.categories.splice(idx, 1)
      persist()
      showToast('已删除')
    }
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
