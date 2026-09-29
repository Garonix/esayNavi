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
 * 1. 优先匹配 Homelab / 自建服务特征库（如 qbit, homeassistant, dockge, emby 等）
 * 2. 公网域名调用 Google Favicon API
 * 3. 内网域名尝试探测根目录 favicon.ico
 */
export function getFaviconUrl(urlStr: string, siteTitle?: string): string {
  try {
    const normalized = normalizeUrl(urlStr)
    const url = new URL(normalized)
    const domain = url.hostname

    // 1. 优先探测是否命中自建服务 / Homelab 特征词典
    const homelabIcon = getHomelabIconUrl(siteTitle || '') || getHomelabIconUrl(domain) || getHomelabIconUrl(url.pathname)
    if (homelabIcon) {
      return homelabIcon
    }

    // 2. 若是私有局域网 IP/域名，绝不请求外网 Google Favicon（必不可达）
    if (isPrivateNetwork(domain)) {
      return `${url.origin}/favicon.ico`
    }

    // 3. 公网域名使用 Google Favicon 服务
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
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
