import type { NavConfig, WebDavConfig } from '../types/nav'
import { ensureUniqueItemIds } from './storage'

/**
 * 格式化并补全 WebDAV 目标文件完整路径
 */
function getFullWebDavUrl(config: WebDavConfig): string {
  let base = (config.url || '').trim()
  if (!base) throw new Error('WebDAV 服务器地址不能为空')
  
  if (!/^https?:\/\//i.test(base)) {
    base = 'https://' + base
  }

  const filename = (config.filename || 'nav.json').trim()
  if (base.endsWith('/')) {
    return base + filename
  }
  if (base.endsWith('.json')) {
    return base
  }
  return base + '/' + filename
}

/**
 * 生成 HTTP Basic Auth 头部
 */
function getAuthHeader(config: WebDavConfig): Record<string, string> {
  if (!config.username) return {}
  const credentials = `${config.username}:${config.password || ''}`
  // 支持 UTF-8 的 Base64 编码
  const encoded = btoa(unescape(encodeURIComponent(credentials)))
  return {
    Authorization: `Basic ${encoded}`
  }
}

/**
 * 测试 WebDAV 连通性
 */
export async function testWebDavConnection(config: WebDavConfig): Promise<{ success: boolean; message: string }> {
  try {
    const fullUrl = getFullWebDavUrl(config)
    const headers = {
      ...getAuthHeader(config)
    }

    // 先尝试 PROPFIND 或 HEAD / GET
    const res = await fetch(fullUrl, {
      method: 'HEAD',
      headers
    })

    if (res.status === 200 || res.status === 204 || res.status === 404) {
      // 404 说明服务连通，只是文件尚未创建，可进行写入
      return { success: true, message: '连接成功' }
    }

    if (res.status === 401 || res.status === 403) {
      return { success: false, message: '鉴权失败：用户名或密码错误' }
    }

    return { success: false, message: `连接异常，HTTP 状态码: ${res.status}` }
  } catch (err: any) {
    return { success: false, message: err?.message || '网络连接失败，请检查地址或跨域设置' }
  }
}

/**
 * 从 WebDAV 拉取配置物理文件
 */
export async function pullFromWebDav(config: WebDavConfig): Promise<NavConfig> {
  const fullUrl = getFullWebDavUrl(config)
  const headers = {
    ...getAuthHeader(config),
    'Cache-Control': 'no-cache'
  }

  const res = await fetch(fullUrl + '?t=' + Date.now(), {
    method: 'GET',
    headers
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('WebDAV 服务器上尚未找到配置文件，请先执行“上传云端”')
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('WebDAV 权限受阻：用户名或密码错误')
    }
    throw new Error(`从 WebDAV 拉取失败，HTTP ${res.status}`)
  }

  const text = await res.text()
  const parsed = JSON.parse(text)
  if (!parsed.categories || !Array.isArray(parsed.categories)) {
    throw new Error('WebDAV 上的文件格式不符合 EasyNavi 配置规范')
  }

  ensureUniqueItemIds(parsed as NavConfig)
  return parsed as NavConfig
}

/**
 * 将配置物理文件上传覆盖至 WebDAV
 */
export async function pushToWebDav(config: WebDavConfig, navConfig: NavConfig): Promise<boolean> {
  const fullUrl = getFullWebDavUrl(config)
  const jsonStr = JSON.stringify(navConfig, null, 2)
  const headers = {
    ...getAuthHeader(config),
    'Content-Type': 'application/json;charset=utf-8'
  }

  const res = await fetch(fullUrl, {
    method: 'PUT',
    headers,
    body: jsonStr
  })

  if (res.ok || res.status === 201 || res.status === 204) {
    return true
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('WebDAV 权限受阻：无写入权限或用户名密码错误')
  }

  throw new Error(`上传至 WebDAV 失败，HTTP ${res.status}`)
}
