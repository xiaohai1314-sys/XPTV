const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    {
      name: '剧集',
      ext: { id: 'tagId=42204684250355' },
    },
    {
      name: '电影',
      ext: { id: 'tagId=42204681950354' },
    },
    {
      name: '动漫',
      ext: { id: 'tagId=42204792950357' },
    },
    {
      name: '纪录片',
      ext: { id: 'tagId=42204697150356' },
    },
    {
      name: '综艺',
      ext: { id: 'tagId=42210356650363' },
    },
    {
      name: '影视原盘',
      ext: { id: 'tagId=42212287587456' },
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

  const url = appConfig.site + `/thread?topicId=${id}&page=${page}`

  // 打印请求的URL，确认能否正确请求数据
  print(`请求链接：${url}`)

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': 'https://www.leijing.xyz/',
      'User-Agent': UA,
    }
  })

  // 打印网页内容，检查是否能获取到页面数据
  print(`页面内容：${data.slice(0, 500)}`)

  const $ = cheerio.load(data)

  // 打印抓取的HTML内容
  $('.topicItem').each((index, each) => {
    const href = $(each).find('h2 a').attr('href')
    const title = $(each).find('h2 a').text()

    const regex = /(?:【.*?】)?(?:（.*?）)?([^\s.（]+(?:\s+[^\s.（]+)*)/
    const match = title.match(regex)
    const dramaName = match ? match[1] : title

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

  print(`请求网盘资源链接：${url}`)

  const { data } = await $fetch.get(url, {
    headers: {
      'Referer': 'https://www.leijing.xyz/',
      'User-Agent': UA,
    }
  })

  // 打印页面HTML，检查是否加载成功
  print(`页面内容：${data.slice(0, 500)}`)

  const $ = cheerio.load(data)
  const title = $('h1').text().trim() || "网盘资源"
  const pageHtml = $.html()

  const validResources = extractValidResources(pageHtml)

  // 打印提取的资源
  print(`✅ 抓取到资源数量: ${validResources.length}`)

  validResources.forEach((res, i) => {
    print(`资源${i + 1}: 链接=${res.url}, 提取码=${res.accessCode}`)
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

function extractValidResources(html) {
  const $ = cheerio.load(html)
  const resources = []

  $('body').find('*').each((i, el) => {
    const text = $(el).text()
    const href = $(el).attr('href') || ''

    // 强化匹配天翼网盘链接
    if (href && href.includes('cloud.189.cn')) {
      print(`📌 命中链接: ${href}`)
      const accessCode = extractAccessCode(text, $(el).parent().text())
      const fullUrlWithCode = href + (accessCode ? ` （访问码：${accessCode}）` : '')
      addResource(resources, fullUrlWithCode, accessCode)
    }

    // 处理文本中的链接
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<\)）]+/g) || []
    panMatches.forEach(url => {
      const accessCode = extractAccessCode(text)
      const fullUrlWithCode = url + (accessCode ? ` （访问码：${accessCode}）` : '')
      addResource(resources, fullUrlWithCode, accessCode)
    })
  })

  if (resources.length === 0) {
    const text = $('body').text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<\)）]+/g) || []
    panMatches.forEach(url => {
      const context = getTextContext(text, url)
      const accessCode = extractAccessCode(context)
      const fullUrlWithCode = url + (accessCode ? ` （访问码：${accessCode}）` : '')
      addResource(resources, fullUrlWithCode, accessCode)
    })
  }

  return resources
}

function addResource(resources, url, accessCode = '') {
  const cleanUrl = url.replace(/[\s\)）]+$/, '')
  const exists = resources.some(r => r.url === cleanUrl)
  if (!exists) {
    resources.push({ url: cleanUrl, accessCode })
  }
}

function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue

    // 强化匹配访问码
    let match = text.match(/（?\s*(?:访问码|密码|提取码)\s*[:：]?\s*([a-zA-Z0-9]{4,6})\s*）?/i)
    if (match) return match[1]

    match = text.match(/\b([a-zA-Z0-9]{4,6})\b(?!.*http)/)
    if (match && !/\d{8,}/.test(match[1])) return match[1]
  }
  return ''
}

function getTextContext(text, targetUrl, radius = 200) {
  const idx = text.indexOf(targetUrl)
  if (idx === -1) return ''
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + targetUrl.length + radius)
  return text.substring(start, end)
}
