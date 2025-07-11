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
  
  // 智能提取下载区域内容
  let downloadContent = ''
  
  // 1. 尝试查找明确的下载区域
  const downloadSection = $('.content, .post-content, .thread-content').first()
  if (downloadSection.length > 0) {
    downloadContent = downloadSection.html()
  } else {
    // 2. 尝试查找包含"下载地址"的区域
    $('p, div, h3, h4').each((i, el) => {
      const text = $(el).text().trim()
      if (text.includes('下载地址') || text.includes('网盘链接')) {
        downloadContent = $(el).parent().html()
        return false // 退出循环
      }
    })
    
    // 3. 如果仍然没找到，使用整个页面内容
    if (!downloadContent) {
      downloadContent = $('body').html()
    }
  }
  
  // 处理下载内容
  if (downloadContent) {
    const $dl = cheerio.load(downloadContent)
    
    // 提取所有链接
    $dl('a').each((i, el) => {
      const href = $dl(el).attr('href') || ''
      if (isValidPanUrl(href)) {
        const linkText = $dl(el).text().trim()
        const context = getLinkContext($dl, el)
        const accessCode = extractAccessCode(linkText, context)
        
        tracks.push({
          name: title,
          pan: href,
          ext: { accessCode }
        })
      }
    })
    
    // 提取文本中的链接
    $dl('p, div, span').each((i, el) => {
      const text = $dl(el).text()
      const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<)]+/g) || []
      
      panMatches.forEach(panUrl => {
        if (isValidPanUrl(panUrl)) {
          const context = getTextContext($dl, el)
          const accessCode = extractAccessCode(text, context)
          
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
  
  // 如果仍然没找到资源，尝试直接文本提取
  if (tracks.length === 0) {
    const bodyText = $('body').text()
    extractTextResources(bodyText, tracks, title)
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
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
