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
  let contentText = $('.content').text()
  
  // 2. 如果没找到内容，使用整个页面
  if (!contentText || contentText.length < 100) {
    contentText = $('body').text()
  }
  
  // 增强型提取逻辑 - 专门处理您提供的格式
  const resourceBlocks = contentText.split(/\n\s*\n/) // 按空行分割文本块
  
  resourceBlocks.forEach(block => {
    // 跳过无关内容块
    if (!block.includes('cloud.189.cn')) return
    
    // 提取当前块内的所有链接
    const panMatches = block.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
    
    // 在当前块内查找访问码
    let accessCode = ''
    const codeMatch = block.match(/(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/i)
    if (codeMatch) {
      accessCode = codeMatch[1]
    }
    
    // 添加找到的链接
    panMatches.forEach(panUrl => {
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode }
      })
    })
  })
  
  // 如果上面没找到，使用全文本扫描作为后备
  if (tracks.length === 0) {
    const panMatches = contentText.match(/https?:\/\/cloud\.189\.cn\/[^\s)]+/g) || []
    const codeMatch = contentText.match(/(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/i)
    const accessCode = codeMatch ? codeMatch[1] : ''
    
    panMatches.forEach(panUrl => {
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode }
      })
    })
  }
  
  return jsonify({ list: [{
    title: "资源列表",
    tracks,
  }]})
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
