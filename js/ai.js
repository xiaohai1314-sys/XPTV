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
  title: "天逸搜-测试版",
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
    // 静默失败
  }
  
  // 返回原链接
  return jsonify({ 
    list: [{
      title: '资源链接',
      tracks: [{
        name: '查看详情',
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
  let text = ext.text
  let page = ext.page || 1
  
  // 只支持第一页
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }
  
  try {
    const url = `${appConfig.site}/search?k=${encodeURIComponent(text)}`
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 30000
    })
    
    const $ = cheerio.load(data)
    
    // 查找所有搜索结果链接
    $('a[href^="/s/"]').each((index, each) => {
      const path = $(each).attr('href')
      if (!path) return
      
      // 去重
      if (cards.some(card => card.vod_id === path)) return
      
      // 提取标题 - 多种方式
      let title = ''
      
      // 方式1: template 标签
      const templateText = $(each).find('template').first().text().trim()
      if (templateText && templateText.length > 2) {
        title = templateText
      }
      
      // 方式2: 遍历 div 找标题
      if (!title) {
        $(each).find('div').each((_, div) => {
          const divText = $(div).text().trim()
          // 排除时间、格式等信息
          if (divText && 
              divText.length > 3 && 
              !divText.includes('时间:') && 
              !divText.includes('格式:') &&
              !divText.includes('大小:')) {
            title = divText
            return false // break
          }
        })
      }
      
      // 方式3: 获取第一行文本
      if (!title) {
        const allText = $(each).text().trim()
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l)
        for (let line of lines) {
          if (line && 
              line.length > 2 && 
              !line.includes('时间:') && 
              !line.includes('格式:')) {
            title = line
            break
          }
        }
      }
      
      // 方式4: 备用方案
      if (!title || title.length < 2) {
        title = `资源 ${path.split('/').pop() || index}`
      }
      
      // 清理标题
      title = title.replace(/\s+/g, ' ').trim()
      
      // 提取备注信息
      let remarks = ''
      const fullText = $(each).text()
      const timeMatch = fullText.match(/时间:\s*([^\n]+)/)
      const formatMatch = fullText.match(/格式:\s*([^\n]+)/)
      const sizeMatch = fullText.match(/大小:\s*([^\n]+)/)
      
      const remarkParts = []
      if (timeMatch) remarkParts.push(`时间: ${timeMatch[1].trim()}`)
      if (formatMatch) remarkParts.push(`格式: ${formatMatch[1].trim()}`)
      if (sizeMatch) remarkParts.push(`大小: ${sizeMatch[1].trim()}`)
      remarks = remarkParts.join(' ')
      
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
    
    // 如果没找到结果，添加一个提示
    if (cards.length === 0) {
      cards.push({
        vod_id: 'no-result',
        vod_name: `未找到"${text}"的搜索结果`,
        vod_pic: '',
        vod_remarks: '请尝试其他关键词',
        ext: {
          url: appConfig.site
        }
      })
    }
    
  } catch (e) {
    // 添加错误提示
    cards.push({
      vod_id: 'error',
      vod_name: '搜索出错',
      vod_pic: '',
      vod_remarks: e.message || '网络连接失败',
      ext: {
        url: appConfig.site
      }
    })
  }
  
  return jsonify({
    list: cards,
  })
}
