import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

// 生产环境下安全注册 PWA Service Worker (开发环境禁用以防模块加载及 MIME 类型冲突)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || './'
    const swUrl = `${base.endsWith('/') ? base : base + '/'}sw.js`
    navigator.serviceWorker.register(swUrl).catch(() => {})
  })
}
