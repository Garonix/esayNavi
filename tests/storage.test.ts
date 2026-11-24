import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CLICKS_STORAGE_KEY,
  LOCAL_STORAGE_KEY,
  clearLocalConfig,
  ensureUniqueItemIds,
  loadInitialConfig,
  normalizeConfig,
  saveConfigToLocal
} from '../src/services/storage'
import { LOCAL_ICON_PREFIX, buildIconAssetKey, getCachedIconSync } from '../src/services/iconCache'
import type { NavConfig } from '../src/types/nav'

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('normalizes legacy background types and missing searchEngines', () => {
    const legacyRaw = {
      version: '1.0.0',
      settings: {
        title: 'MyNav',
        background: 'particles',
        customBackground: {
          type: 'mesh',
          url: '',
          opacity: 50,
          blur: 6,
          parallax: false
        },
        searchEngine: 'google',
        openInNewTab: false
      },
      categories: [
        {
          id: 'c1',
          name: '常用',
          items: [{ id: 'dup', title: 'A', url: 'https://a.com' }, { id: 'dup', title: 'B', url: 'https://b.com' }]
        }
      ]
    }

    const { config, modified } = normalizeConfig(legacyRaw)
    expect(modified).toBe(true)
    expect(config.settings.background).toBe('white')
    expect(config.settings.customBackground?.type).toBe('white')
    expect(config.settings.searchEngines?.length).toBeGreaterThan(0)
    expect(config.settings.openInNewTab).toBe(false)
    expect(config.categories[0].items[0].id).not.toBe(config.categories[0].items[1].id)
  })

  it('ensureUniqueItemIds deduplicates repeated IDs across categories', () => {
    const cfg: NavConfig = {
      version: '1.2.2',
      settings: {
        title: 'EasyNavi',
        background: 'white',
        searchEngine: 'google',
        openInNewTab: true,
        showSearch: true
      },
      categories: [
        { id: 'c1', name: 'One', items: [{ id: 'same', title: 'A', url: 'https://a.com' }] },
        { id: 'c2', name: 'Two', items: [{ id: 'same', title: 'B', url: 'https://b.com' }] }
      ]
    }

    const changed = ensureUniqueItemIds(cfg)
    expect(changed).toBe(true)
    expect(cfg.categories[0].items[0].id).toBe('same')
    expect(cfg.categories[1].items[0].id).not.toBe('same')
  })

  it('clearLocalConfig removes current v6 key and all legacy keys', () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, '{"categories":[]}')
    localStorage.setItem('easynavi_config_v5', '{"categories":[]}')
    localStorage.setItem('easynavi_config_v1', '{"categories":[]}')

    clearLocalConfig()

    expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('easynavi_config_v5')).toBeNull()
    expect(localStorage.getItem('easynavi_config_v1')).toBeNull()
  })

  it('loadInitialConfig reads cached v6 config and falls back to nav.json when cleared', async () => {
    const cachedCfg: NavConfig = {
      version: '1.2.2',
      settings: {
        title: 'Cached',
        background: 'white',
        searchEngine: 'bing',
        openInNewTab: true,
        showSearch: true
      },
      categories: [{ id: 'c1', name: 'Local', items: [{ id: 'i1', title: 'Site', url: 'https://example.com' }] }]
    }
    saveConfigToLocal(cachedCfg)

    const loadedFromCache = await loadInitialConfig()
    expect(loadedFromCache.settings.searchEngine).toBe('bing')
    expect(loadedFromCache.categories[0].name).toBe('Local')

    clearLocalConfig()
    const remoteMock = {
      version: '1.2.2',
      settings: { title: 'Remote', background: 'white', searchEngine: 'google', openInNewTab: true, showSearch: true },
      categories: [{ id: 'daily', name: '常用应用', items: [{ id: 'r1', title: 'GitHub', url: 'https://github.com' }] }]
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => remoteMock }))

    const loadedFromRemote = await loadInitialConfig()
    expect(loadedFromRemote.settings.title).toBe('Remote')
    expect(loadedFromRemote.categories[0].items[0].title).toBe('GitHub')
  })

  it('dehydrates DataURL icons and separates click counts from main localStorage payload', async () => {
    const bigDataIcon = 'data:image/png;base64,' + 'A'.repeat(256)
    const cfg: NavConfig = {
      version: '1.2.2',
      settings: { title: 'EasyNavi', background: 'white', searchEngine: 'google', openInNewTab: true, showSearch: true },
      categories: [
        {
          id: 'c1',
          name: '常用',
          items: [{ id: 'i1', title: 'Custom', url: 'https://custom.dev', icon: bigDataIcon, clickCount: 7 }]
        }
      ]
    }

    const res = saveConfigToLocal(cfg)
    expect(res.ok).toBe(true)

    const rawStored = localStorage.getItem(LOCAL_STORAGE_KEY) || ''
    expect(rawStored).not.toContain('data:image/png')
    expect(rawStored).toContain(LOCAL_ICON_PREFIX)
    expect(rawStored).not.toContain('"clickCount"')

    const clicksStored = JSON.parse(localStorage.getItem(CLICKS_STORAGE_KEY) || '{}')
    expect(clicksStored['i1']).toBe(7)

    const assetKey = buildIconAssetKey(bigDataIcon)
    expect(getCachedIconSync(assetKey)).toBe(bigDataIcon)

    const reloaded = await loadInitialConfig()
    expect(reloaded.categories[0].items[0].icon).toBe(bigDataIcon)
    expect(reloaded.categories[0].items[0].clickCount).toBe(7)
  })

  it('returns failure result instead of crashing when localStorage quota is exceeded', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const res = saveConfigToLocal({
      version: '1.2.2',
      settings: { title: 'EasyNavi', background: 'white', searchEngine: 'google', openInNewTab: true, showSearch: true },
      categories: []
    })

    expect(res.ok).toBe(false)
    setItemSpy.mockRestore()
  })
})
