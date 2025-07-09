
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (AppleTV; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
  ver: 2,
  title: '观影网 (新版)',
  site: 'https://www.gying.org',
  tabs: [
    { name: '电影', ext: { id: '/mv/------' } },
    { name: '剧集', ext: { id: '/tv/------' } },
    { name: '动漫', ext: { id: '/ac/------' } },
  ],
}

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  let { page = 1, id } = ext
  const url = appConfig.site + id + page

  const { data } = await $fetch.get(url, {
    headers: { "User-Agent": UA },
  })

  const $ = cheerio.load(data)

  $('.swiper-slide a').each((i, el) => {
    const name = $(el).attr('title') || '未知'
    const href = $(el).attr('href')
    const pic = $(el).find('img').attr('data-src')

    if (href && name) {
      cards.push({
        vod_id: href,
        vod_name: name,
        vod_pic: pic?.startsWith('http') ? pic : `${pic}`,
        vod_remarks: '',
        ext: {
          url: appConfig.site + href,
        },
      })
    }
  })

  return jsonify({ list: cards })
}

async function getTracks(ext) {
  ext = argsify(ext)
  const url = ext.url
  const { data } = await $fetch.get(url, {
    headers: { "User-Agent": UA },
  })

  const $ = cheerio.load(data)
  let tracks = []

  $('#sBox .player-all a').each((i, el) => {
    const name = $(el).text().trim()
    const href = $(el).attr('href')
    if (href && name) {
      tracks.push({
        name,
        url: appConfig.site + href,
        ext: { url: appConfig.site + href }
      })
    }
  })

  if (tracks.length === 0) {
    $utils.toastError("未找到播放资源")
  }

  return jsonify({
    list: [
      {
        title: '播放线路',
        tracks,
      },
    ],
  })
}

async function getPlayinfo(ext) {
  ext = argsify(ext)
  return jsonify({ urls: [ext.url] })
}

async function search(ext) {
  ext = argsify(ext)
  const text = encodeURIComponent(ext.text)
  const page = ext.page || 1
  const url = `${appConfig.site}/s/1---${page}/${text}`

  const { data } = await $fetch.get(url, {
    headers: { "User-Agent": UA },
  })

  const $ = cheerio.load(data)
  let cards = []

  $('.swiper-slide a').each((i, el) => {
    const name = $(el).attr('title') || '未知'
    const href = $(el).attr('href')
    const pic = $(el).find('img').attr('data-src')

    if (href && name) {
      cards.push({
        vod_id: href,
        vod_name: name,
        vod_pic: pic?.startsWith('http') ? pic : `${pic}`,
        vod_remarks: '',
        ext: {
          url: appConfig.site + href,
        },
      })
    }
  })

  return jsonify({ list: cards })
}
