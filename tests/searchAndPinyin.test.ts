import { describe, it, expect } from 'vitest'
import { calculateMatchScore, getCleanUrlInfo, getPinyinFull, getPinyinInitials } from '../src/utils/pinyinHelper'
import { filterAndRankCategories, getBookmarkSuggestions } from '../src/services/bookmarkSuggestions'
import type { NavCategory } from '../src/types/nav'

describe('pinyinHelper & unified search ranking', () => {
  it('computes pinyin initials, full pinyin, and clean URLs', () => {
    expect(getPinyinInitials('哔哩哔哩')).toBe('blbl')
    expect(getPinyinFull('哔哩哔哩')).toBe('bilibili')
    expect(getCleanUrlInfo('https://www.github.com/vuejs/core/')).toEqual({
      cleanUrl: 'github.com/vuejs/core',
      host: 'github.com'
    })
  })

  it('scores exact, prefix, initials, and multi-token matches accurately', () => {
    const exact = calculateMatchScore('github', { title: 'GitHub', url: 'https://github.com' })
    const initials = calculateMatchScore('bl', { title: '哔哩哔哩', url: 'https://bilibili.com' })
    const multiToken = calculateMatchScore('开发 git', {
      title: 'GitHub',
      url: 'https://github.com',
      categoryName: '开发工具'
    })

    expect(exact).toEqual({ matched: true, score: 100 })
    expect(initials.matched).toBe(true)
    expect(initials.score).toBe(80)
    expect(multiToken.matched).toBe(true)
  })

  it('ranks both main grid categories and bookmark suggestions consistently with clickCount bonus', () => {
    const categories: NavCategory[] = [
      {
        id: 'c1',
        name: '常用工具',
        items: [
          { id: '1', title: 'GitLab', url: 'https://gitlab.com', clickCount: 0 },
          { id: '2', title: 'GitHub', url: 'https://github.com', clickCount: 10 }
        ]
      }
    ]

    const rankedCats = filterAndRankCategories('git', categories)
    const suggestions = getBookmarkSuggestions('git', categories, 5)

    expect(rankedCats).toHaveLength(1)
    expect(rankedCats[0].items.map(i => i.title)).toEqual(['GitHub', 'GitLab'])
    expect(suggestions.map(s => s.title)).toEqual(['GitHub', 'GitLab'])
  })
})
