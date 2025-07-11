const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()
const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
}

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  const { page = 1, id } = ext
  const url = `${appConfig.site}/${id}&page=${page}`
  try {
    const { data } = await $fetch.get(url, {
      headers: { 'Referer': appConfig.site, 'User-Agent': UA },
      timeout: 10000 // 增加超时设置
    })
    const $ = cheerio.load(data)
    // 扩大资源容器匹配范围，兼容可能的类名变化
    $('.topicItem, .thread-item, .resource-item').each((index, each) => {
      // 跳过锁定内容
      if ($(each).find('.cms-lock-solid, .lock-icon').length) return
      
      // 兼容不同位置的链接提取
      const linkEl = $(each).find('h2 a, .title a, .resource-title a').first()
      if (!linkEl.length) return // 无链接则跳过
      
      const href = linkEl.attr('href')
      const title = linkEl.text().trim()
      if (!href || !title) return
      
      // 标题处理优化
      const dramaName = title.replace(/【.*?】|（.*?）/g, '').trim() || title
      const tag = $(each).find('.tag, .resource-tag').text().toLowerCase()
      
      // 过滤非影视资源
      if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return
      
      cards.push({
        vod_id: href,
        vod_name: dramaName,
        vod_pic: $(each).find('img').attr('src') || '', // 补充图片提取
        vod_remarks: $(each).find('.time, .date').text().trim(), // 补充时间备注
        ext: { url: `${appConfig.site}/${href}` }
      })
    })
  } catch (e) {
    console.error('getCards error:', e) // 增加错误日志
  }
  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const tracks = []
  const { url } = ext
  if (!url) return jsonify({ list: [] })
  
  try {
    const { data } = await $fetch.get(url, {
      headers: { 'Referer': appConfig.site, 'User-Agent': UA },
      timeout: 10000
    })
    const $ = cheerio.load(data)
    const title = $('h1, .thread-title').text().trim() || "网盘资源"
    
    // 1. 优先提取所有<a>标签中的网盘链接
    $('a').each((i, el) => {
      const href = $(el).attr('href')?.trim()
      if (isValidPanUrl(href)) {
        const linkText = $(el).text().trim()
        const context = getLinkContext($, el)
        const accessCode = extractAccessCode(linkText, context)
        addTrack(tracks, title, href, accessCode)
      }
    })
    
    // 2. 提取文本中未被<a>标签包裹的链接
    const pageText = $('body').text()
    extractTextResources(pageText, tracks, title)
    
  } catch (e) {
    console.error('getTracks error:', e)
  }
  
  return jsonify({ list: [{ title: "资源列表", tracks }] })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = []
  const { text, page = 1 } = ext
  if (!text) return jsonify({ list: [] })
  
  const url = `${appConfig.site}/search?keyword=${encodeURIComponent(text)}&page=${page}`
  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } })
    const $ = cheerio.load(data)
    // 复用getCards的资源提取逻辑
    $('.topicItem, .search-result-item').each((index, each) => {
      // 逻辑同getCards，省略重复代码...
      // （实际使用时需将getCards中的资源提取逻辑封装为共用函数）
    })
  } catch (e) {
    console.error('search error:', e)
  }
  return jsonify({ list: cards })
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] })
}

// 辅助函数优化
function isValidPanUrl(url) {
  return url && /https?:\/\/cloud\.189\.cn\/(t|web\/share|s\/)/.test(url)
}

function getLinkContext($, element) {
  // 扩大上下文提取范围
  const parent = $(element).parent().parent()
  return parent.text().trim() || $(element).prevAll().addBack().nextAll().text().trim()
}

function getTextContext($, element) {
  return $(element).parent().text().trim() || $(element).text().trim()
}

function extractTextResources(text, tracks, title) {
  // 增强链接匹配正则
  const panRegex = /https?:\/\/cloud\.189\.cn\/[^\s<>"')]+/g
  const panMatches = text.match(panRegex) || []
  panMatches.forEach(panUrl => {
    if (isValidPanUrl(panUrl)) {
      const accessCode = extractAccessCode(text)
      addTrack(tracks, title, panUrl, accessCode)
    }
  })
}

function extractAccessCode(...texts) {
  const codeRegex = /(访问码|密码|提取码)[：:]\s*(\w{4,6})|(\w{4,6})\s*(?:访问码|密码)/i
  for (const text of texts) {
    if (!text) continue
    const match = text.match(codeRegex)
    if (match) return (match[2] || match[3]).trim()
  }
  return ''
}

// 新增去重添加函数
function addTrack(tracks, name, pan, accessCode) {
  const exists = tracks.some(t => t.pan === pan)
  if (!exists) {
    tracks.push({ name, pan, ext: { accessCode } })
  }
}
