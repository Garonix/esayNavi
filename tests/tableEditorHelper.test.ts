import { describe, it, expect } from 'vitest'
import { categoriesToTableRows, buildNavConfigFromTableRows } from '../src/utils/tableEditorHelper'
import type { NavConfig } from '../src/types/nav'

describe('tableEditorHelper', () => {
  it('preserves clickCount, desc, createdAt, color and normalizes private URLs when saving', () => {
    const baseConfig: NavConfig = {
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
          name: '自建服务',
          icon: 'folder',
          items: [
            {
              id: 'item-1',
              title: 'NAS',
              url: '192.168.1.10:5000',
              desc: '群晖管理后台',
              color: '#3b82f6',
              createdAt: 1700000000000,
              clickCount: 42,
              pinned: true
            }
          ]
        }
      ]
    }

    const { rows, categoryMap, categoryNames } = categoriesToTableRows(baseConfig.categories)
    rows[0].title = 'Synology NAS'

    const saved = buildNavConfigFromTableRows(baseConfig, rows, categoryNames, categoryMap)
    const savedItem = saved.categories[0].items[0]

    expect(savedItem.title).toBe('Synology NAS')
    expect(savedItem.url).toBe('http://192.168.1.10:5000')
    expect(savedItem.desc).toBe('群晖管理后台')
    expect(savedItem.color).toBe('#3b82f6')
    expect(savedItem.createdAt).toBe(1700000000000)
    expect(savedItem.clickCount).toBe(42)
    expect(savedItem.pinned).toBe(true)
  })
})
