const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 7,
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
    
    // 1. 重点查找包含"云盘"的区域 - 针对新页面结构
    let cloudSection = null
    
    // 查找包含"云盘"标题的区块
    $('h2, h3, strong').each((i, el) => {
      const text = $(el).text().trim()
      if (text.includes('云盘') || text.includes('网盘') || text.includes('资源')) {
        cloudSection = $(el).parent()
        return false // 退出循环
      }
    })
    
    // 2. 如果没找到，尝试整个内容区域
    if (!cloudSection) {
      cloudSection = $('.thread-content, .post-content, .content, .topic-content').first()
      console.log("未找到云盘区域，使用整个内容区域")
    }
    
    if (!cloudSection || cloudSection.length === 0) {
      cloudSection = $('body')
      console.log("使用整个页面作为内容区域")
    }
    
    // 提取HTML内容
    const contentHtml = cloudSection.html()
    
    if (!contentHtml) {
      console.log("未找到任何内容区域")
      return jsonify({ list: [{
        title: "资源列表",
        tracks: [],
      }]})
    }
    
    console.log(`内容区域长度: ${contentHtml.length} 字符`)
    
    // 处理内容区域
    const $content = cheerio.load(contentHtml)
    
    // 3. 提取所有链接（包括简介中的直接链接）
    $content('a').each((i, el) => {
      let href = $content(el).attr('href') || ''
      href = href.replace(/&amp;/g, '&')
      
      if (isValidPanUrl(href)) {
        const linkText = $content(el).text().trim()
        const parentText = $content(el).parent().text()
        
        console.log(`找到链接: ${href}, 文本: ${linkText}`)
        
        const accessCode = extractAccessCode(linkText, parentText)
        tracks.push({
          name: title,
          pan: href,
          ext: { accessCode }
        })
      }
    })
    
    // 4. 提取文本内容
    const textContent = $content.text()
    
    // 5. 特别处理简介中的直接网盘链接（带访问码格式）
    const directLinkMatches = textContent.match(/(https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s)]+)\s*\(?(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\)?/gi)
    
    if (directLinkMatches) {
      console.log(`找到 ${directLinkMatches.length} 个直接链接匹配项`)
      
      directLinkMatches.forEach(match => {
        const panMatch = match.match(/(https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s)]+)/i)
        const codeMatch = match.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})/i)
        
        if (panMatch && codeMatch) {
          const panUrl = panMatch[0]
          const accessCode = codeMatch[1]
          
          // 避免重复添加
          const exists = tracks.some(t => t.pan === panUrl)
          if (!exists) {
            tracks.push({
              name: title,
              pan: panUrl,
              ext: { accessCode }
            })
            console.log(`从简介直接找到资源: ${panUrl}, 访问码: ${accessCode}`)
          }
        }
      })
    }
    
    // 6. 提取所有天翼云盘链接（包括简介中的直接链接）
    const panMatches = textContent.match(/https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi) || []
    console.log(`在文本中找到 ${panMatches.length} 个链接`)
    
    // 7. 提取访问码 - 特别关注数字+字母组合
    let globalAccessCode = ''
    
    // 优先尝试关键词后的访问码
    const codeMatch = textContent.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})/i)
    if (codeMatch) {
      globalAccessCode = codeMatch[1]
      console.log(`关键词访问码: ${globalAccessCode}`)
    }
    
    // 尝试提取独立访问码（数字+字母组合）
    if (!globalAccessCode) {
      // 更全面的独立访问码匹配
      const standaloneCode = textContent.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/gi)
      if (standaloneCode && standaloneCode.length > 0) {
        // 过滤掉常见无效组合
        const validCodes = standaloneCode.filter(code => 
          !/^[0-9]+$/.test(code) && // 排除纯数字
          !/^[a-z]+$/.test(code) && // 排除纯字母
          !/^[0-9]{4}$/.test(code) && // 排除4位纯数字（可能是年份）
          !/^(?:http|www)/i.test(code) // 排除URL片段
        )
        
        if (validCodes.length > 0) {
          globalAccessCode = validCodes[0]
          console.log(`独立访问码: ${globalAccessCode}`)
        }
      }
    }
    
    // 添加文本中找到的链接
    panMatches.forEach(panUrl => {
      if (isValidPanUrl(panUrl)) {
        // 避免重复添加
        const exists = tracks.some(t => t.pan === panUrl)
        if (!exists) {
          tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode: globalAccessCode }
          })
          console.log(`添加文本链接: ${panUrl}`)
        }
      }
    })
    
    // 8. 如果还没找到资源，尝试深度扫描整个页面
    if (tracks.length === 0) {
      console.log("常规方法未找到资源，尝试深度扫描...")
      
      // 深度扫描整个页面
      const fullText = $('body').text()
      const deepPanMatches = fullText.match(/https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi) || []
      
      // 深度扫描访问码
      let deepAccessCode = ''
      const deepCodeMatch = fullText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})/i)
      if (deepCodeMatch) {
        deepAccessCode = deepCodeMatch[1]
      }
      
      // 添加找到的资源
      deepPanMatches.forEach(panUrl => {
        if (isValidPanUrl(panUrl)) {
          tracks.push({
            name: title,
            pan: panUrl,
            ext: { accessCode: deepAccessCode || globalAccessCode }
          })
          console.log(`深度扫描添加: ${panUrl}`)
        }
      })
      
      console.log(`深度扫描找到 ${deepPanMatches.length} 个资源`)
    }
    
    console.log(`共找到 ${tracks.length} 个资源`)
    
    // 9. 特殊处理：如果仍然没有资源，尝试提取所有链接
    if (tracks.length === 0) {
      console.log("最终尝试：提取页面所有链接")
      
      $('a').each((i, el) => {
        let href = $(el).attr('href') || ''
        href = href.replace(/&amp;/g, '&')
        
        if (isValidPanUrl(href)) {
          const linkText = $(el).text().trim()
          const parentText = $(el).parent().text()
          
          const accessCode = extractAccessCode(linkText, parentText)
          tracks.push({
            name: title,
            pan: href,
            ext: { accessCode }
          })
        }
      })
    }
    
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

// 增强访问码提取函数
function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue
    
    // 1. 尝试关键词后的访问码（字母+数字组合）
    let match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*([a-z0-9]{4,6})\b/i)
    if (match) return match[1]
    
    // 2. 尝试括号内的访问码
    match = text.match(/[\(（][^\)）]*?(?:访问码|密码|码|code)?[:：]?\s*([a-z0-9]{4,6})[^\)）]*[\)）]/i)
    if (match) return match[1]
    
    // 3. 尝试冒号后的访问码
    match = text.match(/[:：]\s*([a-z0-9]{4,6})\b/i)
    if (match) return match[1]
    
    // 4. 尝试独立访问码（带边界检查）
    match = text.match(/(?<![a-z0-9])([a-z0-9]{4,6})(?![a-z0-9])/i)
    if (match) {
      const code = match[1]
      // 排除常见无效组合
      if (!/^[0-9]+$/.test(code) && // 排除纯数字
          !/^[a-z]+$/.test(code) && // 排除纯字母
          !/^[0-9]{4}$/.test(code)) { // 排除4位纯数字（可能是年份）
        return code
      }
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
