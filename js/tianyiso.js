const cheerio = createCheerio()
// CryptoJS 在这个脚本的搜索部分没有用到，可以暂时不管
// const CryptoJS = createCryptoJS() 
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

// ======================= 需要修改的地方 =======================
// 请将你从浏览器开发者工具中获取的完整 Cookie 字符串粘贴到这里
// 例如: 'cf_clearance=...; _ga=...; other_cookie=...'
const MY_COOKIE = 'ck_ml_sea_=83d39e75bc407cbfc023c2def667289367d585f5233df581966a00370efdb1e39b653dbb685ecacec78ed6fd3425f6e226e6828fc393cb8df777e57934d44ccd773c8d3fe35c3fbc528b48b89038016ea85f24ccfe5de45bfdca4e44d329cedcadfd054fabbc1a295f363423d922e9a2; _bid=1492690686784fcec8646b47f10ac1e6; __51vcke__KdedS6zcgjV65VIF=0620ed7e-442d-5682-ad13-8983bd718413; __51vuft__KdedS6zcgjV65VIF=1757313787076; _clck=1gswgyr%5E2%5Efz5%5E0%5E2077; cf_clearance=ayEdvjmFJDkI1t9Km8ctC0BughUT1zB9kImfpKU0gO4-1757313899-1.2.1.1-yELLM5e41nhuXQDGZSLEL_tPlf.RP0CkIL5ycblHQR4bs.XxDMrCdQlN0_lbuG3BKlR_Gy5Oxz04hcgoSnQVfu7H.MM8vp.1ZLAECdn008wqMcAUKIOUgYNKmgaLy5ESEqWeHl4YM2qL7sqSAJ.2.lbYSmdVBVsHT1pioYjIhbiV4GNyEc9IVjMY9hCcZuAcXrk7qo2xP97GGt6v3KaDgzdrhA0TjGlYFsLzyed8ncw; _ga=GA1.1.2054998288.1757313788; __vtins__KdedS6zcgjV65VIF=%7B%22sid%22%3A%20%22a9210f76-f059-51d3-a932-43d2f978e1b0%22%2C%20%22vd%22%3A%201%2C%20%22stt%22%3A%200%2C%20%22dr%22%3A%200%2C%20%22expires%22%3A%201757316101018%2C%20%22ct%22%3A%201757314301018%7D; __51uvsct__KdedS6zcgjV65VIF=2; _ga_XRMMB5Q449=GS2.1.s1757313787$o1$g1$t1757314301$j60$l0$h0; _clsk=1clnmss%5E1757314302437%5E4%5E1%5Ej.clarity.ms%2Fcollect'
// ============================================================

const headers = {
  'Referer': 'https://tianyiso.com/', // 域名已修改
  'Origin': 'https://tianyiso.com',   // 域名已修改
  'User-Agent': UA,
  'Cookie': MY_COOKIE // 增加了 Cookie 请求头
}

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://tianyiso.com", // 域名已修改
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
}

// getConfig, getCards, getTracks, getPlayinfo 函数保持不变
async function getConfig( ) {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  return jsonify({
    list: cards,
  })
}

async function getTracks(ext) {
  const { url } = argsify(ext)
  const { data } = await $fetch.get(url, {
    headers
  })
  // 注意：详情页的解析逻辑可能也已改变，这里暂时保持原样
  let pan = data.match(/"(https:\/\/cloud\.189\.cn\/t\/.* )",/)[1]
  return jsonify({ 
    list: [{
      title: '在线',
      tracks: [{
        name: '网盘',
        pan,
      }]
    }]
  })
}

async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  })
}


async function search(ext) {
  ext = argsify(ext)
  let cards = [];

  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }

  const url = appConfig.site + `/search?k=${text}`
  // 发送带有 Cookie 的请求
  const { data } = await $fetch.get(url, {
    headers
  })
  
  const $ = cheerio.load(data)
  
  // ======================= 解析逻辑修改 =======================
  // 根据对网站结构的观察，搜索结果的结构可能已经改变。
  // 原来的 `$('a').each` 可能不再适用。
  // 假设新的结构是每个结果在一个 class="item" 的 div 中
  // 这部分需要根据你提供的HTML源码来精确调整
  $('.video-item-root').each((_, item) => {
    const a = $(item).find('a').first()
    const path = a.attr('href') ?? ''
    if (path.startsWith('/s/')) {
      cards.push({
        vod_id: path,
        vod_name: $(item).find('.video-title').text().trim(),
        vod_pic: $(item).find('img').attr('src') || '', // 尝试获取图片
        vod_remarks: $(item).find('.video-update-info').text().trim(), // 尝试获取备注
        ext: {
          url: appConfig.site + path,
        },
      })
    }
  })
  // ============================================================

  // 如果上面的解析失败，可以回退到原来的逻辑作为备用
  if (cards.length === 0) {
      $('a').each((_, each) => {
        const path = $(each).attr('href') ?? ''
        if (path.startsWith('/s/')) {
          cards.push({
            vod_id: path,
            vod_name: $(each).find('template').first().text().trim(), // 原逻辑
            vod_pic: '',
            vod_remarks: '',
            ext: {
              url: appConfig.site + path,
            },
          })
        }
      })
  }

  return jsonify({
      list: cards,
  })
}
