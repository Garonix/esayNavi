/**
 * 知名自建 (Self-Hosted / Homelab) 服务高清图标库映射表
 * 数据来源：全球 Homelab 事实标准 walkxcode/dashboard-icons (通过 jsDelivr 高速 CDN 交付)
 */
const DASHBOARD_ICON_BASE = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/'

/**
 * 严格全词匹配的关键词映射 (全部小写)
 */
const HOMELAB_MAP: Record<string, string> = {
  // 下载与传输
  'qbit': 'qbittorrent.png',
  'qbittorrent': 'qbittorrent.png',
  'transmission': 'transmission.png',
  'aria2': 'aria2.png',
  'deluge': 'deluge.png',

  // 容器与系统底座
  'docker': 'docker.png',
  'dockge': 'docker.png',
  'portainer': 'portainer.png',
  'openwrt': 'openwrt.png',
  'router': 'openwrt.png',
  'pve': 'proxmox.png',
  'proxmox': 'proxmox.png',
  'unraid': 'unraid.png',
  'truenas': 'truenas.png',
  'fnos': 'truenas.png',

  // 智能家居 (严禁模糊包含，只允许严格全等匹配)
  'homeassistant': 'home-assistant.png',
  'home-assistant': 'home-assistant.png',
  'ha': 'home-assistant.png',
  'zigbee2mqtt': 'zigbee2mqtt.png',

  // 密码与安全
  'bitwarden': 'bitwarden.png',
  'vaultwarden': 'vaultwarden.png',
  'easytier': 'wireguard.png',
  'wireguard': 'wireguard.png',
  'tailscale': 'tailscale.png',
  '打洞': 'wireguard.png',

  // 网关与代理
  'npm': 'nginx-proxy-manager.png',
  'nginx': 'nginx.png',
  'traefik': 'traefik.png',
  'clash': 'clash.png',
  'mihomo': 'clash.png',
  '代理池': 'clash.png',

  // 影音与流媒体
  'emby': 'emby.png',
  'jellyfin': 'jellyfin.png',
  'plex': 'plex.png',
  'navidrome': 'navidrome.png',
  'subsonic': 'subsonic.png',
  'komga': 'komga.png',

  // 存储与网盘
  'alist': 'alist.png',
  'nextcloud': 'nextcloud.png',
  'owncloud': 'owncloud.png',
  'immich': 'immich.png',
  'lsky': 'lsky-pro.png',

  // 代码与开发协同
  'gitea': 'gitea.png',
  'gitlab': 'gitlab.png',

  // 笔记、绘图与效率
  'memos': 'memos.png',
  'draw': 'excalidraw.png',
  'excalidraw': 'excalidraw.png',
  'pdf': 'stirling-pdf.png',
  'stirling': 'stirling-pdf.png',
  'anirss': 'freshrss.png',
  'freshrss': 'freshrss.png',

  // 终端与运维管理
  'nexterm': 'powershell.png',
  'lucky': 'lucky.png'
}

/**
 * 严格语义匹配，彻底杜绝子串模糊误伤
 */
export function getHomelabIconUrl(titleOrUrl: string): string | null {
  if (!titleOrUrl) return null
  const clean = titleOrUrl.toLowerCase().trim()

  // 1. 标题完全全等匹配 (如 title === 'qbit' 或 'homeassistant' 或 'ha')
  if (HOMELAB_MAP[clean]) {
    return DASHBOARD_ICON_BASE + HOMELAB_MAP[clean]
  }

  // 2. 规范化分词匹配 (按 -、_、.、空格拆分，如 'qbit-outer' 拆出 'qbit' 和 'outer')
  const tokens = clean.split(/[-_.\s/:]+/)
  for (const token of tokens) {
    if (token && HOMELAB_MAP[token]) {
      // 避免误伤常见日常单词
      if (token === 'ha' && clean !== 'ha') continue
      if (token === 'draw' && clean !== 'draw') continue
      return DASHBOARD_ICON_BASE + HOMELAB_MAP[token]
    }
  }

  // 3. 若为 URL，仅检测子域名 (Subdomain) 是否完全全等于已知关键词 (如 'ha.zeges.top' -> 子域 'ha')
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const url = new URL(clean)
      const sub = url.hostname.split('.')[0]
      if (sub && HOMELAB_MAP[sub]) {
        return DASHBOARD_ICON_BASE + HOMELAB_MAP[sub]
      }
    }
  } catch {
    // 忽略解析错误
  }

  // 绝不胡乱猜测，未精准匹配一律返回 null，让其优雅展示首字母徽标
  return null
}
