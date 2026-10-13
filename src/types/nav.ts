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

export type BackgroundType = 'white' | 'mesh' | 'image'

export interface BackgroundConfig {
  type: BackgroundType
  url: string
  localKey?: string
  opacity: number // 蒙层透明度 0-100
  blur: number // 蒙层模糊度 0-30
  parallax: boolean // 视差滚动
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
  showFrequentBar?: boolean // 智能常用置顶流 (兼容旧配置)
  cardDensity?: 'compact' | 'normal' | 'relaxed' // 单行图标数量/密度调节
  categorySpacing?: 'compact' | 'normal' | 'relaxed' // 分类显示间距调节
}

export interface NavConfig {
  version: string
  settings: NavSettings
  categories: NavCategory[]
}
