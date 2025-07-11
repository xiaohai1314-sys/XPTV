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
  
  // 1. 首先尝试提取内容区域的文本
  let contentText = $('.content').text()
  
  // 2. 如果内容区域太小，使用整个页面文本
  if (!contentText || contentText.length < 50) {
    contentText = $('body').text()
  }
  
  // 3. 提取所有网盘链接
  const panMatches = contentText.match(/https?:\/\/cloud\.189\.cn[^\s)]+/g) || []
  
  // 4. 提取所有访问码（支持两种格式）
  const accessCodes = []
  
  // 格式1: 链接和访问码在同一行 (https://... (访问码：xxx))
  const inlineCodeRegex = /https?:\/\/cloud\.189\.cn[^\s)]+\s*\([^)]*?(?:访问码|密码)[:：]?\s*(\w{4,6})[^)]*\)/gi
  let inlineMatch
  while ((inlineMatch = inlineCodeRegex.exec(contentText)) !== null) {
    accessCodes.push(inlineMatch[1])
  }
  
  // 格式2: 链接和访问码分行 (链接：https://... 访问码：xxx)
  const blockCodeRegex = /(?:链接|地址|网盘)[:：]?\s*(https?:\/\/cloud\.189\.cn[^\s)]+)[\s\S]*?(?:访问码|密码)[:：]?\s*(\w{4,6})/gi
  let blockMatch
  while ((blockMatch = blockCodeRegex.exec(contentText)) !== null) {
    // 确保链接存在
    if (blockMatch[1] && blockMatch[2]) {
      // 添加到链接列表（如果尚未存在）
      if (!panMatches.includes(blockMatch[1])) {
        panMatches.push(blockMatch[1])
      }
      accessCodes.push(blockMatch[2])
    }
  }
  
  // 5. 全局访问码提取（备用）
  const globalCodeRegex = /(?:访问码|密码|访问密码|提取码)[:：]?\s*(\w{4,6})/gi
  let globalMatch
  while ((globalMatch = globalCodeRegex.exec(contentText)) !== null) {
    // 只添加唯一的访问码
    if (!accessCodes.includes(globalMatch[1])) {
      accessCodes.push(globalMatch[1])
    }
  }
  
  // 6. 创建资源列表
  panMatches.forEach((panUrl, index) => {
    // 标准化URL
    const cleanUrl = panUrl.replace(/[\s)]+$/, '')
    
    // 确定访问码（优先使用匹配的访问码）
    let accessCode = ''
    if (accessCodes.length > index) {
      accessCode = accessCodes[index]
    } else if (accessCodes.length > 0) {
      accessCode = accessCodes[0]  // 使用第一个访问码作为默认
    }
    
    // 创建资源项
    tracks.push({
      name: panMatches.length > 1 ? `${title} - 资源${index + 1}` : title,
      pan: cleanUrl,
      ext: {
        accessCode: accessCode
      }
    })
  })
  
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
