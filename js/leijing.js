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
  
  // 直接处理内容区域
  const contentElement = $('.content')
  if (contentElement.length > 0) {
    const contentHtml = contentElement.html()
    extractResources(contentHtml, tracks, title)
  }
  
  // 如果没找到资源，检查整个页面
  if (tracks.length === 0) {
    const bodyHtml = $('body').html()
    extractResources(bodyHtml, tracks, title)
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
}

// 增强版资源提取函数
function extractResources(html, tracks, title) {
  const $ = cheerio.load(html)
  const panSet = new Set()
  
  // 特别处理下载地址区域
  let downloadSection = null
  $('p, div').each((i, el) => {
    const text = $(el).text().trim()
    if (text.includes('下载地址') || text.includes('网盘链接')) {
      downloadSection = $(el).nextUntil('hr, .comment, .reply, h1, h2, h3')
      if (downloadSection.length === 0) {
        downloadSection = $(el).parent()
      }
      return false // 退出循环
    }
  })
  
  // 如果有下载区域，优先处理
  if (downloadSection && downloadSection.length > 0) {
    extractFromSection($, downloadSection, panSet, tracks, title)
  } else {
    // 否则处理整个内容
    extractFromSection($, $('body'), panSet, tracks, title)
  }
}

// 从指定区域提取资源
function extractFromSection($, section, panSet, tracks, title) {
  // 首先尝试查找所有链接
  section.find('a').each((i, el) => {
    const href = $(el).attr('href') || ''
    if (href.includes('cloud.189.cn')) {
      const linkText = $(el).text().trim()
      const parentText = $(el).parent().text()
      const accessCode = extractAccessCode(linkText, parentText)
      addResource(panSet, tracks, title, href, accessCode)
    }
  })
  
  // 然后处理文本节点
  section.contents().each((i, node) => {
    if (node.nodeType === 3) { // 文本节点
      const text = $(node).text().trim()
      if (text) {
        // 匹配网盘链接
        const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
        panMatches.forEach(panUrl => {
          // 在附近文本中查找访问码
          const context = getTextContext($, node, 3) // 获取前后3行文本
          const accessCode = extractAccessCode(text, context)
          addResource(panSet, tracks, title, panUrl, accessCode)
        })
      }
    }
  })
}

// 获取文本上下文（前后几行）
function getTextContext($, node, lines = 3) {
  let context = ''
  let currentNode = node
  let count = 0
  
  // 向前查找
  while (currentNode && count < lines) {
    context = $(currentNode).text() + context
    currentNode = currentNode.previousSibling
    count++
  }
  
  // 向后查找
  currentNode = node.nextSibling
  count = 0
  while (currentNode && count < lines) {
    context += $(currentNode).text()
    currentNode = currentNode.nextSibling
    count++
  }
  
  return context
}

// 提取访问码
function extractAccessCode(...texts) {
  for (const text of texts) {
    // 尝试匹配标准格式：访问码: xxxx
    let match = text.match(/(?:访问码|访问密码|提取码|密码)[:：]?\s*(\w{4,6})\b/i)
    if (match) return match[1]
    
    // 尝试匹配括号格式：(访问码: xxxx)
    match = text.match(/\(?\s*(?:访问码|密码)\s*[:：]?\s*(\w{4,6})\s*\)?/i)
    if (match) return match[1]
    
    // 尝试匹配单独一行格式：访问码：xxxx
    match = text.match(/^(?:访问码|密码)\s*[:：]?\s*(\w{4,6})$/im)
    if (match) return match[1]
    
    // 尝试匹配纯4-6位字母数字（排除明显不是访问码的）
    match = text.match(/\b(\w{4,6})\b(?!.*http|.*\.\w{2,4})/)
    if (match && !/\d{8,}/.test(match[1]) {
      return match[1]
    }
  }
  return ''
}

// 添加资源到列表
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
