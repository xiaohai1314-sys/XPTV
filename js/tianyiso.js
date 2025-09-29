const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
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
    
    let pan = null
    
    const patterns = [
      /"(https:\/\/cloud\.189\.cn\/t\/[^"]+)"/,
      /https:\/\/cloud\.189\.cn\/t\/[A-Za-z0-9]+/,
      /"(https:\/\/pan\.baidu\.com\/s\/[^"]+)"/,
      /"(https:\/\/www\.aliyundrive\.com\/s\/[^"]+)"/,
      /"(https:\/\/pan\.quark\.cn\/s\/[^"]+)"/,
      /https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9]+/,
      /https:\/\/www\.aliyundrive\.com\/s\/[A-Za-z0-9]+/,
      /https:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9]+/,
    ]
    
    for (let pattern of patterns) {
      const match = data.match(pattern)
      if (match) {
        pan = match[1] || match[0]
        break
      }
    }
    
    if (!pan) {
      return jsonify({ 
        list: [{
          title: '需要手动访问',
          tracks: [{
            name: '点击打开网页',
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
    return jsonify({ 
      list: [{
        title: '错误',
        tracks: [{
          name: '请求失败: ' + error.message,
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
  
  try {
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 15000
    })
    
    // 显示调试信息
    cards.push({
      vod_id: 'debug_1',
      vod_name: '🔍 调试信息1: 页面基本信息',
      vod_pic: '',
      vod_remarks: `HTML长度: ${data.length} 字符`,
      ext: { url: url },
    })
    
    // 检查关键内容
    const hasVanRow = data.includes('van-row')
    const hasVanCard = data.includes('van-card')
    const hasSLink = data.includes('/s/')
    const hasVue = data.includes('vue.min.js')
    const hasCaptcha = data.includes('验证') || data.includes('captcha') || data.includes('安全验证')
    
    cards.push({
      vod_id: 'debug_2',
      vod_name: '🔍 调试信息2: 页面内容检测',
      vod_pic: '',
      vod_remarks: `van-row:${hasVanRow} van-card:${hasVanCard} /s/链接:${hasSLink} Vue:${hasVue} 验证码:${hasCaptcha}`,
      ext: { url: url },
    })
    
    // 显示HTML前500字符
    cards.push({
      vod_id: 'debug_3',
      vod_name: '🔍 调试信息3: HTML开头',
      vod_pic: '',
      vod_remarks: data.substring(0, 200).replace(/\s+/g, ' '),
      ext: { url: url },
    })
    
    // 查找第一个 /s/ 链接
    const firstLinkIndex = data.indexOf('href="/s/')
    if (firstLinkIndex !== -1) {
      const snippet = data.substring(firstLinkIndex - 50, firstLinkIndex + 150)
      cards.push({
        vod_id: 'debug_4',
        vod_name: '🔍 调试信息4: 找到链接位置',
        vod_pic: '',
        vod_remarks: `位置:${firstLinkIndex} 内容:${snippet.substring(0, 150)}`,
        ext: { url: url },
      })
    } else {
      cards.push({
        vod_id: 'debug_4',
        vod_name: '❌ 调试信息4: 未找到任何/s/链接',
        vod_pic: '',
        vod_remarks: '页面中完全没有搜索结果链接',
        ext: { url: url },
      })
    }
    
    // 尝试匹配所有 /s/ 链接
    const linkMatches = data.match(/href="(\/s\/[A-Za-z0-9]+)"/g)
    const linkCount = linkMatches ? linkMatches.length : 0
    
    cards.push({
      vod_id: 'debug_5',
      vod_name: '🔍 调试信息5: 链接匹配结果',
      vod_pic: '',
      vod_remarks: `找到 ${linkCount} 个链接` + (linkMatches ? `: ${linkMatches.slice(0, 3).join(', ')}` : ''),
      ext: { url: url },
    })
    
    // 如果找到链接，开始真正的解析
    if (linkMatches && linkMatches.length > 0) {
      // 提取链接
      const links = linkMatches.map(m => m.match(/href="(\/s\/[A-Za-z0-9]+)"/)[1])
      
      cards.push({
        vod_id: 'debug_6',
        vod_name: '✅ 开始解析结果',
        vod_pic: '',
        vod_remarks: `准备解析 ${links.length} 个结果`,
        ext: { url: url },
      })
      
      // 解析每个结果
      for (let i = 0; i < Math.min(links.length, 20); i++) {
        const link = links[i]
        
        // 找到这个链接周围的HTML块（往前1000字符，往后2000字符）
        const linkPos = data.indexOf(`href="${link}"`)
        if (linkPos === -1) continue
        
        const blockStart = Math.max(0, linkPos - 1000)
        const blockEnd = Math.min(data.length, linkPos + 2000)
        const block = data.substring(blockStart, blockEnd)
        
        // 提取标题
        let title = '未知标题'
        
        // 方法1: font-size:medium
        const titleMatch1 = block.match(/<div\s+style="[^"]*font-size:medium[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        if (titleMatch1) {
          title = titleMatch1[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ')
        } else {
          // 方法2: 查找链接后面的第一段有意义的文本
          const afterLink = data.substring(linkPos, linkPos + 500)
          const textMatch = afterLink.match(/>([^<]{15,200})</i)
          if (textMatch) {
            title = textMatch[1].trim().replace(/\s+/g, ' ')
          }
        }
        
        // 提取备注
        let remarks = ''
        const remarksMatch = block.match(/时间:\s*([^&<]+)/i)
        if (remarksMatch) {
          remarks = remarksMatch[0].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim()
        }
        
        cards.push({
          vod_id: link,
          vod_name: title,
          vod_pic: '',
          vod_remarks: remarks || '点击获取网盘链接',
          ext: {
            url: appConfig.site + link,
          },
        })
      }
    }
    
    // 如果没有找到任何真实结果（除了调试信息）
    if (cards.length <= 6) {
      cards.push({
        vod_id: 'debug_final',
        vod_name: '⚠️ 最终状态: 未能解析出有效结果',
        vod_pic: '',
        vod_remarks: '请查看上面的调试信息判断问题原因',
        ext: { url: url },
      })
    } else {
      // 有结果了，移除前面的调试信息
      cards = cards.filter(c => !c.vod_id.startsWith('debug'))
    }
    
  } catch (error) {
    cards.push({
      vod_id: 'error',
      vod_name: `❌ 网络错误: ${error.message}`,
      vod_pic: '',
      vod_remarks: error.stack || '无详细信息',
      ext: { url: url },
    })
  }
  
  return jsonify({
    list: cards,
  })
}
