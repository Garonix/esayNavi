import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNavStore } from '../src/composables/useNavStore'
import { LOCAL_STORAGE_KEY } from '../src/services/storage'

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
})
