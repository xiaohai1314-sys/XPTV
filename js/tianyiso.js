const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

// 更新User-Agent到最新版本
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
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
  
  try {
    const { data } = await $fetch.get(url, {
      headers
    })
    
    // 多种匹配方式尝试获取网盘链接
    let pan = null
    
    // 方式1: 原有的天翼云匹配
    const match1 = data.match(/"(https:\/\/cloud\.189\.cn\/t\/[^"]*)"/)
    if (match1) {
      pan = match1[1]
    }
    
    // 方式2: 其他可能的网盘链接格式
    if (!pan) {
      const match2 = data.match(/https:\/\/cloud\.189\.cn\/t\/\w+/g)
      if (match2 && match2.length > 0) {
        pan = match2[0]
      }
    }
    
    // 方式3: 百度网盘链接
    if (!pan) {
      const match3 = data.match(/"(https:\/\/pan\.baidu\.com\/s\/[^"]*)"/)
      if (match3) {
        pan = match3[1]
      }
    }
    
    // 方式4: 阿里云盘链接
    if (!pan) {
      const match4 = data.match(/"(https:\/\/www\.aliyundrive\.com\/s\/[^"]*)"/)
      if (match4) {
        pan = match4[1]
      }
    }
    
    if (!pan) {
      console.log('未找到网盘链接，页面内容:', data.substring(0, 500))
      return jsonify({ 
        list: [{
          title: '错误',
          tracks: [{
            name: '未找到网盘链接',
            pan: url,
          }]
        }]
      })
    }
    
    return jsonify({ 
      list: [{
        title: '在线',
        tracks: [{
          name: '网盘',
          pan,
        }]
      }]
    })
    
  } catch (error) {
    console.log('获取详情页错误:', error)
    return jsonify({ 
      list: [{
        title: '错误',
        tracks: [{
          name: '请求失败',
          pan: url,
        }]
      }]
    })
  }
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
  console.log('搜索URL:', url)
  
  try {
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 10000
    })
    
    console.log('获取到的HTML长度:', data.length)
    console.log('HTML前500字符:', data.substring(0, 500))
    
    const $ = cheerio.load(data)
    
    // 方式1: 原有的解析方式
    $('a').each((_, each) => {
      const path = $(each).attr('href') ?? ''
      if (path.startsWith('/s/')) {
        const name = $(each).find('template').first().text().trim() || 
                     $(each).text().trim() || 
                     $(each).find('.title').text().trim()
        
        if (name) {
          cards.push({
            vod_id: path,
            vod_name: name,
            vod_pic: '',
            vod_remarks: '',
            ext: {
              url: appConfig.site + path,
            },
          })
        }
      }
    })
    
    // 方式2: 尝试其他可能的结构
    if (cards.length === 0) {
      $('.result-item, .search-item, .item').each((_, each) => {
        const link = $(each).find('a').first()
        const path = link.attr('href') ?? ''
        
        if (path.startsWith('/s/') || path.includes('/s/')) {
          const name = link.text().trim() || 
                       $(each).find('.title, .name').text().trim() ||
                       $(each).text().trim()
          
          if (name) {
            cards.push({
              vod_id: path,
              vod_name: name,
              vod_pic: '',
              vod_remarks: '',
              ext: {
                url: path.startsWith('http') ? path : appConfig.site + path,
              },
            })
          }
        }
      })
    }
    
    // 方式3: 通用链接解析
    if (cards.length === 0) {
      $('a[href*="/s/"]').each((_, each) => {
        const path = $(each).attr('href') ?? ''
        const name = $(each).text().trim() || 
                     $(each).find('*').text().trim()
        
        if (name && name.length > 0) {
          cards.push({
            vod_id: path,
            vod_name: name,
            vod_pic: '',
            vod_remarks: '',
            ext: {
              url: path.startsWith('http') ? path : appConfig.site + path,
            },
          })
        }
      })
    }
    
    console.log('解析到的结果数量:', cards.length)
    if (cards.length > 0) {
      console.log('第一个结果:', cards[0])
    }
    
  } catch (error) {
    console.log('搜索请求错误:', error)
    
    // 如果请求失败，可能需要处理验证码或其他反爬机制
    cards.push({
      vod_id: 'error',
      vod_name: `搜索失败: ${error.message || '未知错误'}`,
      vod_pic: '',
      vod_remarks: '请检查网络连接或网站状态',
      ext: {
        url: url,
      },
    })
  }
  
  return jsonify({
    list: cards,
  })
}
