import type { NavCategory, NavItem, BookmarkSuggestion } from '../types/nav'
import { calculateMatchScore } from '../utils/pinyinHelper'

export const MAX_SUGGESTIONS = 5

/**
 * 统一书签匹配与加权计算：
 * 下拉联想与主网格筛选共用同一套匹配得分和点击频次加权，消除行为分裂。
 */
export function filterAndRankCategories(
  query: string,
  categories: NavCategory[]
): NavCategory[] {
  const q = query.trim()
  if (!q || !Array.isArray(categories)) {
    return categories || []
  }

  const rankedCategories: NavCategory[] = []

  for (const cat of categories) {
    if (!Array.isArray(cat.items)) continue

    const scoredItems: { item: NavItem; score: number; clickCount: number }[] = []
    for (const item of cat.items) {
      const match = calculateMatchScore(q, {
        title: item.title,
        url: item.url,
        desc: item.desc,
        categoryName: cat.name
      })

      if (match.matched) {
        const clickCount = item.clickCount || 0
        const clickBonus = Math.min(clickCount, 10) * 1.5
        scoredItems.push({
          item,
          score: match.score + clickBonus,
          clickCount
        })
      }
    }

    if (scoredItems.length > 0) {
      scoredItems.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.clickCount - a.clickCount
      })
      rankedCategories.push({
        ...cat,
        items: scoredItems.map(s => s.item)
      })
    }
  }

  return rankedCategories
}

/**
 * 纯书签智能检索算法：
 * 从站内已收录的分类书签卡片中，基于统一得分规则筛选并返回相关度最高的前 N 条建议。
 */
export function getBookmarkSuggestions(
  query: string,
  categories: NavCategory[],
  maxResults = MAX_SUGGESTIONS
): BookmarkSuggestion[] {
  const q = query.trim()
  if (!q || !Array.isArray(categories)) {
    return []
  }

  const results: { item: BookmarkSuggestion; score: number; clickCount: number }[] = []
  const seenUrls = new Set<string>()

  for (const cat of categories) {
    if (!cat.items || !Array.isArray(cat.items)) continue

    for (const card of cat.items) {
      if (!card.url) continue
      const urlLower = card.url.toLowerCase()
      if (seenUrls.has(urlLower)) continue

      const match = calculateMatchScore(q, {
        title: card.title,
        url: card.url,
        desc: card.desc,
        categoryName: cat.name
      })

      if (match.matched) {
        const clickCount = card.clickCount || 0
        const clickBonus = Math.min(clickCount, 10) * 1.5
        results.push({
          item: {
            id: card.id,
            title: card.title,
            url: card.url,
            categoryName: cat.name,
            icon: card.icon
          },
          score: match.score + clickBonus,
          clickCount
        })
        seenUrls.add(urlLower)
      }
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.clickCount - a.clickCount
  })

  return results.slice(0, maxResults).map(r => r.item)
}
