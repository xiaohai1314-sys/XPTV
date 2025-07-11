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
  const pageHtml = $.html()

  // 提取有效的网盘资源
  const validResources = extractValidResources(pageHtml)

  validResources.forEach((res, i) => {
    tracks.push({
      name: validResources.length > 1 ? `${title} - 资源${i + 1}` : title,
      pan: res.url,
      ext: { accessCode: res.accessCode }
    })
  })

  return jsonify({
    list: [{
      title: "资源列表",
      tracks
    }]
  })
}

// 提取有效的网盘资源
function extractValidResources(html) {
  const $ = cheerio.load(html)
  const resources = []

  // 查找所有有效的天翼云盘链接
  $('a').each((i, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text()
    
    // 只匹配天翼云盘链接
    if (href.includes('cloud.189.cn')) {
      const accessCode = extractAccessCode(text, $(el).parent().text())
      resources.push({
        url: href,
        accessCode: accessCode || ''
      })
    }
  })

  return resources
}

// 提取访问码
function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue

    // 强化访问码的匹配
    let match = text.match(/（?\s*(?:访问码|密码|提取码)\s*[:：]?\s*([a-zA-Z0-9]{4,6})\s*）?/i)
    if (match) return match[1]

    match = text.match(/\b([a-zA-Z0-9]{4,6})\b(?!.*http)/)
    if (match && !/\d{8,}/.test(match[1])) return match[1]
  }
  return ''
}

async function getPlayinfo(ext) {
  return jsonify({ urls: [] })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = []
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  let url = `${appConfig.site}/search?keyword=${text}&page=${page}`

  const { data } = await $fetch.get(url, {
    headers: { 'User-Agent': UA },
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
