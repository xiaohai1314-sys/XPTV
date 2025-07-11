const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    {
      name: '剧集',
      ext: {
        id: '?tagId=42204684250355',
      },
    },
    {
      name: '电影',
      ext: {
        id: '?tagId=42204681950354',
      },
    },
    {
      name: '动漫',
      ext: {
        id: '?tagId=42204792950357',
      },
    },
    {
      name: '纪录片',
      ext: {
        id: '?tagId=42204697150356',
      },
    },
    {
      name: '综艺',
      ext: {
        id: '?tagId=42210356650363',
      },
    },
    {
      name: '影视原盘',
      ext: {
        id: '?tagId=42212287587456',
      },
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
      'Referer': 'https://www.leijing.xyz/',
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
        url: `https://www.leijing.xyz/${href}`,
      },
    })
  })

  return jsonify({
    list: cards,
  })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const tracks = []
  const url = ext.url

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': 'https://www.leijing.xyz/',
      'User-Agent': UA,
    }
  })
  
  const $ = cheerio.load(data)
  const title = $('h1').text().trim() || "网盘资源"
  
  // 获取整个页面的HTML内容
  const pageHtml = $.html()
  
  // 特别针对您提供的格式优化
  const downloadSection = extractDownloadSection(pageHtml)
  
  if (downloadSection) {
    // 从下载区域提取资源
    extractResourcesFromSection(downloadSection, tracks, title)
  } else {
    // 如果找不到下载区域，使用全页面提取
    extractAllResources(pageHtml, tracks, title)
  }
  
  // 如果仍然没有找到资源，尝试纯文本提取
  if (tracks.length === 0) {
    const pageText = $('body').text()
    extractTextResources(pageText, tracks, title)
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
}

// 提取下载区域（针对您提供的格式）
function extractDownloadSection(html) {
  // 尝试匹配下载地址标题
  const downloadHeaderRegex = /<(p|div)[^>]*>\s*(下载地址|网盘链接|资源下载|下载链接)[:：]?\s*<\/(p|div)>/i
  const headerMatch = html.match(downloadHeaderRegex)
  
  if (headerMatch) {
    const startIndex = headerMatch.index + headerMatch[0].length
    // 提取从下载地址标题开始到评论区或分隔线之前的内容
    const endRegex = /<(div|section|footer|hr)[^>]*class=".*?(comment|reply|footer|separator|line).*?"|<h\d>.*?(评论|回复|留言).*?<\/h\d>/i
    const endMatch = html.substring(startIndex).match(endRegex)
    
    const endIndex = endMatch ? startIndex + endMatch.index : html.length
    return html.substring(startIndex, endIndex)
  }
  
  return null
}

// 从下载区域提取资源
function extractResourcesFromSection(sectionHtml, tracks, title) {
  const $ = cheerio.load(sectionHtml)
  
  // 提取所有链接
  const links = []
  $('a').each((i, el) => {
    const href = $(el).attr('href')
    if (href && href.includes('cloud.189.cn')) {
      links.push({
        url: href,
        text: $(el).text().trim()
      })
    }
  })
  
  // 提取所有文本节点
  const texts = []
  $('p, div').each((i, el) => {
    texts.push($(el).text().trim())
  })
  
  // 处理链接
  links.forEach(link => {
    // 尝试从链接文本中提取访问码
    let accessCode = extractAccessCode(link.text)
    
    // 如果没有找到，从周围文本中查找
    if (!accessCode) {
      const context = getTextContext($, link.element, 3)
      accessCode = extractAccessCode(context)
    }
    
    tracks.push({
      name: title,
      pan: link.url,
      ext: { accessCode: accessCode || '' }
    })
  })
  
  // 处理文本中的链接
  texts.forEach(text => {
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn[^\s)]+/g) || []
    panMatches.forEach(panUrl => {
      // 检查是否已添加
      const exists = tracks.some(track => track.pan === panUrl)
      if (!exists) {
        const accessCode = extractAccessCode(text)
        tracks.push({
          name: title,
          pan: panUrl,
          ext: { accessCode: accessCode || '' }
        })
      }
    })
  })
}

// 全页面资源提取
function extractAllResources(html, tracks, title) {
  const $ = cheerio.load(html)
  
  // 提取所有网盘链接
  const panMatches = html.match(/https?:\/\/cloud\.189\.cn[^\s<)]+/g) || []
  
  // 提取所有访问码
  const accessCodeRegex = /(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/gi
  const accessCodes = []
  let match
  while ((match = accessCodeRegex.exec(html)) !== null) {
    accessCodes.push(match[1])
  }
  
  // 创建资源项
  panMatches.forEach((panUrl, index) => {
    const accessCode = accessCodes[index] || accessCodes[0] || ''
    tracks.push({
      name: panMatches.length > 1 ? `${title} - 资源${index + 1}` : title,
      pan: panUrl,
      ext: { accessCode }
    })
  })
}

// 纯文本资源提取
function extractTextResources(text, tracks, title) {
  // 分割文本块
  const blocks = text.split(/\n\s*\n/)
  
  blocks.forEach(block => {
    // 跳过不包含网盘链接的块
    if (!block.includes('cloud.189.cn')) return
    
    // 提取当前块的所有链接
    const panMatches = block.match(/https?:\/\/cloud\.189\.cn[^\s)]+/g) || []
    
    // 提取当前块的访问码
    let accessCode = ''
    const codeMatch = block.match(/(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/i)
    if (codeMatch) {
      accessCode = codeMatch[1]
    }
    
    // 添加资源
    panMatches.forEach(panUrl => {
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode }
      })
    })
  })
}

// 提取访问码
function extractAccessCode(text) {
  if (!text) return ''
  
  // 尝试多种格式
  let match = text.match(/(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})\b/i)
  if (match) return match[1]
  
  match = text.match(/\(?\s*(?:访问码|密码)\s*[:：]?\s*(\w{4,6})\s*\)?/i)
  if (match) return match[1]
  
  match = text.match(/^(?:访问码|密码)\s*[:：]?\s*(\w{4,6})$/im)
  if (match) return match[1]
  
  // 尝试匹配纯4-6位字母数字
  match = text.match(/\b(\w{4,6})\b(?!.*http)/)
  if (match && !/\d{8,}/.test(match[1])) {
    return match[1]
  }
  
  return ''
}

// 获取上下文文本
function getTextContext($, element, lines = 3) {
  let context = ''
  let current = $(element)
  
  // 添加前几行
  for (let i = 0; i < lines; i++) {
    current = current.prev()
    if (current.length > 0) {
      context = current.text().trim() + '\n' + context
    } else {
      break
    }
  }
  
  // 添加当前元素
  context += $(element).text().trim() + '\n'
  
  // 添加后几行
  current = $(element)
  for (let i = 0; i < lines; i++) {
    current = current.next()
    if (current.length > 0) {
      context += current.text().trim() + '\n'
    } else {
      break
    }
  }
  
  return context
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
    headers: {
      'User-Agent': UA,
    },
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
        url: `https://www.leijing.xyz/${href}`,
      },
    })
  })

  return jsonify({
    list: cards,
  })
}
