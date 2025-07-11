const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 4,
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
    // 打印调试信息
    console.log(`正在加载资源页面: ${url}`)
    
    const { data } = await $fetch.get(url, {
      headers: {
        'Referer': appConfig.site,
        'User-Agent': UA,
      }
    })
    
    const $ = cheerio.load(data)
    const title = $('h1').text().trim() || "网盘资源"
    
    // 打印页面标题
    console.log(`页面标题: ${title}`)
    
    // 1. 直接查找下载区域
    let downloadContent = ""
    $('p, div').each((i, el) => {
      const text = $(el).text().trim()
      if (text.includes('下载地址') || text.includes('网盘链接') || text.includes('资源地址')) {
        downloadContent = $(el).parent().html()
        return false // 退出循环
      }
    })
    
    // 2. 如果没找到，尝试整个内容区域
    if (!downloadContent) {
      downloadContent = $('.thread-content, .post-content, .content').first().html()
    }
    
    // 3. 如果仍然没找到，使用整个页面
    if (!downloadContent) {
      downloadContent = $('body').html()
      console.log("使用整个页面内容提取资源")
    }
    
    // 打印内容长度
    console.log(`提取内容长度: ${downloadContent ? downloadContent.length : 0} 字符`)
    
    if (!downloadContent) {
      console.log("未找到任何内容区域")
      return jsonify({ list: [{
        title: "资源列表",
        tracks: [],
      }]})
    }
    
    // 处理下载内容
    const $dl = cheerio.load(downloadContent)
    
    // 打印处理后的HTML
    console.log("处理后的HTML:", $dl.html().substring(0, 500) + "...")
    
    // 提取所有链接
    $dl('a').each((i, el) => {
      let href = $dl(el).attr('href') || ''
      href = href.replace(/&amp;/g, '&')
      
      if (isValidPanUrl(href)) {
        const linkText = $dl(el).text().trim()
        const parentText = $dl(el).parent().text()
        
        // 打印找到的链接
        console.log(`找到链接: ${href}, 文本: ${linkText}`)
        
        const accessCode = extractAccessCode(linkText, parentText)
        tracks.push({
          name: title,
          pan: href,
          ext: { accessCode }
        })
      }
    })
    
    // 提取文本中的链接
    const textContent = $dl.text()
    const panMatches = textContent.match(/https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi) || []
    
    // 打印文本中找到的链接
    console.log(`在文本中找到 ${panMatches.length} 个链接`)
    
    // 提取访问码
    let globalAccessCode = ''
    const codeMatch = textContent.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*(\w{4,6})/i)
    if (codeMatch) {
      globalAccessCode = codeMatch[1]
      console.log(`全局访问码: ${globalAccessCode}`)
    } else {
      // 尝试匹配独立的4-6位字母数字
      const codeMatch2 = textContent.match(/\b([a-z0-9]{4,6})\b(?!.*http)/i)
      if (codeMatch2) {
        globalAccessCode = codeMatch2[1]
        console.log(`独立访问码: ${globalAccessCode}`)
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
        }
      }
    })
    
    // 打印最终找到的资源数量
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

// 检查是否是有效的天翼云盘URL
function isValidPanUrl(url) {
  if (!url) return false
  return /https?:\/\/cloud\.189\.cn\/(t|web\/share)\//i.test(url)
}

// 提取访问码（支持更多格式）
function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue
    
    // 尝试多种格式
    let match = text.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*(\w{4,6})\b/i)
    if (match) return match[1]
    
    // 尝试匹配纯4-6位字母数字
    match = text.match(/\b([a-z0-9]{4,6})\b(?!.*http)/i)
    if (match) return match[1]
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
