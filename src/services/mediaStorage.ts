const DB_NAME = 'easynavi_media_db'
const STORE_NAME = 'media_files'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function saveLocalMedia(file: File): Promise<{ key: string; objectUrl: string }> {
  const db = await openDB()
  const key = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(file, key)
    req.onsuccess = () => {
      const objectUrl = URL.createObjectURL(file)
      resolve({ key, objectUrl })
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getLocalMediaUrl(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      if (req.result instanceof Blob) {
        resolve(URL.createObjectURL(req.result))
      } else {
        resolve(null)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteLocalMedia(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
