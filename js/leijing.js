const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 7, // 版本号更新
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

  try {
    console.log(`正在加载资源页面: ${url}`)
    
    const { data } = await $fetch.get(url, {
      headers: {
        'Referer': appConfig.site,
        'User-Agent': UA,
      }
    })
    
    const $ = cheerio.load(data)
    const title = $('h1').text().trim() || "网盘资源"
    console.log(`页面标题: ${title}`)
    
    // 获取整个内容区域的HTML和文本
    const contentHtml = $('.thread-content, .post-content, .content, .topic-content').first().html() || $('body').html()
    const textContent = contentHtml ? cheerio.load(contentHtml).text() : ''
    
    if (!contentHtml) {
      console.log("未找到任何内容区域")
      return jsonify({ list: [{
        title: "资源列表",
        tracks: [],
      }]})
    }
    
    console.log(`内容区域长度: ${textContent.length} 字符`)
    
    // 1. 全局访问码提取（优先）
    let globalAccessCode = ''
    const globalCodeMatch = textContent.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i)
    if (globalCodeMatch) {
      globalAccessCode = globalCodeMatch[1]
      console.log(`全局访问码: ${globalAccessCode}`)
    }
    
    // 2. 提取所有有效云盘链接（增强格式支持）
    const panMatches = []
    
    // 格式1: 标准URL格式
    const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
    let match
    while ((match = urlPattern.exec(textContent)) !== null) {
      panMatches.push(match[0])
    }
    
    // 格式2: 无协议简写格式 (cloud.189.cn/...)
    const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
    while ((match = shortPattern.exec(textContent)) !== null) {
      panMatches.push('https://' + match[0])
    }
    
    console.log(`找到 ${panMatches.length} 个云盘链接`)
    
    // 3. 为每个链接提取专属访问码
    panMatches.forEach(panUrl => {
      if (!isValidPanUrl(panUrl)) return
      
      let accessCode = globalAccessCode
      const index = textContent.indexOf(panUrl)
      
      // 在链接前后100字符内搜索专属访问码
      if (index !== -1) {
        const searchStart = Math.max(0, index - 100)
        const searchEnd = Math.min(textContent.length, index + panUrl.length + 100)
        const contextText = textContent.substring(searchStart, searchEnd)
        
        // 尝试提取专属访问码
        const localCode = extractAccessCode(contextText)
        if (localCode) {
          console.log(`为链接 ${panUrl} 找到专属访问码: ${localCode}`)
          accessCode = localCode
        }
        
        // 特殊格式处理：链接后直接跟访问码
        const directMatch = contextText.match(
          new RegExp(`${escapeRegExp(panUrl)}[\\s\\S]{0,30}?(?:访问码|密码|访问密码|提取码|code)[:：]?\\s*([a-z0-9]{4,6})`, 'i')
        )
        
        if (directMatch && directMatch[1]) {
          console.log(`找到直接关联访问码: ${directMatch[1]} for ${panUrl}`)
          accessCode = directMatch[1]
        }
      }
      
      tracks.push({
        name: title,
        pan: panUrl,
        ext: { accessCode }
      })
    })
    
    // 4. 深度扫描兜底（当未找到资源时）
    if (tracks.length === 0) {
      console.log("常规方法未找到资源，启动深度扫描...")
      const fullText = $('body').text()
      
      // 深度扫描所有可能的URL格式
      const deepPattern = /(https?:\/\/)?cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
      while ((match = deepPattern.exec(fullText)) !== null) {
        const panUrl = match[0].startsWith('http') ? match[0] : 'https://' + match[0]
        
        if (isValidPanUrl(panUrl) && !tracks.some(t => t.pan === panUrl)) {
          tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode: globalAccessCode }
          })
        }
      }
      console.log(`深度扫描找到 ${tracks.length} 个资源`)
    }
    
    console.log(`共找到 ${tracks.length} 个资源`)
    return jsonify({ list: [{
      title: "资源列表",
      tracks,
    }]})
    
  } catch (e) {
    console.error("资源加载错误:", e)
    return jsonify({ list: [{
      title: "资源列表",
      tracks: [{
        name: "加载失败",
        pan: "请检查网络或链接",
        ext: { accessCode: "" }
      }],
    }]})
  }
}

// 辅助函数：转义正则特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 增强访问码提取函数
function extractAccessCode(text) {
  if (!text) return ''
  
  // 格式1: 【访问码：abcd】
  let match = text.match(/[\[【]访问码[:：]\s*([a-z0-9]{4,6})[\]】]/i)
  if (match) return match[1]
  
  // 格式2: (密码：abcd)
  match = text.match(/[\(（]密码[:：]\s*([a-z0-9]{4,6})[\)）]/i)
  if (match) return match[1]
  
  // 格式3: 访问码：abcd
  match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]\s*([a-z0-9]{4,6})\b/i)
  if (match) return match[1]
  
  // 格式4: 独立4-6位字母数字组合
  const standalone = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i)
  if (standalone) {
    const code = standalone[1]
    // 过滤无效组合
    if (!/^\d+$/.test(code) &&  // 排除纯数字
        !/^[a-z]+$/i.test(code) &&  // 排除纯字母
        !/^\d{4}$/.test(code)) {   // 排除4位纯数字
      return code
    }
  }
  
  return ''
}

// 检查是否是有效的天翼云盘URL
function isValidPanUrl(url) {
  if (!url) return false
  return /https?:\/\/cloud\.189\.cn\/(t|web\/share)\//i.test(url)
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
