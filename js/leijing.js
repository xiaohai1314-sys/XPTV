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
  
  // 1. 针对特定页面结构优化 - 提取隐藏内容
  let hiddenContent = ''
  
  // 尝试多种隐藏内容选择器
  const hiddenSelectors = [
    '.reply-content', // topicId=18117 使用的选择器
    '.hidden-content',
    '.reply-to-view',
    '.comment-to-view',
    '.hide-content',
    '[style*="display:none"]',
    '[style*="display: none"]'
  ]
  
  hiddenSelectors.forEach(selector => {
    if ($(selector).length > 0 && !hiddenContent) {
      hiddenContent = $(selector).html()
    }
  })
  
  // 2. 如果找到隐藏内容，优先从中提取资源
  if (hiddenContent) {
    extractResourcesFromContent(hiddenContent, tracks, title, true)
  }
  
  // 3. 提取可见内容区域
  const contentSelectors = [
    '.content',
    '.post-content',
    '.thread-content',
    '.entry-content',
    '.article-content',
    '.topic-content'
  ]
  
  let mainContent = ''
  contentSelectors.forEach(selector => {
    if ($(selector).length > 0 && !mainContent) {
      mainContent = $(selector).html()
    }
  })
  
  // 4. 如果没有找到特定内容区域，使用整个页面
  if (!mainContent) {
    mainContent = $('body').html()
  }
  
  // 5. 从主内容提取资源
  if (mainContent) {
    extractResourcesFromContent(mainContent, tracks, title)
  }
  
  // 6. 如果仍然没有找到资源，尝试直接文本提取
  if (tracks.length === 0) {
    const bodyText = $('body').text()
    extractTextResources(bodyText, tracks, title)
  }
  
  // 7. 特殊处理：如果页面有多个资源区域
  if (tracks.length === 0) {
    $('.resource-item, .download-section, .pan-list').each((i, el) => {
      const sectionHtml = $(el).html()
      extractResourcesFromContent(sectionHtml, tracks, title)
    })
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
}

// 从内容HTML提取资源
function extractResourcesFromContent(html, tracks, title, isHidden = false) {
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
          name: isHidden ? `${title} [隐藏]` : title,
          pan: href,
          ext: { accessCode }
        })
      }
    }
  })
  
  // 提取文本中的链接
  $('p, div, span, li, td').each((i, el) => {
    const text = $(el).text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
    
    panMatches.forEach(panUrl => {
      if (isValidPanUrl(panUrl) && !seenUrls.has(panUrl)) {
        seenUrls.add(panUrl)
        const context = getTextContext($, el)
        const accessCode = extractAccessCode(text, context)
        
        tracks.push({
          name: isHidden ? `${title} [隐藏]` : title,
          pan: panUrl,
          ext: { accessCode }
        })
      }
    })
  })
  
  // 特殊处理：代码块中的资源
  $('pre, code').each((i, el) => {
    const text = $(el).text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
    
    panMatches.forEach(panUrl => {
      if (isValidPanUrl(panUrl) && !seenUrls.has(panUrl)) {
        seenUrls.add(panUrl)
        const accessCode = extractAccessCode(text)
        
        tracks.push({
          name: isHidden ? `${title} [代码块]` : `${title} [代码]`,
          pan: panUrl,
          ext: { accessCode }
        })
      }
    })
  })
}

// 检查是否是有效的网盘URL
function isValidPanUrl(url) {
  if (!url) return false
  return /https?:\/\/cloud\.189\.cn\/(t|web\/share)\//.test(url)
}

// 获取链接周围的上下文
function getLinkContext($, element) {
  let context = ''
  const $parent = $(element).parent()
  
  // 获取父元素文本
  context += $parent.text().trim() + ' '
  
  // 获取前一个元素
  const $prev = $parent.prev()
  if ($prev.length) {
    context += $prev.text().trim() + ' '
  }
  
  // 获取后一个元素
  const $next = $parent.next()
  if ($next.length) {
    context += $next.text().trim() + ' '
  }
  
  return context
}

// 获取文本元素周围的上下文
function getTextContext($, element) {
  let context = ''
  const $parent = $(element).parent()
  
  // 获取父元素文本
  context += $parent.text().trim() + ' '
  
  // 获取前一个元素
  const $prev = $(element).prev()
  if ($prev.length) {
    context += $prev.text().trim() + ' '
  }
  
  // 获取后一个元素
  const $next = $(element).next()
  if ($next.length) {
    context += $next.text().trim() + ' '
  }
  
  return context
}

// 从文本提取资源
function extractTextResources(text, tracks, title) {
  // 分割文本块
  const blocks = text.split(/\n\s*\n/)
  
  blocks.forEach(block => {
    // 跳过不包含网盘链接的块
    if (!block.includes('cloud.189.cn')) return
    
    // 提取当前块的所有链接
    const panMatches = block.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
    
    // 提取当前块的访问码
    let accessCode = ''
    const codeMatch = block.match(/(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/i)
    if (codeMatch) {
      accessCode = codeMatch[1]
    } else {
      // 尝试在块中查找访问码
      const codeMatch2 = block.match(/\b(?:码|验证码|code)[:：]?\s*(\w{4,6})\b/i)
      if (codeMatch2) accessCode = codeMatch2[1]
    }
    
    // 添加资源
    panMatches.forEach(panUrl => {
      if (isValidPanUrl(panUrl)) {
        // 避免重复添加
        const exists = tracks.some(t => t.pan === panUrl)
        if (!exists) {
          tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode }
          })
        }
      }
    })
  })
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
