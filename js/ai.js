const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
}

// ⭐️ 配置后端 API 地址
const BACKEND_API = "http://192.168.10.105:3000"

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
    // 方式1: 尝试使用后端 API
    const { data: apiData } = await $fetch.get(`${BACKEND_API}/getTracks?url=${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (apiData && apiData.tracks && apiData.tracks.length > 0) {
      return jsonify({ 
        list: [{
          title: '在线',
          tracks: apiData.tracks
        }]
      })
    }
  } catch (e) {
    console.log('后端 API 调用失败，尝试直接抓取:', e.message)
  }
  
  // 方式2: 如果后端 API 失败，回退到直接抓取
  try {
    const { data } = await $fetch.get(url, {
      headers
    })
    
    // 尝试提取天翼云盘链接
    const panMatch = data.match(/"(https:\/\/cloud\.189\.cn\/t\/[^"]+)"/)
    if (panMatch) {
      return jsonify({ 
        list: [{
          title: '在线',
          tracks: [{
            name: '天翼网盘',
            pan: panMatch[1],
          }]
        }]
      })
    }
    
    // 尝试提取磁力链接
    const magnetMatch = data.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/g)
    if (magnetMatch) {
      const tracks = magnetMatch.map((magnet, index) => ({
        name: `磁力链接 ${index + 1}`,
        pan: magnet,
      }))
      return jsonify({ 
        list: [{
          title: '磁力链接',
          tracks
        }]
      })
    }
  } catch (e) {
    console.log('直接抓取失败:', e.message)
  }
  
  // 如果都失败，返回空
  return jsonify({ 
    list: [{
      title: '未找到',
      tracks: [{
        name: '暂无可用链接',
        pan: url,
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
  
  // 只支持第一页
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }
  
  try {
    // ⭐️ 优先使用后端 Puppeteer API（更稳定）
    const { data: apiData } = await $fetch.get(`${BACKEND_API}/search?k=${text}`, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (apiData && apiData.list && apiData.list.length > 0) {
      console.log(`使用后端 API 成功获取 ${apiData.list.length} 个结果`)
      return jsonify({
        list: apiData.list
      })
    }
  } catch (e) {
    console.log('后端 API 调用失败，尝试直接抓取:', e.message)
  }
  
  // ⭐️ 回退方案：直接使用 cheerio 抓取（可能被反爬）
  try {
    const url = appConfig.site + `/search?k=${text}`
    const { data } = await $fetch.get(url, {
      headers
    })
    
    const $ = cheerio.load(data)
    
    // 方式1: 查找所有 /s/ 开头的链接
    $('a[href^="/s/"]').each((_, each) => {
      const path = $(each).attr('href')
      if (!path) return
      
      // 去重
      if (cards.some(card => card.vod_id === path)) return
      
      // 尝试多种方式提取标题
      let title = ''
      
      // 尝试1: 查找 template 标签
      const templateText = $(each).find('template').first().text().trim()
      if (templateText) {
        title = templateText
      }
      
      // 尝试2: 查找第一个有意义的文本节点
      if (!title) {
        $(each).find('div').each((_, div) => {
          const text = $(div).text().trim()
          if (text && text.length > 3 && !text.includes('时间:') && !text.includes('格式:')) {
            title = text
            return false // break
          }
        })
      }
      
      // 尝试3: 使用链接的完整文本（第一行）
      if (!title) {
        const fullText = $(each).text().trim()
        const lines = fullText.split('\n')
        title = lines[0] || `资源 ${path.replace('/s/', '').substring(0, 8)}`
      }
      
      // 提取备注信息
      let remarks = ''
      const fullText = $(each).text()
      const remarksMatch = fullText.match(/(时间:.*)/s)
      if (remarksMatch) {
        remarks = remarksMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
      }
      
      cards.push({
        vod_id: path,
        vod_name: title,
        vod_pic: '',
        vod_remarks: remarks,
        ext: {
          url: appConfig.site + path,
        },
      })
    })
    
    console.log(`直接抓取获取 ${cards.length} 个结果`)
  } catch (e) {
    console.log('直接抓取失败:', e.message)
  }
  
  return jsonify({
    list: cards,
  })
}
