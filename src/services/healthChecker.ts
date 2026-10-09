import { ref } from 'vue'
import type { NavCategory, NavItem } from '../types/nav'

export type HealthStatus = 'healthy' | 'unhealthy' | 'checking' | 'unknown'

// 全局响应式健康状态字典 (itemId -> HealthStatus)
export const healthStatusMap = ref<Record<string, HealthStatus>>({})

/**
 * 探测单个站点的存活性
 */
export async function probeSiteHealth(item: NavItem, timeoutMs: number = 2200): Promise<HealthStatus> {
  const url = item.internalUrl || item.url
  if (!url) return 'unknown'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // 1. 若有图标且为 http 链接，先尝试轻量图像探测
    if (item.icon && /^https?:\/\//i.test(item.icon)) {
      const imgOk = await new Promise<boolean>((resolve) => {
        const img = new Image()
        const t = setTimeout(() => {
          img.src = ''
          resolve(false)
        }, 1800)

        img.onload = () => {
          clearTimeout(t)
          resolve(true)
        }
        img.onerror = () => {
          clearTimeout(t)
          resolve(false)
        }
        img.src = item.icon!
      })

      if (imgOk) {
        clearTimeout(timer)
        return 'healthy'
      }
    }

    // 2. 利用 no-cors 模式探测 HTTP 端口握手
    // 若服务在线 (即使返回 401/403/404/500/认证拦截)，浏览器都会 resolve opaque response
    // 只有在端口宕机、超时或拒绝连接时，才会发生 TypeError (Failed to fetch)
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    })

    clearTimeout(timer)
    return 'healthy'
  } catch (err: any) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') {
      return 'unhealthy'
    }
    // 第二次平滑重试：避免偶发冷启动丢包
    return 'unhealthy'
  }
}

/**
 * 并发控制队列：批量探测所有站点的存活状态
 */
let isCheckingRunning = false

export async function runHealthCheckForAll(categories: NavCategory[], maxConcurrency = 5): Promise<void> {
  if (isCheckingRunning) return
  isCheckingRunning = true

  const allItems: NavItem[] = []
  for (const cat of categories) {
    for (const item of cat.items) {
      allItems.push(item)
    }
  }

  // 先将所有卡片标记为 checking 准备中
  for (const item of allItems) {
    if (!healthStatusMap.value[item.id]) {
      healthStatusMap.value[item.id] = 'checking'
    }
  }

  // 并发池队列执行
  let cursor = 0
  const executing: Promise<void>[] = []

  const enqueue = async () => {
    while (cursor < allItems.length) {
      const item = allItems[cursor++]
      healthStatusMap.value[item.id] = 'checking'

      const task = (async () => {
        const status = await probeSiteHealth(item)
        healthStatusMap.value[item.id] = status
      })()

      executing.push(task)
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing)
        const finishedIdx = executing.findIndex(p => (p as any).done)
        if (finishedIdx !== -1) executing.splice(finishedIdx, 1)
      }
    }
  }

  try {
    await enqueue()
    await Promise.all(executing)
  } finally {
    isCheckingRunning = false
  }
}
