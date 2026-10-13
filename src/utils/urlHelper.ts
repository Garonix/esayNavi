import { getHomelabIconUrl } from './homelabIcons'

/**
 * 常见知名站点的友好名称映射表
 */
const KNOWN_DOMAINS: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'gitee.com': 'Gitee',
  'v2ex.com': 'V2EX',
  'bilibili.com': '哔哩哔哩',
  'youtube.com': 'YouTube',
  'twitter.com': 'X (Twitter)',
  'x.com': 'X',
  'zhihu.com': '知乎',
  'weibo.com': '微博',
  'juejin.cn': '稀土掘金',
  'sspai.com': '少数派',
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'deepseek.com': 'DeepSeek',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'google.com': 'Google',
  'bing.com': 'Bing',
  'baidu.com': '百度',
  'stackoverflow.com': 'Stack Overflow',
  'developer.mozilla.org': 'MDN Web Docs',
  'npmjs.com': 'npm',
  'reddit.com': 'Reddit',
  'medium.com': 'Medium'
}

/**
 * 判断是否为私有局域网/内网地址
 */
export function isPrivateNetwork(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.lan') ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  )
}

/**
 * 补全 URL 协议并规范化
 */
export function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  return url
}

/**
 * 智能判定输入字符串是否为一个明确的直接网址 (而非普通搜索词)
 */
export function isDirectUrl(input: string): boolean {
  const text = input.trim()
  if (!text || /\s/.test(text)) return false

  // 1. 显式带有网络协议 (http://, https://)
  if (/^https?:\/\//i.test(text)) {
    try {
      new URL(text)
      return true
    } catch {
      return false
    }
  }

  // 2. 本地回环或私有开发主机名 (localhost, localhost:3000 等)
  if (/^localhost(?::\d+)?(?:\/.*)?$/i.test(text)) {
    return true
  }

  // 3. 常见 IPv4 格式地址 (如 192.168.1.1, 10.0.0.1:8080)
  if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/.*)?$/.test(text)) {
    return true
  }

  // 4. 标准域名格式 (例如 github.com, docs.vuejs.org, bilibili.com/video/xxx)
  // 顶级域名后缀限制为合法 2-24 位字符 (如 .com, .cn, .org, .net, .io, .ai, .dev, .local, .lan 等)
  const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}(?::\d+)?(?:\/.*)?$/
  if (domainRegex.test(text)) {
    return true
  }

  return false
}

/**
 * 将直接网址补全为可安全跳转的标准 URL
 */
export function toDirectUrl(input: string): string {
  const text = input.trim()
  if (/^https?:\/\//i.test(text)) return text

  // 本地 IP 或 localhost 默认使用 http:// 协议
  if (/^localhost(?::\d+)?/i.test(text) || /^(?:\d{1,3}\.){3}\d{1,3}/.test(text)) {
    return 'http://' + text
  }

  return 'https://' + text
}

/**
 * 从 URL 中提取并格式化友好的网站标题
 */
export function extractSiteTitle(urlStr: string): string {
  try {
    const normalized = normalizeUrl(urlStr)
    const url = new URL(normalized)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')

    // 1. 优先从已知字典匹配
    if (KNOWN_DOMAINS[hostname]) {
      return KNOWN_DOMAINS[hostname]
    }

    // 2. 匹配二级域名核心词，例如 "sub.example.com"
    const parts = hostname.split('.')
    let coreName = parts[0]
    if (parts.length >= 2) {
      coreName = parts.length > 2 && ['com', 'org', 'net', 'edu', 'gov', 'cn', 'io', 'top'].includes(parts[parts.length - 1]) 
        ? parts[parts.length - 2] 
        : parts[0]
    }

    return coreName.charAt(0).toUpperCase() + coreName.slice(1)
  } catch {
    return '新站点'
  }
}

/**
 * 智能获取网站图标：
 * 1. 优先匹配本地 Homelab / 自建服务特征库（如 qbit, homeassistant, dockge, emby 等）
 * 2. 依第一性原理，绝不使用任何不可靠的外部第三方 Favicon API
 */
export function getFaviconUrl(urlStr: string, siteTitle?: string): string {
  try {
    const normalized = normalizeUrl(urlStr)
    const url = new URL(normalized)
    const domain = url.hostname

    // 1. 优先探测是否命中自建服务 / Homelab 特征词典 (严格通过标题与域名判断)
    const homelabIcon = getHomelabIconUrl(siteTitle || '') || getHomelabIconUrl(domain)
    if (homelabIcon) {
      return homelabIcon
    }

    // 2. 无本地匹配时返回空，不主动发起任何外部第三方 API 请求
    return ''
  } catch {
    return ''
  }
}

/**
 * 蓝白质感首字母头像兜底（当图标最终依然加载失败时呈现工业设计级蓝白微标）
 */
export function getFallbackAvatar(name: string): { letter: string; gradient: string } {
  const cleanName = (name || 'Site').trim()
  const letter = cleanName.charAt(0).toUpperCase()
  
  return {
    letter,
    gradient: 'bg-blue-50 text-blue-600'
  }
}
