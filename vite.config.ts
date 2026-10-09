import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'EasyNavi 极简导航',
        short_name: 'EasyNavi',
        description: '基于第一性原理与复利设计思维的蓝白极简浏览器启动页',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/nav.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nav-json-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5188,
    cors: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5188,
    cors: true,
    allowedHosts: true,
  }
})
