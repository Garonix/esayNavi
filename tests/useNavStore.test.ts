import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNavStore, collectStaleIconCacheKeys } from '../src/composables/useNavStore'
import { LOCAL_STORAGE_KEY } from '../src/services/storage'
import { saveCachedIcon, getCachedIconSync, getIconVersion } from '../src/services/iconCache'
import * as faviconFetcher from '../src/services/faviconFetcher'
import type { NavConfig } from '../src/types/nav'

describe('useNavStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('supports saving, reordering, moving categories, and resetting to default', async () => {
    const mockRemote = {
      version: '1.2.2',
      settings: {
        title: 'EasyNavi',
        background: 'white',
        searchEngine: 'google',
        openInNewTab: true,
        showSearch: true
      },
      categories: [
        {
          id: 'cat-1',
          name: '常用',
          items: [
            { id: 'i1', title: 'Alpha', url: 'https://alpha.com', clickCount: 0 },
            { id: 'i2', title: 'Beta', url: 'https://beta.com', clickCount: 0 }
          ]
        },
        {
          id: 'cat-2',
          name: '开发',
          items: []
        }
      ]
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockRemote }))
    vi.spyOn(faviconFetcher, 'resolveSiteFavicon').mockResolvedValue(null)

    const store = useNavStore()
    await store.initStore()

    expect(store.isLoaded.value).toBe(true)
    expect(store.config.value.categories).toHaveLength(2)

    // 新增置顶项应插到队列最前端
    await store.saveItem({
      categoryId: 'cat-1',
      item: { id: 'i3', title: 'Pinned', url: 'https://pinned.com', pinned: true }
    })
    expect(store.config.value.categories[0].items[0].id).toBe('i3')

    // 跨分类移动卡片
    const moved = store.moveOrReorderCard('cat-1', 'i2', 'cat-2', 0)
    expect(moved).toBe(true)
    expect(store.config.value.categories[1].items.map(i => i.id)).toEqual(['i2'])

    // 重名分类拦截
    const dupResult = store.saveCategory({ id: 'cat-3', name: '开发', items: [] }, true)
    expect(dupResult).toBe(false)

    // 修改搜索引擎并持久化
    store.updateSettings({ searchEngine: 'duckduckgo' })
    const savedRaw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
    expect(savedRaw.settings.searchEngine).toBe('duckduckgo')

    // 重置默认应清除 v6 缓存并重新载入默认配置
    await store.resetToDefault()
    expect(store.config.value.settings.searchEngine).toBe('google')
    expect(store.config.value.categories[1].items).toHaveLength(0)

    store.dispose()
  })

  it('collectStaleIconCacheKeys detects deleted/modified items while keeping shared active keys', () => {
    const prev: NavConfig = {
      version: '1.2.2',
      settings: { title: 'EasyNavi', background: 'white', searchEngine: 'google', openInNewTab: true, showSearch: true },
      categories: [
        {
          id: 'c1',
          name: 'One',
          items: [
            { id: 'keep', title: 'Keep', url: 'https://keep.com', icon: 'https://shared.com/icon.png' },
            { id: 'del', title: 'Del', url: 'https://del.com', icon: 'https://del.com/favicon.ico' },
            { id: 'shared-del', title: 'SharedDel', url: 'https://other.com', icon: 'https://shared.com/icon.png' }
          ]
        }
      ]
    }
    const next: NavConfig = {
      ...prev,
      categories: [
        {
          id: 'c1',
          name: 'One',
          items: [{ id: 'keep', title: 'Keep', url: 'https://keep.com', icon: 'https://shared.com/icon.png' }]
        }
      ]
    }

    const stale = collectStaleIconCacheKeys(prev, next)
    expect(stale).toContain('del')
    expect(stale).toContain('https://del.com')
    expect(stale).toContain('https://del.com/favicon.ico')
    expect(stale).toContain('https://other.com')
    expect(stale).not.toContain('https://shared.com/icon.png')
    expect(stale).not.toContain('https://keep.com')
  })

  it('updateFullConfig evicts stale icon cache entries and silent upgrade works for newly added sites', async () => {
    const store = useNavStore()
    store.config.value = {
      version: '1.2.2',
      settings: { title: 'EasyNavi', background: 'white', searchEngine: 'google', openInNewTab: true, showSearch: true },
      categories: [
        {
          id: 'c1',
          name: '常用',
          items: [{ id: 'old-1', title: 'Old', url: 'https://old.example.com', icon: 'https://old.example.com/favicon.ico' }]
        }
      ]
    }
    await saveCachedIcon('https://old.example.com', 'data:image/png;base64,old')
    await saveCachedIcon('https://old.example.com/favicon.ico', 'data:image/png;base64,old')

    // 表格全量保存移除 old-1，应自动清理旧缓存
    store.updateFullConfig({
      ...store.config.value,
      categories: [{ id: 'c1', name: '常用', items: [] }]
    })
    await Promise.resolve()
    expect(getCachedIconSync('https://old.example.com')).toBeNull()
    expect(getCachedIconSync('https://old.example.com/favicon.ico')).toBeNull()

    // 新建站点后台静默探测真实图标；用户上传的 data: 图标则不被覆盖
    const resolveSpy = vi
      .spyOn(faviconFetcher, 'resolveSiteFavicon')
      .mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')

    await store.saveItem({
      categoryId: 'c1',
      item: { id: 'new-auto', title: 'RSSUI', url: 'http://192.168.1.100:8080', icon: 'http://192.168.1.100:8080/favicon.ico' }
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(store.config.value.categories[0].items[0].icon).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')

    resolveSpy.mockClear()
    await store.saveItem({
      categoryId: 'c1',
      item: { id: 'new-custom', title: 'Custom', url: 'https://custom.dev', icon: 'data:image/png;base64,custom' }
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(resolveSpy).not.toHaveBeenCalled()

    // 同 URL 刷新也必须递增 iconVersion 以便 NavCard 复位错误状态
    const beforeVer = getIconVersion('new-auto')
    resolveSpy.mockResolvedValueOnce('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
    await store.refreshItemIcon(store.config.value.categories[0].items[0])
    expect(getIconVersion('new-auto')).toBe(beforeVer + 1)

    store.dispose()
  })
})
