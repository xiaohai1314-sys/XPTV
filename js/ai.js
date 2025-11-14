const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
}

// ⭐️ 配置后端 API 地址
// 本地: "http://localhost:3000" 或 "http://127.0.0.1:3000"
// 远程: 填写你的服务器地址
const BACKEND_API = "http://192.168.10.105:3000"

const appConfig = {
  ver: 1,
  title: "天翼搜",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: '搜索',
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
  
  // 方式1: 尝试后端 API（如果实现了）
  if (BACKEND_API) {
    try {
      const response = await $fetch.get(`${BACKEND_API}/getTracks?url=${encodeURIComponent(url)}`, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 30000
      })
      
      const apiData = response.data || response
      
      if (apiData && apiData.tracks && apiData.tracks.length > 0) {
        return jsonify({ 
          list: [{
            title: '在线',
            tracks: apiData.tracks
          }]
        })
      }
    } catch (e) {
      // 继续尝试方式2
    }
  }
  
  // 方式2: 直接抓取详情页
  try {
    const { data } = await $fetch.get(url, {
      headers
    })
    
    // 尝试提取天翼云盘链接
    const panMatch = data.match(/"(https:\/\/cloud\.189\.cn\/t\/[^"]+)"/)
    if (panMatch) {
      return jsonify({ 
        list: [{
          title: '天翼网盘',
          tracks: [{
            name: '点击打开',
            pan: panMatch[1],
          }]
        }]
      })
    }
    
    // 尝试提取磁力链接
    const magnetMatches = data.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+/g)
    if (magnetMatches) {
      const tracks = magnetMatches.map((magnet, index) => ({
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
    // 静默失败
  }
  
  // 返回原链接
  return jsonify({ 
    list: [{
      title: '打开链接',
      tracks: [{
        name: '在浏览器中查看',
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
  let cards = []
  const text = ext.text
  const page = ext.page || 1
  
  // 只支持第一页
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }
  
  // 使用后端 Puppeteer API
  if (BACKEND_API) {
    try {
      const apiUrl = `${BACKEND_API}/search?k=${encodeURIComponent(text)}`
      
      // 发起请求
      const response = await $fetch.get(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60秒超时
      })
      
      // 处理响应
      let resultData = null
      
      // 情况1: response 本身就是数据对象
      if (response && response.list) {
        resultData = response
      }
      // 情况2: response.data 包含数据
      else if (response && response.data) {
        if (response.data.list) {
          resultData = response.data
        } else {
          resultData = { list: response.data }
        }
      }
      
      // 验证并处理数据
      if (resultData && resultData.list && Array.isArray(resultData.list)) {
        // 确保每个项目的格式正确
        cards = resultData.list.map(item => {
          // 确保所有必需字段都存在
          const card = {
            vod_id: String(item.vod_id || ''),
            vod_name: String(item.vod_name || '未知'),
            vod_pic: String(item.vod_pic || ''),
            vod_remarks: String(item.vod_remarks || ''),
            ext: {}
          }
          
          // 处理 ext.url
          if (item.ext && item.ext.url) {
            card.ext.url = item.ext.url
          } else if (item.vod_id) {
            card.ext.url = appConfig.site + item.vod_id
          }
          
          return card
        })
        
        // 如果成功获取数据，直接返回
        if (cards.length > 0) {
          return jsonify({
            list: cards
          })
        }
      }
    } catch (e) {
      // 后端API失败，尝试备用方案
    }
  }
  
  // 备用方案：直接抓取（可能失败）
  try {
    const url = `${appConfig.site}/search?k=${encodeURIComponent(text)}`
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 30000
    })
    
    const $ = cheerio.load(data)
    const links = $('a[href^="/s/"]')
    
    links.each((_, element) => {
      const path = $(element).attr('href')
      if (!path || cards.some(c => c.vod_id === path)) return
      
      // 提取标题
      let title = $(element).find('template').first().text().trim()
      if (!title || title.length < 2) {
        const allText = $(element).text().trim()
        const lines = allText.split('\n').filter(l => l.trim())
        title = lines[0] || `资源 ${path.split('/').pop()}`
      }
      
      // 提取备注
      const fullText = $(element).text()
      const remarkParts = []
      const timeMatch = fullText.match(/时间:\s*([^\n]+)/)
      const formatMatch = fullText.match(/格式:\s*([^\n]+)/)
      const sizeMatch = fullText.match(/大小:\s*([^\n]+)/)
      if (timeMatch) remarkParts.push(`时间: ${timeMatch[1].trim()}`)
      if (formatMatch) remarkParts.push(`格式: ${formatMatch[1].trim()}`)
      if (sizeMatch) remarkParts.push(`大小: ${sizeMatch[1].trim()}`)
      
      cards.push({
        vod_id: path,
        vod_name: title,
        vod_pic: '',
        vod_remarks: remarkParts.join(' '),
        ext: {
          url: appConfig.site + path
        }
      })
    })
  } catch (e) {
    // 静默失败
  }
  
  // 返回结果
  return jsonify({
    list: cards
  })
}
