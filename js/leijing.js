const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    {
      name: '剧集',
      ext: { id: '?tagId=42204684250355' },
    },
    {
      name: '电影',
      ext: { id: '?tagId=42204681950354' },
    },
    {
      name: '动漫',
      ext: { id: '?tagId=42204792950357' },
    },
    {
      name: '纪录片',
      ext: { id: '?tagId=42204697150356' },
    },
    {
      name: '综艺',
      ext: { id: '?tagId=42210356650363' },
    },
    {
      name: '影视原盘',
      ext: { id: '?tagId=42212287587456' },
    },
  ],
}

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let { page = 1, id } = ext
  const url = appConfig.site + `/${id}&page=${page}`

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': appConfig.site,
      'User-Agent': UA,
    }
  })

  const $ = cheerio.load(data)

  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return
    
    const href = $(each).find('h2 a').attr('href')
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/
    const match = title.match(regex)
    const dramaName = match ? match[1] : title
    const r = $(each).find('.summary').text()
    const tag = $(each).find('.tag').text()
    
    if (/content/.test(r) && !/cloud/.test(r)) return
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: {
        url: `${appConfig.site}/${href}`,
      },
    })
  })

  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const tracks = []
  const url = ext.url

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': appConfig.site,
      'User-Agent': UA,
    }
  })
  
  const $ = cheerio.load(data)
  const title = $('h1').text().trim() || "网盘资源"
  
  // 1. 首先尝试从.content区域提取
  const contentElement = $('.content')
  if (contentElement.length > 0) {
    const contentHtml = contentElement.html()
    extractResources(contentHtml, tracks, title)
  }
  
  // 2. 如果没找到资源，检查整个页面
  if (tracks.length === 0) {
    const bodyHtml = $('body').html()
    extractResources(bodyHtml, tracks, title)
  }
  
  // 3. 如果还是没找到，尝试文本提取（处理特殊格式）
  if (tracks.length === 0) {
    const contentText = contentElement.length > 0 ? contentElement.text() : $('body').text()
    extractTextResources(contentText, tracks, title)
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
}

// 从HTML内容提取资源
function extractResources(html, tracks, title) {
  const $ = cheerio.load(html)
  const panSet = new Set()
  
  // 处理<a>标签
  $('a').each((i, el) => {
    const href = $(el).attr('href') || ''
    if (href.includes('cloud.189.cn')) {
      const accessCode = extractAccessCode($(el).text(), $(el).next().text())
      addResource(panSet, tracks, title, href, accessCode)
    }
  })
  
  // 处理文本节点
  $('p, div').each((i, el) => {
    const text = $(el).text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
    
    panMatches.forEach(panUrl => {
      const accessCode = extractAccessCode(text)
      addResource(panSet, tracks, title, panUrl, accessCode)
    })
  })
}

// 从纯文本提取资源（处理分行情况）
function extractTextResources(text, tracks, title) {
  const panSet = new Set()
  
  // 匹配所有网盘链接
  const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
  
  // 匹配所有访问码
  const codeMatches = text.match(/(?:访问码|访问密码|提取码)[:：]?\s*(\w{4,6})/gi) || []
  const accessCodes = codeMatches.map(code => 
    code.replace(/(?:访问码|访问密码|提取码)[:：]?\s*/i, '')
  )
  
  // 将链接和访问码配对
  panMatches.forEach((panUrl, index) => {
    const accessCode = accessCodes[index] || accessCodes[0] || ''
    addResource(panSet, tracks, title, panUrl, accessCode)
  })
}

// 提取访问码（从给定文本）
function extractAccessCode(...texts) {
  for (const text of texts) {
    const match = text.match(/(?:访问码|访问密码|提取码)[:：]?\s*(\w{4,6})/i)
    if (match) return match[1]
    
    // 直接匹配4-6位字母数字组合（可能是独立访问码）
    const codeMatch = text.match(/\b(\w{4,6})\b(?!.*http)/)
    if (codeMatch && !codeMatch[1].match(/http|\d{8,}/)) {
      return codeMatch[1]
    }
  }
  return ''
}

// 添加资源到列表（避免重复）
function addResource(panSet, tracks, title, panUrl, accessCode = '') {
  // 标准化URL
  const cleanUrl = panUrl.replace(/[\s()]+$/, '')
  
  if (!panSet.has(cleanUrl)) {
    panSet.add(cleanUrl)
    
    // 优化资源名称
    let resourceName = title
    if (tracks.length > 0) {
      resourceName = `${title} - 资源${tracks.length + 1}`
    }
    
    tracks.push({
      name: resourceName,
      pan: cleanUrl,
      ext: { accessCode }
    })
  }
}

async function getPlayinfo(ext) {
  return jsonify({ 'urls': [] })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = []
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`

  const { data } = await $fetch.get(url, {
    headers: { 'User-Agent': UA }
  })

  const $ = cheerio.load(data)

  $('.topicItem').each((index, each) => {
    if ($(each).find('.cms-lock-solid').length > 0) return
    
    const href = $(each).find('h2 a').attr('href')
    const title = $(each).find('h2 a').text()
    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/
    const match = title.match(regex)
    const dramaName = match ? match[1] : title
    const r = $(each).find('.summary').text()
    const tag = $(each).find('.tag').text()
    
    if (/content/.test(r) && !/cloud/.test(r)) return
    if (/软件|游戏|书籍|图片|公告|音乐|课程/.test(tag)) return

    cards.push({
      vod_id: href,
      vod_name: dramaName,
      vod_pic: '',
      vod_remarks: '',
      ext: {
        url: `${appConfig.site}/${href}`,
      },
    })
  })

  return jsonify({ list: cards })
}
