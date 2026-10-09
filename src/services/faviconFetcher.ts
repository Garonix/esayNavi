import { normalizeUrl, isPrivateNetwork } from '../utils/urlHelper'
import { getHomelabIconUrl } from '../utils/homelabIcons'
import { normalizeToCompactIcon } from '../utils/imageHelper'

/**
 * 探测图像 URL 是否可成功加载并具备有效尺寸（不受浏览器 CORS 限制）
 */
export function testImageLoad(url: string, timeoutMs: number = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.trim()) return resolve(false)

    const img = new Image()
    let resolved = false

    const timer = window.setTimeout(() => {
      if (!resolved) {
        resolved = true
        img.src = ''
        resolve(false)
      }
    }, timeoutMs)

    img.onload = () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        // 排除 1x1 占位或损坏图像
        if (img.naturalWidth > 1 && img.naturalHeight > 1) {
          resolve(true)
        } else {
          resolve(false)
        }
      }
    }

    img.onerror = () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(false)
      }
    }

    img.src = url
  })
}

/**
 * 尝试通过 fetch + CORS 导出为标准化紧凑 DataURL
 */
async function tryConvertToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) {
      const blob = await res.blob()
      if (blob.size > 0) {
        return await normalizeToCompactIcon(blob, 128)
      }
    }
  } catch {
    // 跨域受阻属正常安全边界
  }
  return null
}

/**
 * 访问目标网站直接获取对应 Favicon：
 * 1. 优先直连目标网站根目录获取原生 favicon.ico
 * 2. 匹配自建 Homelab 官方高清单品图标库
 * 3. 公网环境降级至 Google / DuckDuckGo 高可用 Favicon 服务
 * 4. 成功后尝试转换为 DataURL 固化存储，未成功则返回有效直连 URL
 */
export async function resolveSiteFavicon(siteUrl: string, siteTitle?: string): Promise<string | null> {
  try {
    const normalized = normalizeUrl(siteUrl)
    if (!normalized) return null

    const urlObj = new URL(normalized)
    const origin = urlObj.origin
    const domain = urlObj.hostname

    // 1. 优先访问目标网站原生根目录 favicon.ico
    const directFaviconUrl = `${origin}/favicon.ico`
    const isDirectOk = await testImageLoad(directFaviconUrl, 2200)
    if (isDirectOk) {
      const dataUrl = await tryConvertToDataUrl(directFaviconUrl)
      return dataUrl || directFaviconUrl
    }

    // 2. 匹配自建服务特征库
    const homelabIcon = getHomelabIconUrl(siteTitle || '') || getHomelabIconUrl(domain) || getHomelabIconUrl(urlObj.pathname)
    if (homelabIcon) {
      const isHomelabOk = await testImageLoad(homelabIcon, 2200)
      if (isHomelabOk) {
        const dataUrl = await tryConvertToDataUrl(homelabIcon)
        return dataUrl || homelabIcon
      }
    }

    // 3. 私有内网地址若根目录无 favicon.ico，直接停止，绝不请求外网
    if (isPrivateNetwork(domain)) {
      return null
    }

    // 4. 公网备用源：Google Favicon 服务（支持 128px 高清并解析真实 HTML <link rel="icon">）
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    const isGoogleOk = await testImageLoad(googleFaviconUrl, 2200)
    if (isGoogleOk) {
      const dataUrl = await tryConvertToDataUrl(googleFaviconUrl)
      return dataUrl || googleFaviconUrl
    }

    // 5. 次级备用源：DuckDuckGo Favicon 服务
    const ddgFaviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
    const isDdgOk = await testImageLoad(ddgFaviconUrl, 1800)
    if (isDdgOk) {
      const dataUrl = await tryConvertToDataUrl(ddgFaviconUrl)
      return dataUrl || ddgFaviconUrl
    }

    return null
  } catch {
    return null
  }
}
