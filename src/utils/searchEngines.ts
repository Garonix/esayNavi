import { h, type Component } from 'vue'

export interface SearchEngineItem {
  id: string
  name: string
  icon: Component
  url: string
}

// 品牌原生高品质 SVG 图标
export const GoogleIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#4285F4', d: 'M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z' }),
  h('path', { fill: '#34A853', d: 'M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z' }),
  h('path', { fill: '#FBBC05', d: 'M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z' }),
  h('path', { fill: '#EA4335', d: 'M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z' })
])

export const BingIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0', fill: 'none' }, [
  h('path', { fill: '#008373', d: 'M5.5 3L11 5V18.5L8.5 20L5.5 18V3Z' }),
  h('path', { fill: '#00A4EF', d: 'M11 5L17.5 9L15 13L11 10.5V5Z' }),
  h('path', { fill: '#00B294', d: 'M11 10.5L15 13L17.5 11.5L13.5 17L11 18.5V10.5Z' }),
  h('path', { fill: '#0078D4', d: 'M13.5 17L17.5 14.5L18.5 16.5L14.5 19.5L13.5 17Z' })
])

export const BaiduIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#2932E1', d: 'M12 11.5c-2.6 0-4.2 1.8-4.2 4.1 0 2 1.6 3.7 4.2 3.7s4.2-1.7 4.2-3.7c0-2.3-1.6-4.1-4.2-4.1z' }),
  h('circle', { fill: '#2932E1', cx: '6.8', cy: '9.2', r: '1.9' }),
  h('circle', { fill: '#2932E1', cx: '17.2', cy: '9.2', r: '1.9' }),
  h('circle', { fill: '#E10602', cx: '10.2', cy: '5.8', r: '1.9' }),
  h('circle', { fill: '#E10602', cx: '13.8', cy: '5.8', r: '1.9' })
])

export const GitHubIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0', fill: '#24292F' }, [
  h('path', {
    fillRule: 'evenodd',
    clipRule: 'evenodd',
    d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
  })
])

export const BilibiliIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('path', { fill: '#00A1D6', d: 'M17.8 2.8l2.2 2.2-3.2 3.2H19c1.7 0 3 1.3 3 3v8c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3v-8c0-1.7 1.3-3 3-3h2.2L4 5l2.2-2.2 4.2 4.2h3.2L17.8 2.8zM7 12c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1zm10 0c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z' })
])

export const DuckDuckGoIcon = () => h('svg', { viewBox: '0 0 24 24', class: 'w-3.5 h-3.5 flex-shrink-0' }, [
  h('circle', { cx: '12', cy: '12', r: '10', fill: '#DE5833' }),
  h('path', { fill: '#FFFFFF', d: 'M12 6c-3 0-5 2-5 5 0 1.5.8 2.8 2 3.5v2.5h6v-2.5c1.2-.7 2-2 2-3.5 0-3-2-5-5-5z' })
])

export const SEARCH_ENGINES: SearchEngineItem[] = [
  { id: 'google', name: 'Google', icon: GoogleIcon, url: 'https://www.google.com/search?q=' },
  { id: 'bing', name: 'Bing', icon: BingIcon, url: 'https://www.bing.com/search?q=' },
  { id: 'baidu', name: '百度', icon: BaiduIcon, url: 'https://www.baidu.com/s?wd=' },
  { id: 'github', name: 'GitHub', icon: GitHubIcon, url: 'https://github.com/search?q=' },
  { id: 'bilibili', name: 'B站', icon: BilibiliIcon, url: 'https://search.bilibili.com/all?keyword=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', icon: DuckDuckGoIcon, url: 'https://duckduckgo.com/?q=' }
]

// 智能 Bang 快捷语法规则映射表
export const BANG_MAP: Record<string, SearchEngineItem> = {
  'g': { id: 'google', name: 'Google', icon: GoogleIcon, url: 'https://www.google.com/search?q=' },
  'b': { id: 'bilibili', name: 'B站', icon: BilibiliIcon, url: 'https://search.bilibili.com/all?keyword=' },
  'gh': { id: 'github', name: 'GitHub', icon: GitHubIcon, url: 'https://github.com/search?q=' },
  'bd': { id: 'baidu', name: '百度', icon: BaiduIcon, url: 'https://www.baidu.com/s?wd=' },
  'bi': { id: 'bing', name: 'Bing', icon: BingIcon, url: 'https://www.bing.com/search?q=' },
  'ddg': { id: 'duckduckgo', name: 'DuckDuckGo', icon: DuckDuckGoIcon, url: 'https://duckduckgo.com/?q=' }
}
