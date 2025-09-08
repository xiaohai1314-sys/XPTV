const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
}

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
}

async function getConfig() {
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
  let pan = data.match(/"(https:\/\/cloud\.189\.cn\/t\/.*)",/)[1]
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
  const { data } = await $fetch.get(url, {
    headers
  })
  
  const $ = cheerio.load(data)
  
  // 修复方案1：直接定位到包含链接的van-row
  $('van-row').each((_, row) => {
    const $row = $(row)
    const $link = $row.find('a[href^="/s/"]').first()
    
    if ($link.length > 0) {
      const path = $link.attr('href')
      // 查找标题 - 可能在div中
      let title = ''
      
      // 尝试多种方式获取标题
      const $titleDiv = $row.find('div[style*="font-size:medium"]').first()
      if ($titleDiv.length > 0) {
        title = $titleDiv.text().trim()
      } else {
        // 备用方案：获取van-card内的所有文本
        title = $row.find('van-card').text().trim()
      }
      
      // 如果还是没有标题，尝试获取整个链接内的文本
      if (!title) {
        title = $link.text().trim()
      }
      
      if (title) {
        cards.push({
          vod_id: path,
          vod_name: title,
          vod_pic: '',
          vod_remarks: '',
          ext: {
            url: appConfig.site + path,
          },
        })
      }
    }
  })
  
  // 修复方案2：如果上面的方法不行，直接查找所有带/s/开头的链接
  if (cards.length === 0) {
    $('a[href^="/s/"]').each((_, each) => {
      const $link = $(each)
      const path = $link.attr('href')
      
      // 查找最近的包含标题的元素
      let title = ''
      
      // 查找链接内部或附近的标题文本
      const $parent = $link.parent()
      const $titleDiv = $parent.find('div[style*="font-size:medium"]').first()
      
      if ($titleDiv.length > 0) {
        title = $titleDiv.text().trim()
      } else {
        // 尝试获取整个链接块内的文本
        title = $link.find('van-col').text().trim() || 
                $link.text().trim() || 
                $parent.text().trim()
      }
      
      // 清理标题（移除多余空格和换行）
      title = title.replace(/\s+/g, ' ').trim()
      
      if (title && title.length > 0) {
        // 避免重复添加
        const exists = cards.some(card => card.vod_id === path)
        if (!exists) {
          cards.push({
            vod_id: path,
            vod_name: title,
            vod_pic: '',
            vod_remarks: '',
            ext: {
              url: appConfig.site + path,
            },
          })
        }
      }
    })
  }

  return jsonify({
      list: cards,
  })
}
