# EasyNavi - 现代极简浏览器启动页

> 基于**第一性原理**与**复利设计思维**打造的纯前端蓝白极简导航页。零认知阻力，无冗余说明，纯文件驱动。

---

## 特性

### 1. 蓝白极简美学与富媒体背景
- **纯净蓝白主题**：纯白微磨砂卡片、柔和天蓝微渐变背景与微弱环境光。
- **Zen 沉浸视窗模式**：按 <kbd>Space</kbd> 或双击空白处，前景卡片优雅淡出，背景遮罩退隐为 0，交互全面唤醒；按 <kbd>Esc</kbd> 瞬间回弹。
- **原生星河微粒微画布**：专为蓝白主题定制的 Canvas 2D 互动微粒，支持鼠标引力斥力流体推开与连线物理演算，120 FPS 满帧丝滑，与卡片原生融合。
- **自定义富媒体背景**：支持静止图片、动态 GIF 与循环静音微视频（MP4/WebM）。
- **光学遮罩防护**：支持实时调节半透明遮罩浓度与毛玻璃模糊度，确保无论背景多么花哨，蓝白卡片文字永远清晰锐利。
- **GPU 视差系统**：支持滚动视差（深景平移）与鼠标微漂移视差（Apple 风格悬浮景深），纯硬件加速驱动，零掉帧。
- **信息极致降噪**：彻底剔除冗长副标题、说教式引导、括号注释与 Emoji；隐藏卡片简介，只保留核心站点图标与名称，布局紧凑统一。

### 2. 现代应用级 App 图标网格
- **以图标为主，文本为辅**：3 ~ 8 列自适应网格，大尺寸高清图标，完全剔除冗余外边框，图形识别极速高效。
- **零心流打扰与右键快捷菜单**：彻底移除 Hover 弹出的遮挡按钮，悬浮仅保留极净高光与微物理按压；置顶、编辑、复制、刷新、删除等操作统一收敛至原生感右键菜单；支持浏览器本地缓存优先与重新获取无损回退。

### 3. 纯前端文件存储
- **零数据库依赖**：纯静态托管即可运行，开箱即用。
- **本地文件直连**：支持现代浏览器 File System Access API 直接绑定磁盘物理 `nav.json` 文件。
- **导入与导出**：一键导出 JSON 备份，随时导入覆盖，本地自动持久化。

### 4. 零阻力极速添加与 Homelab 图标库
- **Homelab / 自建服务图标库**：内置全球主流开源自建应用特征库（qBittorrent、Dockge、Home Assistant、Bitwarden、Emby、Immich、AList、Gitea、OpenWrt、Nginx Proxy Manager 等），根据名称或 URL 自动匹配官方超清图标。
- **本地专属图标上传与微图管线**：支持选择任意格式图片（PNG/JPG/WEBP/ICO/SVG）、拖拽文件或直接剪贴板粘贴截图（<kbd>Ctrl</kbd>+<kbd>V</kbd>），纯前端 Canvas 硬件加速毫秒级重采样规整为 128px 视网膜高清规范微图标（~3KB），随 `nav.json` 终身可用、无缝多端漫游。
- **一框流极速添加**：按 <kbd>N</kbd> 呼出弹窗，粘贴网址后自动提取名称与高清 Favicon，敲 <kbd>Enter</kbd> 即刻添加；支持外部超链接直接拖拽入分类。

### 5. 快捷键与手势
- <kbd>Space</kbd> 切换 Zen 沉浸视窗模式（或双击页面空白处）
- <kbd>N</kbd> 添加站点
- <kbd>/</kbd> 聚焦搜索
- <kbd>?</kbd> 查看快捷键指南
- <kbd>右键</kbd> 呼出卡片管理快捷菜单
- <kbd>Esc</kbd> 关闭浮层 / 退出沉浸

---

## 配置文件 (`nav.json`)

```json
{
  "version": "1.0.0",
  "settings": {
    "title": "EasyNavi",
    "theme": "light",
    "background": "mesh",
    "searchEngine": "google",
    "openInNewTab": true,
    "showClock": true,
    "showSearch": true
  },
  "categories": [
    {
      "id": "daily",
      "name": "常用",
      "icon": "sparkles",
      "items": [
        {
          "id": "item-gh",
          "title": "GitHub",
          "url": "https://github.com",
          "icon": "https://github.githubassets.com/favicons/favicon.svg",
          "pinned": true
        }
      ]
    }
  ]
}
```

---

## 启动与访问

```bash
# 安装依赖
pnpm install

# 启动服务 (支持局域网访问，端口 5188)
pnpm dev

# 编译打包 (Gzip 体积仅约 46KB)
pnpm build
```

- **本机访问**：`http://localhost:5188/`
- **局域网访问**：`http://192.168.3.25:5188/`
