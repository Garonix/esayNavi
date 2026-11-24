import type { NavCategory, NavConfig, NavItem } from '../types/nav'
import { extractSiteTitle, normalizeUrl } from './urlHelper'
import { ensureUniqueItemIds } from '../services/storage'

export interface TableRow {
  id: string
  title: string
  url: string
  categoryName: string
  icon: string
  pinned: boolean
  desc?: string
  color?: string
  createdAt?: number
  clickCount?: number
}

/**
 * 将分类树扁平化为表格编辑行，完整保留 desc / color / createdAt / clickCount 等隐性元数据
 */
export function categoriesToTableRows(categories: NavCategory[]): {
  rows: TableRow[]
  categoryMap: Map<string, { id: string; icon?: string }>
  categoryNames: string[]
} {
  const rows: TableRow[] = []
  const categoryMap = new Map<string, { id: string; icon?: string }>()
  const categoryNames: string[] = []

  for (const cat of categories || []) {
    const cleanName = cat.name.trim()
    categoryMap.set(cleanName, { id: cat.id, icon: cat.icon })
    categoryNames.push(cleanName)

    if (Array.isArray(cat.items)) {
      for (const item of cat.items) {
        rows.push({
          id: item.id || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: item.title || '',
          url: item.url || '',
          categoryName: cleanName,
          icon: item.icon || '',
          pinned: !!item.pinned,
          desc: item.desc,
          color: item.color,
          createdAt: item.createdAt,
          clickCount: item.clickCount
        })
      }
    }
  }

  return { rows, categoryMap, categoryNames }
}

/**
 * 将表格编辑行还原为 NavConfig，确保不丢失原有点击权重与描述元数据
 */
export function buildNavConfigFromTableRows(
  baseConfig: NavConfig,
  rows: TableRow[],
  existingCategoryNames: string[],
  existingCategoryMap: Map<string, { id: string; icon?: string }>
): NavConfig {
  const validRows = rows.filter(r => r.url.trim() && r.title.trim())

  const categoryOrder: string[] = []
  const groupedItems = new Map<string, TableRow[]>()

  for (const catName of existingCategoryNames) {
    categoryOrder.push(catName)
    groupedItems.set(catName, [])
  }

  for (const row of validRows) {
    const catName = row.categoryName.trim() || '未分类'
    if (!groupedItems.has(catName)) {
      categoryOrder.push(catName)
      groupedItems.set(catName, [])
    }
    groupedItems.get(catName)!.push(row)
  }

  const newCategories: NavCategory[] = []
  for (const catName of categoryOrder) {
    const itemsInCat = groupedItems.get(catName) || []
    if (itemsInCat.length > 0 || existingCategoryMap.has(catName)) {
      const existingMeta = existingCategoryMap.get(catName)
      const catId = existingMeta?.id || `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const catIcon = existingMeta?.icon || 'folder'

      const mappedItems: NavItem[] = itemsInCat.map(r => {
        const item: NavItem = {
          id: r.id,
          title: r.title.trim() || extractSiteTitle(r.url),
          url: normalizeUrl(r.url),
          icon: r.icon.trim(),
          pinned: r.pinned
        }
        if (r.desc !== undefined) item.desc = r.desc
        if (r.color !== undefined) item.color = r.color
        if (r.createdAt !== undefined) item.createdAt = r.createdAt
        if (r.clickCount !== undefined) item.clickCount = r.clickCount
        return item
      })

      newCategories.push({
        id: catId,
        name: catName,
        icon: catIcon,
        items: mappedItems
      })
    }
  }

  const updatedConfig: NavConfig = {
    ...baseConfig,
    categories: newCategories
  }

  ensureUniqueItemIds(updatedConfig)
  return updatedConfig
}
