/**
 * 极简微图标标准化处理管线 (Micro-Icon Pipeline)
 * 基于第一性原理与复利设计：
 * 1. 纯客户端原生 Canvas 驱动，零外部依赖、零网络延迟、保护内网隐私
 * 2. 自动等比缩放、居中对齐、Alpha 透明留白，解决拉伸变形与黑边
 * 3. 规范化为 128x128 视网膜清晰度的紧凑无损 PNG DataURL (~2-6KB)
 * 4. 彻底解决临时 blob: 协议失效断裂，支持随 nav.json 无缝导出与跨设备漫游
 */

/**
 * 将任意图片文件/Blob转换为规范化紧凑 PNG DataURL
 * @param fileOrBlob 任意图片文件、Blob 或剪贴板提取的图像
 * @param targetSize 规范化尺寸，默认 128px (兼顾 Retina 高清显示与极致微体积)
 */
export async function normalizeToCompactIcon(
  fileOrBlob: Blob | File,
  targetSize: number = 128
): Promise<string> {
  // 验证文件是否有效
  if (!fileOrBlob || fileOrBlob.size === 0) {
    throw new Error('图片文件为空或无效')
  }

  // 1. 如果是小型矢量 SVG (文件 < 32KB)，直接保持原生矢量 DataURL，零损耗且体积极微
  const isSvg = fileOrBlob.type === 'image/svg+xml' || 
    (fileOrBlob instanceof File && /\.svg$/i.test(fileOrBlob.name))
  if (isSvg && fileOrBlob.size < 32768) {
    try {
      const text = await fileOrBlob.text()
      if (/<svg[^>]*>/i.test(text)) {
        // 确保包含标准的 xmlns 命名空间
        let normalizedSvg = text
        if (!normalizedSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
          normalizedSvg = normalizedSvg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
        }
        const encoded = encodeURIComponent(normalizedSvg).replace(/'/g, '%27').replace(/"/g, '%22')
        return `data:image/svg+xml;charset=utf-8,${encoded}`
      }
    } catch {
      // 若文本解析失败，平滑降级至下方 Canvas 栅格化绘制
    }
  }

  // 2. 栅格位图管线 (PNG/JPG/WEBP/ICO/BMP/GIF)：Canvas 硬件加速 128x128 居中透明重采样
  return new Promise((resolve, reject) => {

    const objectUrl = URL.createObjectURL(fileOrBlob)
    const img = new Image()

    img.onload = () => {
      try {
        const size = targetSize
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          return reject(new Error('浏览器无法初始化 Canvas 2D 绘图环境'))
        }

        // 清空背景并启用双三次/高质量平滑滤波
        ctx.clearRect(0, 0, size, size)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // 保持纵横比智能居中 (Aspect Fit)
        const imgW = img.naturalWidth || img.width || size
        const imgH = img.naturalHeight || img.height || size
        const scale = Math.min(size / imgW, size / imgH)
        const drawW = Math.round(imgW * scale)
        const drawH = Math.round(imgH * scale)
        const offsetX = Math.round((size - drawW) / 2)
        const offsetY = Math.round((size - drawH) / 2)

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH)

        // 导出紧凑无损 PNG DataURL
        const pngDataUrl = canvas.toDataURL('image/png')
        URL.revokeObjectURL(objectUrl)
        resolve(pngDataUrl)
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片解码失败，请确认文件格式有效'))
    }

    img.src = objectUrl
  })
}

/**
 * 从剪贴板粘贴事件提取图像文件
 */
export function extractImageFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items) return null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}

/**
 * 从拖拽事件提取图像文件
 */
export function extractImageFromDrag(e: DragEvent): File | null {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return null

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|ico|svg|bmp|gif|avif)$/i.test(file.name)
    ) {
      return file
    }
  }
  return null
}
