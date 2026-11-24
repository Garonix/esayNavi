/**
/**
 * 极速拼音与多维度模糊检索引擎 (Zero Dependency)
 * 支持：
 * 1. 汉字全拼与首字母双轨映射
 * 2. URL 协议剥离与 Clean Domain 规范化检索
 * 3. 多关键词空格分词 (Tokenized Fuzzy Match)
 * 4. 标题、URL、拼音、描述、分类全景加权评分
 */

// 常用互联网、开发工具、NAS/Homelab、分类与日常汉字拼音全拼字典 (~300+高频字)
const PINYIN_DICT: Record<string, string> = {
  "哔":"bi","哩":"li","知":"zhi","乎":"hu","百":"bai","度":"du","淘":"tao","宝":"bao",
  "京":"jing","东":"dong","抖":"dou","音":"yin","快":"kuai","手":"shou","小":"xiao","红":"hong",
  "书":"shu","微":"wei","信":"xin","博":"bo","客":"ke","掘":"jue","金":"jin","少":"shao",
  "数":"shu","派":"pai","贴":"tie","吧":"ba","豆":"dou","瓣":"ban","简":"jian","网":"wang",
  "易":"yi","云":"yun","盘":"pan","讯":"xun","腾":"teng","阿":"a","里":"li","夸":"kua",
  "克":"ke","油":"you","管":"guan","推":"tui","特":"te","脸":"lian","电":"dian","报":"bao",
  "驴":"lv","青":"qing","龙":"long","群":"qun","晖":"hui","路":"lu","由":"you","器":"qi",
  "端":"duan","口":"kou","服":"fu","务":"wu","面":"mian","板":"ban","监":"jian","控":"kong",
  "探":"tan","针":"zhen","测":"ce","速":"su","下":"xia","载":"zai","容":"rong","虚":"xu",
  "拟":"ni","机":"ji","库":"ku","仓":"cang","关":"guan","代":"dai","理":"li","节":"jie",
  "点":"dian","域":"yu","名":"ming","内":"nei","外":"wai","穿":"chuan","透":"tou","打":"da",
  "洞":"dong","桥":"qiao","接":"jie","池":"chi","助":"zhu","工":"gong","具":"ju","常":"chang",
  "用":"yong","应":"ying","编":"bian","程":"cheng","模":"mo","型":"xing","智":"zhi","能":"neng",
  "搜":"sou","索":"suo","地":"di","图":"tu","翻":"fan","译":"yi","邮":"you","箱":"xiang",
  "件":"jian","聊":"liao","天":"tian","会":"hui","议":"yi","文":"wen","档":"dang","影":"ying",
  "视":"shi","乐":"yue","听":"ting","歌":"ge","社":"she","区":"qu","论":"lun","坛":"tan",
  "导":"dao","航":"hang","主":"zhu","页":"ye","前":"qian","后":"hou","台":"tai","账":"zhang",
  "号":"hao","资":"zi","源":"yuan","公":"gong","式":"shi","算":"suan","法":"fa","系":"xi",
  "统":"tong","设":"she","置":"zhi","备":"bei","份":"fen","同":"tong","步":"bu","笔":"bi",
  "记":"ji","学":"xue","习":"xi","作":"zuo","生":"sheng","活":"huo","娱":"yu","游":"you",
  "戏":"xi","休":"xiu","闲":"xian","频":"pin","照":"zhao","片":"pian","相":"xiang","册":"ce",
  "脑":"nao","安":"an","卓":"zhuo","苹":"ping","果":"guo","软":"ruan","谷":"gu","极":"ji",
  "科":"ke","技":"ji","新":"xin","闻":"wen","财":"cai","经":"jing","股":"gu","市":"shi",
  "气":"qi","日":"ri","历":"li","时":"shi","钟":"zhong","密":"mi","码":"ma","阅":"yue",
  "读":"du","说":"shuo","漫":"man","画":"hua","二":"er","次":"ci","元":"yuan","商":"shang",
  "城":"cheng","购":"gou","物":"wu","支":"zhi","付":"fu","银":"yin","行":"hang","家":"jia",
  "居":"ju","交":"jiao","通":"tong","出":"chu"
}

/**
 * 获取单个字符的首字母 (兜底降级使用 Unicode 分区)
 */
export function getCharFirstLetter(char: string): string {
  if (!char) return ''
  if (/^[a-zA-Z0-9]$/.test(char)) return char.toLowerCase()

  if (PINYIN_DICT[char]) {
    return PINYIN_DICT[char][0]
  }

  try {
    const code = char.charCodeAt(0)
    if (code < 128) return char.toLowerCase()

    const pinyinMap = 'abcdefghjklmnopqrstwxyz'
    const boundaries = '阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥扨它穵夕丫帀'

    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (char.localeCompare(boundaries[i], 'zh-CN-u-co-pinyin') >= 0) {
        return pinyinMap[i] || ''
      }
    }
  } catch {
    // 降级
  }

  return char.toLowerCase()
}

/**
 * 获取单个汉字的全拼 (若无全拼则降级使用首字母)
 */
export function getCharPinyin(char: string): string {
  if (!char) return ''
  if (/^[a-zA-Z0-9]$/.test(char)) return char.toLowerCase()
  if (PINYIN_DICT[char]) return PINYIN_DICT[char]
  return getCharFirstLetter(char)
}

/**
 * 将整段文本转换为拼音首字母缩写 (例如: "哔哩哔哩" -> "blbl")
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
 * 将整段文本转换为连续拼音全拼 (例如: "哔哩哔哩" -> "bilibili")
 */
export function getPinyinFull(str: string): string {
  if (!str) return ''
  let result = ''
  for (let i = 0; i < str.length; i++) {
    result += getCharPinyin(str[i])
  }
  return result.toLowerCase()
}

/**
 * 从 URL 提取干净域名和路径（剥离 http/https、www、末尾斜杠）
 * 例如: "https://www.github.com/vuejs/core/" -> { cleanUrl: "github.com/vuejs/core", host: "github.com" }
 */
export function getCleanUrlInfo(rawUrl: string): { cleanUrl: string; host: string } {
  if (!rawUrl) return { cleanUrl: '', host: '' }
  let clean = rawUrl.trim().toLowerCase()
  // 剥离协议头
  clean = clean.replace(/^[a-zA-Z]+:\/\//, '')
  // 剥离 www.
  clean = clean.replace(/^www\./, '')
  // 剥离末尾斜杠
  clean = clean.replace(/\/+$/, '')

  // 提取 host (去除路径部分)
  const slashIdx = clean.indexOf('/')
  const host = slashIdx !== -1 ? clean.slice(0, slashIdx) : clean

  return { cleanUrl: clean, host }
}

export interface MatchScoreResult {
  matched: boolean
  score: number
}

/**
 * 多维度智能打分匹配算法 (支持多关键词空格分词、全拼、首字母、Clean URL)
 */
export function calculateMatchScore(
  query: string,
  target: {
    title: string
    url?: string
    desc?: string
    categoryName?: string
  }
): MatchScoreResult {
  const q = query.trim().toLowerCase()
  if (!q) return { matched: false, score: 0 }

  const titleLower = (target.title || '').toLowerCase()
  const rawUrl = (target.url || '').toLowerCase()
  const { cleanUrl, host } = getCleanUrlInfo(rawUrl)
  const descLower = (target.desc || '').toLowerCase()
  const catLower = (target.categoryName || '').toLowerCase()

  const fullPinyin = getPinyinFull(target.title)
  const initials = getPinyinInitials(target.title)

  // 1. 单词/全字符串精确匹配检测
  if (titleLower === q || host === q || cleanUrl === q) {
    return { matched: true, score: 100 }
  }

  // 2. 前缀匹配检测 (极其符合地址栏打字直觉)
  if (
    titleLower.startsWith(q) || 
    host.startsWith(q) || 
    cleanUrl.startsWith(q) || 
    fullPinyin.startsWith(q)
  ) {
    return { matched: true, score: 85 }
  }

  // 3. 拼音首字母匹配 (例如输入 "blbl" 或 "zh" 命中 "哔哩哔哩" 或 "知乎")
  if (initials === q || initials.startsWith(q)) {
    return { matched: true, score: 80 }
  }

  // 4. 多关键词分词 (支持以空格分割多个词，如 "vue 官方" 或 "deep 教程")
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    const combinedSearchPool = `${titleLower} ${rawUrl} ${cleanUrl} ${fullPinyin} ${initials} ${descLower} ${catLower}`
    const allTokensMatched = tokens.every(token => combinedSearchPool.includes(token))
    if (allTokensMatched) {
      return { matched: true, score: 75 }
    }
  }

  // 5. 子串包含匹配 (在标题、域名、全拼、首字母中出现)
  if (titleLower.includes(q)) {
    return { matched: true, score: 70 }
  }
  if (host.includes(q) || cleanUrl.includes(q)) {
    return { matched: true, score: 65 }
  }
  if (fullPinyin.includes(q)) {
    return { matched: true, score: 60 }
  }
  if (initials.includes(q)) {
    return { matched: true, score: 55 }
  }

  // 6. 描述或分类匹配
  if (descLower.includes(q) || catLower.includes(q)) {
    return { matched: true, score: 45 }
  }

  return { matched: false, score: 0 }
}
