const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const cheerio = createCheerio()

const appConfig = {
  ver: 1,
  title: '雷鲸',
  site: 'https://www.leijing.xyz',
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
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
      'Referer': appConfig.site + '/',
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
        url: appConfig.site + href,
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
      'Referer': appConfig.site + '/',
      'User-Agent': UA,
    }
  })

  const $ = cheerio.load(data)
  const title = $('h1').text().trim() || "网盘资源"
  const pageHtml = $.html()
  const validResources = extractValidResources(pageHtml, title)

  validResources.forEach((resource, idx) => {
    tracks.push({
      name: validResources.length > 1 ? `${title} - 资源${idx + 1}` : title,
      pan: resource.url,
      ext: { accessCode: resource.accessCode }
    })
  })

  return jsonify({
    list: [{ title: "资源列表", tracks }]
  })
}

function extractValidResources(html, title) {
  const $ = cheerio.load(html)
  const resources = []
  const downloadSection = findDownloadSection($)

  if (downloadSection) {
    extractResourcesFromSection($, downloadSection, resources)
  }

  if (resources.length === 0) {
    $('body').find('*').each((i, el) => {
      const text = $(el).text()
      const href = $(el).attr('href') || ''

      if (isValidPanUrl(href)) {
        const accessCode = extractAccessCode(text, $(el).parent().text())
        addResource(resources, href, accessCode)
      }

      const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<\)）\]、，,】]+/g) || []
      panMatches.forEach(url => {
        const accessCode = extractAccessCode(text)
        addResource(resources, url, accessCode)
      })
    })
  }

  if (resources.length === 0) {
    const text = $('body').text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<\)）\]、，,】]+/g) || []

    panMatches.forEach(url => {
      const context = getTextContext(text, url)
      const accessCode = extractAccessCode(context)
      addResource(resources, url, accessCode)
    })
  }

  return resources
}

function isValidPanUrl(url) {
  return !!url && /https?:\/\/cloud\.189\.cn\/.+/.test(url)
}

function addResource(resources, url, accessCode = '') {
  const cleanUrl = url.replace(/[\s)）]+$/, '')
  const exists = resources.some(r => r.url === cleanUrl)
  if (!exists) {
    resources.push({ url: cleanUrl, accessCode })
  }
}

function findDownloadSection($) {
  const downloadHeaders = $('p, div, h3, h4, section, span').filter((i, el) => {
    const text = $(el).text().trim()
    return /下载地址|网盘链接|资源下载|下载链接|分享地址|领取地址/i.test(text)
  })

  if (downloadHeaders.length > 0) {
    return downloadHeaders.first().parent()
  }
  return null
}

function extractResourcesFromSection($, section, resources) {
  section.find('a').each((i, el) => {
    const href = $(el).attr('href')
    if (isValidPanUrl(href)) {
      const text = $(el).text()
      const parentText = $(el).parent().text()
      const accessCode = extractAccessCode(text, parentText)
      addResource(resources, href, accessCode)
    }
  })

  section.find('p, div, span').each((i, el) => {
    const text = $(el).text()
    const panMatches = text.match(/https?:\/\/cloud\.189\.cn\/[^\s<\)）\]、，,】]+/g) || []
    panMatches.forEach(url => {
      const accessCode = extractAccessCode(text)
      addResource(resources, url, accessCode)
    })
  })
}

function getTextContext(fullText, targetUrl, radius = 200) {
  const index = fullText.indexOf(targetUrl)
  if (index === -1) return ''
  const start = Math.max(0, index - radius)
  const end = Math.min(fullText.length, index + targetUrl.length + radius)
  return fullText.substring(start, end)
}

function extractAccessCode(...texts) {
  for (const text of texts) {
    if (!text) continue

    let match = null

    match = text.match(/（\s*(?:访问码|密码|提取码)\s*[:：]?\s*([a-zA-Z0-9]{4,6})\s*）/i)
    if (match) return match[1]

    match = text.match(/(?:访问码|密码|提取码|access[ _]?code)\s*[:：]?\s*([a-zA-Z0-9]{4,6})\b/i)
    if (match) return match[1]

    match = text.match(/\b([a-zA-Z0-9]{4,6})\b(?![^]*http)/)
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
        url: appConfig.site + href,
      },
    })
  })

  return jsonify({ list: cards })
}
