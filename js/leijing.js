const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 10, // 版本号更新
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
  const uniqueLinks = new Set() // 用于跟踪已添加的链接

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
    
    // 1. 全局访问码提取（优先）
    let globalAccessCode = ''
    const globalCodeMatch = $('body').text().match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i)
    if (globalCodeMatch) {
      globalAccessCode = globalCodeMatch[1]
      console.log(`全局访问码: ${globalAccessCode}`)
    }
    
    // 2. 查找并模拟点击"资源链接"按钮
    const resourceLinks = $('a, button, div').filter((i, el) => {
      const text = $(el).text().trim().toLowerCase()
      return text.includes('资源链接') || text.includes('下载链接') || text.includes('网盘链接')
    })
    
    console.log(`找到 ${resourceLinks.length} 个资源链接按钮`)
    
    if (resourceLinks.length > 0) {
      // 模拟点击第一个资源链接按钮
      const resourceContent = resourceLinks.first().closest('.content, .post-content, .thread-content, .topic-content, .resource-content')
        .add(resourceLinks.first().next('.resource-links, .hidden-links, .links-container'))
        .add(resourceLinks.first().parent())
        .html()
      
      if (resourceContent) {
        console.log(`解析资源链接区域内容`)
        const $resource = cheerio.load(resourceContent)
        const resourceText = $resource.text()
        
        // 扫描资源链接区域
        scanForLinks(resourceText, tracks, globalAccessCode, uniqueLinks, title)
      }
    }
    
    // 3. 如果没有找到资源链接按钮，扫描整个页面
    if (tracks.length === 0) {
      console.log("未找到资源链接按钮，扫描整个页面内容")
      const fullText = $('body').text()
      scanForLinks(fullText, tracks, globalAccessCode, uniqueLinks, title)
    }
    
    // 4. 如果还是没找到，尝试深度扫描
    if (tracks.length === 0) {
      console.log("常规方法未找到资源，启动深度扫描...")
      const fullText = $('body').text()
      const deepPattern = /(https?:\/\/)?cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
      let match
      while ((match = deepPattern.exec(fullText)) !== null) {
        const panUrl = match[0].startsWith('http') ? match[0] : 'https://' + match[0]
        
        if (isValidPanUrl(panUrl)) {
          // 标准化URL以去除重复
          const normalizedUrl = normalizePanUrl(panUrl)
          if (uniqueLinks.has(normalizedUrl)) {
            console.log(`跳过深度扫描重复链接: ${panUrl}`)
            continue
          }
          uniqueLinks.add(normalizedUrl)
          
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

// 扫描文本中的链接并添加到tracks
function scanForLinks(text, tracks, globalAccessCode, uniqueLinks, title) {
  if (!text) return
  
  const panMatches = []
  // 格式1: 标准URL格式
  const urlPattern = /https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
  let match
  while ((match = urlPattern.exec(text)) !== null) {
    panMatches.push(match[0])
  }
  
  // 格式2: 无协议简写格式 (cloud.189.cn/...)
  const shortPattern = /cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi
  while ((match = shortPattern.exec(text)) !== null) {
    panMatches.push('https://' + match[0])
  }
  
  // 去重
  const uniquePanMatches = [...new Set(panMatches)]
  
  uniquePanMatches.forEach(panUrl => {
    if (!isValidPanUrl(panUrl)) return
    
    // 标准化URL以去除重复
    const normalizedUrl = normalizePanUrl(panUrl)
    if (uniqueLinks.has(normalizedUrl)) {
      console.log(`跳过重复链接: ${panUrl}`)
      return
    }
    uniqueLinks.add(normalizedUrl)
    
    let accessCode = globalAccessCode
    const index = text.indexOf(panUrl)
    
    // 在链接前后100字符内搜索专属访问码
    if (index !== -1) {
      const searchStart = Math.max(0, index - 100)
      const searchEnd = Math.min(text.length, index + panUrl.length + 100)
      const contextText = text.substring(searchStart, searchEnd)
      
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

// 标准化URL以去除重复
function normalizePanUrl(url) {
  // 移除URL中的查询参数
  const cleanUrl = url.replace(/\?.*$/, '')
  // 转换为小写
  return cleanUrl.toLowerCase()
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
