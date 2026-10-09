export interface NavItem {
  id: string
  title: string
  url: string
  desc?: string
  icon?: string
  color?: string
  pinned?: boolean
  createdAt?: number
  clickCount?: number
  internalUrl?: string
}

export interface NavCategory {
  id: string
  name: string
  icon?: string
  items: NavItem[]
}

export type BackgroundType = 'white' | 'mesh' | 'particles' | 'image' | 'video'

export interface BackgroundConfig {
  type: BackgroundType
  url: string
  localKey?: string
  opacity: number // 蒙层透明度 0-100
  blur: number // 蒙层模糊度 0-30
  parallax: boolean // 视差滚动
}

export interface WebDavConfig {
  enabled: boolean
  url: string
  username: string
  password?: string
  filename?: string
  autoSync?: boolean
}

export interface NavSettings {
  title: string
  theme: 'dark' | 'light' | 'auto'
  background: BackgroundType
  customBackground?: BackgroundConfig
  searchEngine: 'google' | 'bing' | 'baidu' | 'duckduckgo' | 'github'
  openInNewTab: boolean
  showClock: boolean
  showSearch: boolean
  showFrequentBar?: boolean // 智能常用置顶流
  enableHealthCheck?: boolean // 自建服务存活探针
  webdav?: WebDavConfig
}

export interface NavConfig {
  version: string
  settings: NavSettings
  categories: NavCategory[]
}
