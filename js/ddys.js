// --- 低端影视 ddys.la ---
// 基于 girigirilove 播放逻辑重构版，带调试输出

const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

const appConfig = {
  ver: 20,
  title: "低端影视",
  site: "https://ddys.la",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/category/dianying.html' } },
    { name: '剧集', ext: { url: '/category/juji.html' } },
    { name: '动漫', ext: { url: '/category/dongman.html' } },
    { name: '综艺', ext: { url: '/category/zongyi.html' } },
  ]
}

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let url = appConfig.site + ext.url
  const page = ext.page || 1

  if (page > 1) {
    if (ext.url === '/') url = `${appConfig.site}/page/${page}`
    else url = url.replace('.html', `-${page}.html`)
  }

  const { data } = await $fetch.get(url, { headers })
  const $ = cheerio.load(data)
  const list = []

  $('ul.stui-vodlist > li').each((_, each) => {
    const a = $(each).find('a.stui-vodlist__thumb')
    const title = a.attr('title')
    const href = a.attr('href')
    const pic = a.attr('data-original')
    const remarks = a.find('.pic-text').text().trim()

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarks,
        ext: { url: href }
      })
    }
  })

  return jsonify({ list })
}

async function search(ext) {
  ext = argsify(ext)
  const text = encodeURIComponent(ext.text)
  const page = ext.page || 1
  const url = `${appConfig.site}/search/${text}----------${page}---.html`

  const { data } = await $fetch.get(url, { headers })
  const $ = cheerio.load(data)
  const list = []

  $('ul.stui-vodlist > li').each((_, each) => {
    const a = $(each).find('a.stui-vodlist__thumb')
    const title = a.attr('title')
    const href = a.attr('href')
    const pic = a.attr('data-original')
    const remarks = a.find('.pic-text').text().trim()

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarks,
        ext: { url: href }
      })
    }
  })

  return jsonify({ list })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const url = appConfig.site + ext.url
  const { data } = await $fetch.get(url, { headers })
  const $ = cheerio.load(data)
  const groups = []

  $('.stui-vodlist__head').each((_, head) => {
    const title = $(head).find('h3').text().trim()
    const list = $(head).next('ul.stui-content__playlist')

    if (title.includes('猜你喜欢') || list.length === 0) return

    const tracks = []
    list.find('li a').each((_, a) => {
      const name = $(a).text().trim()
      const href = $(a).attr('href')
      if (href) tracks.push({ name, ext: { play_url: href } })
    })

    if (tracks.length > 0) groups.push({ title, tracks })
  })

  if (groups.length === 0) groups.push({ title: '暂无播放资源', tracks: [] })
  return jsonify({ list: groups })
}

async function getPlayinfo(ext) {
  ext = argsify(ext)
  const url = appConfig.site + ext.play_url
  let debug = `🧩 播放调试信息\n[page] ${url}\n`

  try {
    const { data } = await $fetch.get(url, { headers })
    const match = data.match(/player_aaaa\s*=\s*(\{.*?\})\s*<\/script>/)
    if (!match) {
      debug += "❌ 未匹配到 player_aaaa\n"
      return jsonify({ urls: [], desc: debug })
    }

    const obj = JSON.parse(match[1])
    let raw = obj.url || ''
    debug += `[raw] ${raw}\n`

    // base64 解码
    let decoded = ''
    try { decoded = decodeURIComponent(base64decode(raw)) } catch (e) {
      debug += `⚠️ base64 解码异常: ${e.message}\n`
    }
    debug += `[decoded] ${decoded}\n`

    // 部分站返回二次 base64
    if (/^[A-Za-z0-9+/=]+$/.test(decoded)) {
      try {
        decoded = decodeURIComponent(base64decode(decoded))
        debug += `[二次解码] ${decoded}\n`
      } catch {}
    }

    if (decoded.startsWith('http') && decoded.includes('.m3u8')) {
      debug += `✅ 获取成功\n`
      return jsonify({ urls: [decoded], ui: 1 })
    }

    debug += `❌ 未识别出播放链接`
    return jsonify({ urls: [], desc: debug })

  } catch (e) {
    debug += `💥 异常: ${e.message}`
    return jsonify({ urls: [], desc: debug })
  }
}

/**
 * Base64 解码函数
 */
function base64decode(str) {
  const base64DecodeChars = new Array(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1)
  let c1, c2, c3, c4
  let i = 0, len = str.length, out = ""
  while (i < len) {
    do { c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff] } while (i < len && c1 == -1)
    if (c1 == -1) break
    do { c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff] } while (i < len && c2 == -1)
    if (c2 == -1) break
    out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4))
    do {
      c3 = str.charCodeAt(i++) & 0xff
      if (c3 == 61) return out
      c3 = base64DecodeChars[c3]
    } while (i < len && c3 == -1)
    if (c3 == -1) break
    out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2))
    do {
      c4 = str.charCodeAt(i++) & 0xff
      if (c4 == 61) return out
      c4 = base64DecodeChars[c4]
    } while (i < len && c4 == -1)
    if (c4 == -1) break
    out += String.fromCharCode(((c3 & 0x03) << 6) | c4)
  }
  return out
}
