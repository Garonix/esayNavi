/**
 * 本地持久化图标缓存服务 (IndexedDB + 内存二级缓存)
 * 作用：将站点的 Favicon / 图标以 DataURL/Base64 固化到浏览器本地数据库中，
 * 避免每次刷新页面或重新打开浏览器时重复发送网络请求，实现图标毫秒级瞬开。
 */

const DB_NAME = 'easynavi_icon_cache_v2'
const STORE_NAME = 'icons'
const DB_VERSION = 1

// 内存一级缓存 (当前会话极速直出)
const memoryCache = new Map<string, string>()

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported'))
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })

  return dbPromise
}

/**
 * 从本地缓存获取图标 (先查内存，再查 IndexedDB)
 */
export async function getCachedIcon(url: string): Promise<string | null> {
  if (!url) return null

  // 1. 命中内存缓存
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!
  }

  // 2. 查询 IndexedDB
  try {
    const db = await getDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(url)

      request.onsuccess = () => {
        const val = request.result
        if (typeof val === 'string' && val.startsWith('data:')) {
          memoryCache.set(url, val)
          resolve(val)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

/**
 * 将图标 DataURL 存入本地缓存
 */
export async function saveCachedIcon(url: string, dataUrl: string): Promise<void> {
  if (!url || !dataUrl || !dataUrl.startsWith('data:')) return

  // 写入内存
  memoryCache.set(url, dataUrl)

  // 异步写入 IndexedDB
  try {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(dataUrl, url)
  } catch {
    // 忽略私密窗口或存储限额警告
  }
}

/**
 * 将已有 <img> 元素内容转换为 DataURL 并缓存（支持跨域导出的资源生效）
 */
export async function cacheIconFromImageElement(img: HTMLImageElement, url: string): Promise<string | null> {
  if (!url || !img || !img.naturalWidth || !img.naturalHeight) return null
  if (memoryCache.has(url)) return memoryCache.get(url)!

  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(img.naturalWidth || 64, 128)
    canvas.height = Math.min(img.naturalHeight || 64, 128)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    if (dataUrl && dataUrl.startsWith('data:image/png;base64,') && dataUrl.length > 60) {
      await saveCachedIcon(url, dataUrl)
      return dataUrl
    }
  } catch {
    // 跨域受阻 (Tainted canvas) 属正常浏览器安全边界，依赖原生 Disk Cache 极速加载，绝不影响展示
    return null
  }

  return null
}

/**
 * 跨域兜底：通过 fetch 获取 blob 转换成 base64 存入缓存
 */
export async function tryFetchAndCacheIcon(url: string): Promise<string | null> {
  if (!url || url.startsWith('data:')) return null
  if (memoryCache.has(url)) return memoryCache.get(url)!

  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const result = reader.result as string
        if (result && result.startsWith('data:')) {
          await saveCachedIcon(url, result)
          resolve(result)
        } else {
          resolve(null)
        }
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
