import { normalizeUrl, isPrivateNetwork } from '../utils/urlHelper'
import { getHomelabIconUrl } from '../utils/homelabIcons'
import { normalizeToCompactIcon } from '../utils/imageHelper'

const ICON_REL_PRIORITY: Record<string, number> = {
  'icon': 1,
  'shortcut icon': 2,
  'apple-touch-icon': 3,
  'apple-touch-icon-precomposed': 4,
  'mask-icon': 5
}

/**
 * 探测图像 URL 是否可成功加载并具备有效尺寸
 */
export function testImageLoad(url: string, timeoutMs: number = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.trim()) return resolve(false)
    if (url.startsWith('data:image/')) return resolve(true)

    const isSvg = /\.svg(?:[?#].*)?$/i.test(url) || url.startsWith('data:image/svg+xml')
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
        if (isSvg) {
          // 部分无显式 width/height 的矢量 SVG 在 img 中 naturalWidth 可能为 0，只要成功解码且非 1x1 占位即视为有效
          resolve(img.naturalWidth !== 1 && img.naturalHeight !== 1)
        } else {
          resolve(img.naturalWidth > 1 && img.naturalHeight > 1)
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
 * 尝试通过 fetch + CORS 导出为标准化紧凑 DataURL（过滤 HTML 错误页等非图片响应）
 */
async function tryConvertToDataUrl(url: string, timeoutMs: number = 2500): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await fetch(url, {
      mode: 'cors',
      signal: controller?.signal
    })
    if (!res.ok) return null

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (
      contentType &&
      !contentType.startsWith('image/') &&
      !contentType.includes('octet-stream') &&
      !contentType.includes('svg')
    ) {
      return null
    }

    const blob = await res.blob()
    if (blob.size === 0) return null

    if (blob.type && blob.type.toLowerCase().includes('html')) {
      return null
    }

    return await normalizeToCompactIcon(blob, 128)
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 从网页 HTML 中解析 <link rel="icon"> / <link rel="apple-touch-icon"> 等候选图标地址
 */
export function extractFaviconCandidatesFromHtml(html: string, pageUrl: string): string[] {
  if (!html || !pageUrl || typeof DOMParser === 'undefined') return []

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const links = Array.from(doc.querySelectorAll('link[href]'))
    const scored: { url: string; score: number }[] = []

    for (const link of links) {
      const rel = (link.getAttribute('rel') || '').toLowerCase().trim().replace(/\s+/g, ' ')
      const href = (link.getAttribute('href') || '').trim()
      if (!href) continue

      const matchedRel = Object.keys(ICON_REL_PRIORITY).find(key =>
        rel === key || rel.split(' ').includes(key)
      )
      if (!matchedRel) continue

      let resolvedUrl = href
      if (!href.startsWith('data:')) {
        try {
          resolvedUrl = new URL(href, pageUrl).toString()
        } catch {
          continue
        }
      }

      const typeAttr = (link.getAttribute('type') || '').toLowerCase()
      const isSvg = typeAttr.includes('svg') || /\.svg(?:[?#].*)?$/i.test(resolvedUrl)
      const isPng = typeAttr.includes('png') || /\.png(?:[?#].*)?$/i.test(resolvedUrl)

      // 优先级分数越小越靠前：SVG > 高清 PNG / apple-touch-icon > 普通 ICO
      let score = ICON_REL_PRIORITY[matchedRel]
      if (isSvg) score -= 25
      else if (isPng) score -= 15

      scored.push({ url: resolvedUrl, score })
    }

    scored.sort((a, b) => a.score - b.score)

    const deduped: string[] = []
    const seen = new Set<string>()
    for (const entry of scored) {
      if (!seen.has(entry.url)) {
        seen.add(entry.url)
        deduped.push(entry.url)
      }
    }
    return deduped
  } catch {
    return []
  }
}

/**
 * 根据目标 URL 构造常见原生图标路径候选列表（覆盖子路径与根路径的 svg/png/ico/apple-touch-icon）
 */
export function buildStandardFaviconCandidates(siteUrl: string): string[] {
  try {
    const urlObj = new URL(siteUrl)
    const origin = urlObj.origin
    const candidates: string[] = []

    // 若站点部署在子路径（如 http://host/rssui/ 或 http://host/rssui），优先探测该子路径下图标
    const path = urlObj.pathname
    if (path && path !== '/') {
      const dirPath = path.endsWith('/')
        ? path
        : path.includes('.')
          ? path.slice(0, path.lastIndexOf('/') + 1)
          : `${path}/`
      if (dirPath && dirPath !== '/') {
        const base = `${origin}${dirPath}`
        candidates.push(
          `${base}favicon.svg`,
          `${base}favicon.png`,
          `${base}favicon.ico`
        )
      }
    }

    candidates.push(
      `${origin}/favicon.svg`,
      `${origin}/favicon.png`,
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`
    )

    return Array.from(new Set(candidates))
  } catch {
    return []
  }
}

/**
 * 尝试通过 CORS fetch 目标页面 HTML 提取真实 <link rel="icon"> 地址
 */
async function tryFetchHtmlIconCandidates(siteUrl: string, timeoutMs: number = 1800): Promise<string[]> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const res = await fetch(siteUrl, {
      mode: 'cors',
      signal: controller?.signal
    })
    if (!res.ok) return []

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.includes('html') && !contentType.includes('xhtml')) {
      return []
    }

    const html = await res.text()
    return extractFaviconCandidatesFromHtml(html, res.url || siteUrl)
  } catch {
    return []
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 探测单个候选图标地址：优先通过 CORS 转 DataURL（命中即返回，无需等待超时），跨域受阻时回退到 <img> 加载检测
 */
async function probeCandidate(
  candidateUrl: string,
  timeoutMs: number
): Promise<{ url: string; dataUrl: string | null } | null> {
  if (candidateUrl.startsWith('data:image/')) {
    return { url: candidateUrl, dataUrl: candidateUrl }
  }

  const imgPromise = testImageLoad(candidateUrl, timeoutMs)
  const dataUrl = await tryConvertToDataUrl(candidateUrl, timeoutMs)
  if (dataUrl) {
    return { url: candidateUrl, dataUrl }
  }

  const imgOk = await imgPromise
  return imgOk ? { url: candidateUrl, dataUrl: null } : null
}

/**
 * 并行探测一组候选图标地址，按原列表优先级返回首个可用图标（优先转为紧凑 DataURL）
 */
export async function probeFirstValidIcon(
  candidates: string[],
  timeoutMs: number = 2200
): Promise<string | null> {
  if (!candidates.length) return null

  const checks = await Promise.all(
    candidates.map(candidateUrl => probeCandidate(candidateUrl, timeoutMs))
  )

  const hit = checks.find(Boolean)
  if (!hit) return null
  return hit.dataUrl || hit.url
}

/**
 * 访问目标网站直接获取对应 Favicon：
 * 1. 尝试直连目标页面 HTML 解析真实 <link rel="icon">（支持 CORS 或同源站点）
 * 2. 并行探测标准原生路径（子路径与根路径下的 favicon.svg / favicon.png / favicon.ico / apple-touch-icon.png）
 * 3. 匹配自建 Homelab 高清单品图标库
 * 4. 私有内网到此结束（保护内网拓扑不外泄）
 * 5. 公网环境降级至 icon.horse / Google / DuckDuckGo 高可用 Favicon 服务
 */
export async function resolveSiteFavicon(siteUrl: string, siteTitle?: string): Promise<string | null> {
  try {
    const normalized = normalizeUrl(siteUrl)
    if (!normalized) return null

    const urlObj = new URL(normalized)
    const domain = urlObj.hostname

    // 1. 尝试解析目标页面 HTML 中的真实图标声明
    const htmlCandidates = await tryFetchHtmlIconCandidates(normalized, 1800)
    if (htmlCandidates.length > 0) {
      const resolvedFromHtml = await probeFirstValidIcon(htmlCandidates, 2200)
      if (resolvedFromHtml) return resolvedFromHtml
    }

    // 2. 并行探测常见原生标准路径（svg / png / ico / apple-touch-icon）
    const standardCandidates = buildStandardFaviconCandidates(normalized)
    const resolvedFromStandard = await probeFirstValidIcon(standardCandidates, 2200)
    if (resolvedFromStandard) return resolvedFromStandard

    // 3. 匹配自建服务特征库 (严格通过标题与域名判断)
    const homelabIcon = getHomelabIconUrl(siteTitle || '') || getHomelabIconUrl(domain)
    if (homelabIcon) {
      const resolvedHomelab = await probeFirstValidIcon([homelabIcon], 2200)
      if (resolvedHomelab) return resolvedHomelab
    }

    // 4. 若为私有内网地址，探测结束（保护内网拓扑，绝不向外泄露）
    if (isPrivateNetwork(domain)) {
      return null
    }

    // 5. 公网站点高可用 Favicon 智能解析管线
    const fallbackSources = [
      `https://icon.horse/icon/${domain}`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`
    ]

    for (const sourceUrl of fallbackSources) {
      const resolvedFallback = await probeFirstValidIcon([sourceUrl], 2500)
      if (resolvedFallback) return resolvedFallback
    }

    return null
  } catch {
    return null
  }
}
