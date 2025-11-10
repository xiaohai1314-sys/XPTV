const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

// ==========================
// 1. 基础配置
// ==========================
const appConfig = {
  ver: 11,
  title: "低端影视",
  site: "https://ddys.la",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/category/dianying.html' } },
    { name: '剧集', ext: { url: '/category/juji.html' } },
    { name: '动漫', ext: { url: '/category/dongman.html' } },
    { name: '发现', ext: { url: '/search/-------------.html' } }
  ]
}

async function getConfig() {
  return jsonify(appConfig)
}

// ==========================
// 2. 分类与分页
// ==========================
async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let urlPath = ext.url
  let page = ext.page || 1

  if (page > 1) {
    if (urlPath === '/') return jsonify({ list: [] })
    if (urlPath.includes('/search/')) {
      urlPath = urlPath.replace(/(-(\d+))?\.html/, `----------${page}---.html`)
    } else {
      urlPath = urlPath.replace('.html', `-${page}.html`)
    }
  }

  const fullUrl = appConfig.site + urlPath
  const { data } = await $fetch.get(fullUrl, { headers })
  const $ = cheerio.load(data)

  $('ul.stui-vodlist > li').each((_, each) => {
    const thumb = $(each).find('a.stui-vodlist__thumb')
    const titleLink = $(each).find('h4.title > a')

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: { url: thumb.attr('href') },
    })
  })

  return jsonify({ list: cards })
}

// ==========================
// 3. 搜索功能（已修复）
// ==========================
async function search(ext) {
  ext = argsify(ext)
  let cards = []
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1

  const searchUrl = `${appConfig.site}/search/${text}----------${page}---.html`
  const { data } = await $fetch.get(searchUrl, { headers })
  const $ = cheerio.load(data)

  $('ul.stui-vodlist > li').each((_, each) => {
    const thumb = $(each).find('a.stui-vodlist__thumb')
    const titleLink = $(each).find('h4.title > a')

    cards.push({
      vod_id: thumb.attr('href'),
      vod_name: titleLink.attr('title'),
      vod_pic: thumb.attr('data-original'),
      vod_remarks: thumb.find('span.pic-text').text().trim(),
      ext: { url: thumb.attr('href') },
    })
  })

  return jsonify({ list: cards })
}

// ==========================
// 4. 播放源提取（自动识别多路线 + 独立集数样式）
// ==========================
async function getTracks(ext) {
  ext = argsify(ext)
  const url = appConfig.site + ext.url
  const { data } = await $fetch.get(url, { headers })
  const $ = cheerio.load(data)
  let groups = []

  $('.stui-pannel-box').each((_, panel) => {
    const sourceTitle = $(panel).find('.stui-vodlist__head h3').text().trim()
    const playlistItems = $(panel).find('ul.stui-content__playlist li')
    if (!sourceTitle || playlistItems.length === 0) return

    // 检测当前播放源的集数样式
    let firstText = $(playlistItems[0]).find('a').text().trim()
    let isTwoDigit = /^\d{2}$/.test(firstText)

    const group = {
      title: sourceTitle,  // 保留真实源名，如 baoyun / gongyou
      tracks: []
    }

    playlistItems.each((__, item) => {
      const a = $(item).find('a')
      const rawText = a.text().trim()
      const titleAttr = a.attr('title') || ''
      const href = a.attr('href')
      if (!href) return

      let name = rawText
      const numMatch = rawText.match(/^\d+$/) || titleAttr.match(/第(\d+)集/)
      if (numMatch) {
        const num = parseInt(numMatch[1] || numMatch[0], 10)
        name = isTwoDigit ? String(num).padStart(2, '0') : String(num)
      }

      group.tracks.push({
        name,
        pan: '',
        ext: { play_url: href }
      })
    })

    if (group.tracks.length > 0) {
      groups.push(group)
    }
  })

  return jsonify({ list: groups })
}

// ==========================
// 5. 播放解析
// ==========================
async function getPlayinfo(ext) {
  ext = argsify(ext)
  const url = appConfig.site + ext.play_url
  const { data } = await $fetch.get(url, { headers })
  const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/)
  if (match && match[1]) {
    return jsonify({ urls: [match[1]], ui: 1 })
  }
  return jsonify({ urls: [] })
}
