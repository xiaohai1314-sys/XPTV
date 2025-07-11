const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 3,
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
    const { data } = await $fetch.get(url, {
      headers: {
        'Referer': appConfig.site,
        'User-Agent': UA,
      }
    })
    
    const $ = cheerio.load(data)
    const title = $('h1').text().trim() || "网盘资源"
    
    // 直接提取资源区域内容
    let resourceContent = $('.thread-content').html() || $('.post-content').html() || $('body').html()
    
    if (!resourceContent) {
      return jsonify({ list: [{
        title: "资源列表",
        tracks: [],
      }]})
    }
    
    // 清除干扰元素
    const $res = cheerio.load(resourceContent)
    $res('script, style, iframe, noscript').remove()
    
    // 提取所有文本内容
    const allText = $res('body').text()
    
    // 提取天翼云盘链接
    const panMatches = allText.match(/https?:\/\/cloud\.189\.cn\/(t|web\/share)\/[^\s<)]+/gi) || []
    
    // 提取访问码
    let accessCode = ''
    const codeMatch = allText.match(/(?:访问码|密码|访问密码|提取码|code)[:：]?\s*(\w{4,6})/i)
    if (codeMatch) {
      accessCode = codeMatch[1]
    } else {
      // 尝试匹配独立的4-6位字母数字
      const codeMatch2 = allText.match(/\b([a-z0-9]{4,6})\b(?!.*http)/i)
      if (codeMatch2) accessCode = codeMatch2[1]
    }
    
    // 添加唯一资源
    const uniquePans = [...new Set(panMatches)]
    uniquePans.forEach(panUrl => {
      if (/https?:\/\/cloud\.189\.cn\/(t|web\/share)\//i.test(panUrl)) {
        tracks.push({
          name: title,
          pan: panUrl,
          ext: { accessCode }
        })
      }
    })
    
    // 如果还没找到，尝试链接提取
    if (tracks.length === 0) {
      $res('a').each((i, el) => {
        let href = $res(el).attr('href') || ''
        href = href.replace(/&amp;/g, '&')
        
        if (/https?:\/\/cloud\.189\.cn\/(t|web\/share)\//i.test(href)) {
          const linkText = $res(el).text().trim()
          const context = $res(el).parent().text()
          const ac = extractAccessCode(linkText, context) || accessCode
          
          tracks.push({
            name: title,
            pan: href,
            ext: { accessCode: ac }
          })
        }
      })
    }
    
    return jsonify({ list: [{
      title: "资源列表",
      tracks,
    }]})
  } catch (e) {
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
