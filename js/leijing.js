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
  
  // 1. 首先尝试从评论区前的内容提取（针对特殊页面）
  let mainContent = ''
  const commentSection = $('.comment-list, #comments, .reply-list').first()
  
  if (commentSection.length > 0) {
    // 获取评论区之前的所有内容
    let prevElements = commentSection.prevAll()
    prevElements.each((i, el) => {
      mainContent += $.html(el)
    })
  } else {
    // 使用默认内容区域
    mainContent = $('.content, .post-content, .thread-content, .entry-content').html() || $('body').html()
  }
  
  // 2. 提取资源
  if (mainContent) {
    extractResourcesFromContent(mainContent, tracks, title)
  }
  
  // 3. 如果没找到资源，尝试备用方法
  if (tracks.length === 0) {
    extractFallbackResources($, tracks, title)
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
}

// 从内容HTML提取资源
function extractResourcesFromContent(html, tracks, title) {
  const $ = cheerio.load(html)
  const seenUrls = new Set()
  
  // 提取所有链接
  $('a').each((i, el) => {
    const href = $(el).attr('href') || ''
    if (isValidPanUrl(href)) {
      const linkText = $(el).text().trim()
      const context = getLinkContext($, el)
      const accessCode = extractAccessCode(linkText, context)
      
      if (!seenUrls.has(href)) {
        seenUrls.add(href)
        tracks.push({
          name: title,
          pan: href,
          ext: { accessCode }
        })
      }
    }
  })
  
  // 提取文本中的链接
  $('p, div, span, li').each((i, el) => {
    const text = $(el).text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
    
    panMatches.forEach(panUrl => {
      if (isValidPanUrl(panUrl) && !seenUrls.has(panUrl)) {
        seenUrls.add(panUrl)
        const context = getTextContext($, el)
        const accessCode = extractAccessCode(text, context)
        
        tracks.push({
          name: title,
          pan: panUrl,
          ext: { accessCode }
        })
      }
    })
  })
  
  // 特殊处理：隐藏内容（需要评论可见）
  $('.hidden-content, .reply-to-view, .comment-to-view').each((i, el) => {
    const hiddenHtml = $(el).html()
    if (hiddenHtml) {
      const $hidden = cheerio.load(hiddenHtml)
      
      // 在隐藏内容中查找资源
      $hidden('a').each((i, el) => {
        const href = $hidden(el).attr('href') || ''
        if (isValidPanUrl(href) && !seenUrls.has(href)) {
          seenUrls.add(href)
          const linkText = $hidden(el).text().trim()
          const context = getLinkContext($hidden, el)
          const accessCode = extractAccessCode(linkText, context)
          
          tracks.push({
            name: title + " [隐藏资源]",
            pan: href,
            ext: { accessCode }
          })
        }
      })
      
      // 在隐藏文本中查找
      const hiddenText = $hidden.text()
      const panMatches = hiddenText.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
      panMatches.forEach(panUrl => {
        if (isValidPanUrl(panUrl) && !seenUrls.has(panUrl)) {
          seenUrls.add(panUrl)
          const accessCode = extractAccessCode(hiddenText)
          
          tracks.push({
            name: title + " [隐藏资源]",
            pan: panUrl,
            ext: { accessCode }
          })
        }
      })
    }
  })
}

// 备用资源提取方法
function extractFallbackResources($, tracks, title) {
  const seenUrls = new Set()
  
  // 尝试整个页面文本提取
  const pageText = $('body').text()
  const panMatches = pageText.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
  
  panMatches.forEach(panUrl => {
    if (isValidPanUrl(panUrl) && !seenUrls.has(panUrl)) {
      seenUrls.add(panUrl)
      
      // 在链接附近查找访问码
      const context = getTextContextAround(pageText, panUrl)
      const accessCode = extractAccessCode(context)
      
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode }
      })
    }
  })
}

// 检查是否是有效的网盘URL
function isValidPanUrl(url) {
  if (!url) return false
  return /https?:\/\/cloud\.189\.cn\/(t|web\/share)\//.test(url)
}

// 获取链接周围的上下文
function getLinkContext($, element, distance = 100) {
  let context = ''
  let current = $(element)
  
  // 添加前几个元素
  for (let i = 0; i < 2; i++) {
    current = current.prev()
    if (current.length > 0) {
      context = current.text().trim() + ' ' + context
    }
  }
  
  // 添加当前元素
  context += $(element).text().trim() + ' '
  
  // 添加后几个元素
  current = $(element)
  for (let i = 0; i < 2; i++) {
    current = current.next()
    if (current.length > 0) {
      context += current.text().trim() + ' '
    }
  }
  
  return context
}

// 获取文本元素周围的上下文
function getTextContext($, element, distance = 100) {
  let context = ''
  let current = $(element)
  
  // 添加前几个元素
  for (let i = 0; i < 2; i++) {
    current = current.prev()
    if (current.length > 0) {
      context = current.text().trim() + ' ' + context
    }
  }
  
  // 添加当前元素
  context += $(element).text().trim() + ' '
  
  // 添加后几个元素
  current = $(element)
  for (let i = 0; i < 2; i++) {
    current = current.next()
    if (current.length > 0) {
      context += current.text().trim() + ' '
    }
  }
  
  return context
}

// 在文本中围绕特定URL获取上下文
function getTextContextAround(fullText, targetUrl, radius = 200) {
  const index = fullText.indexOf(targetUrl)
  if (index === -1) return ''
  
  const start = Math.max(0, index - radius)
  const end = Math.min(fullText.length, index + targetUrl.length + radius)
  return fullText.substring(start, end)
}

// 提取访问码
function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue
    
    // 尝试多种格式
    let match = text.match(/(?:访问码|密码|访问密码|提取码|验证码|code)[:：]?\s*(\w{4,6})\b/i)
    if (match) return match[1]
    
    match = text.match(/\(?\s*(?:访问码|密码|code)\s*[:：]?\s*(\w{4,6})\s*\)?/i)
    if (match) return match[1]
    
    match = text.match(/^(?:访问码|密码)\s*[:：]?\s*(\w{4,6})$/im)
    if (match) return match[1]
    
    // 尝试匹配纯4-6位字母数字
    match = text.match(/\b(\w{4,6})\b(?!.*http)/)
    if (match && !/\d{8,}/.test(match[1])) {
      return match[1]
    }
  }
  return ''
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
        url: `${appConfig.site}/${href}`,
      },
    })
  })

  return jsonify({ list: cards })
}
