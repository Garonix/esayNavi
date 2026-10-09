/**
 * 轻量级汉字拼音首字母提取工具 (Zero Dependency, ~2KB)
 * 支持将中文转换为拼音首字母与全拼缩写，实现极速拼音模糊搜索
 */

// 补充常用特殊多音/特殊字首字母字典
const SPECIAL_CHARS: Record<string, string> = {
  '哔': 'b', '哩': 'l', '赫': 'h', '尔': 'e', '墨': 'm', '斯': 's',
  '油': 'y', '管': 'g', '托': 't', '微': 'w', '信': 'x',
  '桥': 'q', '接': 'j', '池': 'c', '度': 'd', '知': 'z', '乎': 'h',
  '稀': 'x', '土': 't', '掘': 'j', '金': 'j', '少': 's', '数': 's',
  '派': 'p', '猫': 'm', '狗': 'g', '网': 'w', '易': 'y', '云': 'y',
  '淘': 't', '宝': 'b', '京': 'j', '东': 'd', '抖': 'd', '音': 'y',
  '快': 'k', '手': 's', '小': 'x', '红': 'h', '书': 's', '练': 'l',
  '习': 'x', '服': 'f', '务': 'w', '器': 'q', '端': 'd', '口': 'k',
  '内': 'n', '外': 'w', '助': 'z', '工': 'g', '具': 'j',
  '常': 'c', '用': 'y', '应': 'y', '编': 'b', '程': 'c', '打': 'd',
  '洞': 'd', '模': 'm', '型': 'x', '代': 'd', '理': 'l', '域': 'y',
  '名': 'm'
}

/**
 * 获取单个汉字的首字母 (小写)
 */
export function getCharFirstLetter(char: string): string {
  if (!char) return ''
  if (/^[a-zA-Z0-9]$/.test(char)) return char.toLowerCase()

  // 1. 特殊字字典优先命中
  if (SPECIAL_CHARS[char]) {
    return SPECIAL_CHARS[char]
  }

  // 2. 国际化拼音简易提取
  try {
    const code = char.charCodeAt(0)
    if (code < 128) return char.toLowerCase()

    // 常用中文范围二分快速判断
    const pinyinMap = 'abcdefghjklmnopqrstwxyz'
    const boundaries = '阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥扨它穵夕丫帀'

    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (char.localeCompare(boundaries[i], 'zh-CN-u-co-pinyin') >= 0) {
        return pinyinMap[i] || ''
      }
    }
  } catch {
    // 降级返回字符本身
  }

  return char.toLowerCase()
}

/**
 * 将整段文本转换为拼音首字母缩写，例如 "哔哩哔哩" -> "blbl"
 */
export function getPinyinInitials(str: string): string {
  if (!str) return ''
  let result = ''
  for (let i = 0; i < str.length; i++) {
    result += getCharFirstLetter(str[i])
  }
  return result.toLowerCase()
}

/**
 * 拼音模糊匹配：
 * 判定目标文本 (target) 是否满足查询关键字 (query)：
 * 1. 包含原文（忽略大小写）
 * 2. 拼音首字母缩写包含查询词（如 "bl" 匹配 "哔哩哔哩"）
 * 3. 目标 URL 包含查询词
 */
export function matchPinyinQuery(targetTitle: string, targetUrl: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const titleLower = (targetTitle || '').toLowerCase()
  const urlLower = (targetUrl || '').toLowerCase()

  // 1. 原文直接匹配
  if (titleLower.includes(q) || urlLower.includes(q)) {
    return true
  }

  // 2. 拼音首字母匹配
  const initials = getPinyinInitials(targetTitle)
  if (initials.includes(q)) {
    return true
  }

  return false
}
