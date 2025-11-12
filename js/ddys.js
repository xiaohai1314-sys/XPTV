/**
 * ==============================================================================
 * 适配 ddys.la (低端影视) 的最终完整版脚本 - 带调试显示
 * ------------------------------------------------------------------------------
 * 功能：
 * 1. 首页、分类、搜索、详情、播放全功能；
 * 2. 播放页自动解密 getPlayinfo；
 * 3. 解密失败时在详情页显示调试日志；
 * ==============================================================================
 */

const cheerio = createCheerio()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://ddys.la/',
  'Origin': 'https://ddys.la',
  'User-Agent': UA,
}

const appConfig = {
  ver: 12,
  title: "低端影视",
  site: "https://ddys.la",
  tabs: [
    { name: '首页', ext: { url: '/' } },
    { name: '电影', ext: { url: '/category/dianying.html' } },
    { name: '剧集', ext: { url: '/category/juji.html' } },
    { name: '动漫', ext: { url: '/category/dongman.html' } },
    { name: '综艺', ext: { url: '/category/zongyi.html' } },
    { name: '发现', ext: { url: '/search/-------------.html' } },
  ]
}

async function getConfig() {
  return jsonify(appConfig)
}

/**
 * ==============================================================================
 * 分类页 / 首页
 * ==============================================================================
 */
async function getCards(ext) {
  ext = argsify(ext)
  let urlPath = ext.url
  const page = ext.page || 1

  if (page > 1) {
    if (urlPath === '/') {
      urlPath = `/page/${page}`
    } else if (urlPath.includes('/search/')) {
      urlPath = urlPath.replace(/(-(\d+))?\.html/, `----------${page}---.html`)
    } else {
      urlPath = urlPath.replace('.html', `-${page}.html`)
    }
  }

  const fullUrl = appConfig.site + urlPath
  const { data } = await $fetch.get(fullUrl, { headers })
  const $ = cheerio.load(data)
  const list = []

  $('ul.stui-vodlist > li').each((_, el) => {
    const thumb = $(el).find('a.stui-vodlist__thumb')
    const title = $(el).find('h4.title > a').attr('title')
    const href = thumb.attr('href')
    const pic = thumb.attr('data-original')
    const remarks = thumb.find('span.pic-text').text().trim()

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarks,
        ext: { url: href },
      })
    }
  })

  return jsonify({ list })
}

/**
 * ==============================================================================
 * 搜索
 * ==============================================================================
 */
async function search(ext) {
  ext = argsify(ext)
  const text = encodeURIComponent(ext.text)
  const page = ext.page || 1
  const searchUrl = `${appConfig.site}/search/${text}----------${page}---.html`

  const { data } = await $fetch.get(searchUrl, { headers })
  const $ = cheerio.load(data)
  const list = []

  $('ul.stui-vodlist > li').each((_, el) => {
    const thumb = $(el).find('a.stui-vodlist__thumb')
    const title = $(el).find('h4.title > a').attr('title')
    const href = thumb.attr('href')
    const pic = thumb.attr('data-original')
    const remarks = thumb.find('span.pic-text').text().trim()

    if (href && title) {
      list.push({
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remarks,
        ext: { url: href },
      })
    }
  })

  return jsonify({ list })
}

/**
 * ==============================================================================
 * 详情页（含剧集分组）
 * ==============================================================================
 */
async function getTracks(ext) {
  ext = argsify(ext)
  const url = appConfig.site + ext.url
  const { data } = await $fetch.get(url, { headers })
  const $ = cheerio.load(data)
  const groups = []

  $('.stui-vodlist__head').each((_, head) => {
    const title = $(head).find('h3').text().trim()
    const list = $(head).next('ul.stui-content__playlist')
    if (!list.length || title.includes('猜你喜欢')) return

    const tracks = []
    list.find('li a').each((_, a) => {
      const name = $(a).text().trim()
      const href = $(a).attr('href')
      if (href) tracks.push({ name, ext: { play_url: href } })
    })

    if (tracks.length > 0) {
      groups.push({ title, tracks })
    }
  })

  if (groups.length === 0) {
    // 无播放源时提示
    groups.push({ title: "⚠️ 暂无播放资源", tracks: [] })
  }

  return jsonify({ list: groups })
}

/**
 * ==============================================================================
 * 播放页 - 自动解密 + 调试显示
 * ==============================================================================
 */
async function getPlayinfo(ext) {
  ext = argsify(ext)
  const pageUrl = appConfig.site + ext.play_url
  let debug = `🧩 播放调试信息\n[page] ${pageUrl}\n`

  try {
    const { data: html } = await $fetch.get(pageUrl, { headers })
    const m = html.match(/var\s+player_aaaa\s*=\s*\{[^}]*?url\s*:\s*['"]([^'"]+)['"]/)
    if (!m) {
      debug += "❌ 未找到 player_aaaa.url\n"
      return jsonify({ urls: [], desc: debug })
    }

    let raw = m[1].trim()
    if (raw.includes('|')) raw = raw.split('|')[1]
    debug += `[raw] ${raw}\n`

    // Base64 解密
    let decoded = base64decode(raw)
    if (/^[A-Za-z0-9+/=]+$/.test(decoded)) {
      try { decoded = base64decode(decoded) } catch {}
    }
    debug += `[decoded] ${decoded}\n`

    if (/ddys\.(pro|vip|love)/.test(decoded)) {
      debug += `[fetch JSON] ${decoded}\n`
      const { data: json } = await $fetch.get(decoded, {
        headers: {
          ...headers,
          'X-Requested-With': 'XMLHttpRequest',
        }
      })
      let j
      try { j = typeof json === 'string' ? JSON.parse(json) : json } catch { j = {} }

      if (j.url && j.url.startsWith('http')) {
        debug += `[m3u8] ${j.url}\n✅ 成功解密`
        return jsonify({ urls: [j.url], ui: 1 })
      }
      debug += `⚠️ 二次 JSON 返回异常: ${JSON.stringify(json)}`
      return jsonify({ urls: [], desc: debug })
    }

    if (decoded.startsWith('http') && decoded.includes('.m3u8')) {
      debug += '✅ 直接是可播放地址'
      return jsonify({ urls: [decoded], ui: 1 })
    }

    debug += '❌ 未识别出播放链接'
    return jsonify({ urls: [], desc: debug })

  } catch (e) {
    debug += `💥 异常: ${e.message}`
    return jsonify({ urls: [], desc: debug })
  }
}
