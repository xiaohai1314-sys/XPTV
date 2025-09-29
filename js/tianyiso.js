const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"

// 使用移动端User-Agent，因为网站可能对移动端更友好
const headers = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.tianyiso.com/',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Cache-Control': 'max-age=0',
}

const appConfig = {
  ver: 1,
  title: "天逸搜",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: '搜索功能',
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
    // 添加延迟，模拟人类操作
    await new Promise(resolve => setTimeout(resolve, 500))
    
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
    // 添加随机延迟，避免被识别为机器人
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
    
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 20000,
      // 尝试添加重定向跟踪
      redirect: 'follow',
    })
    
    // 调试信息
    const hasVanRow = data.includes('van-row')
    const hasVanCard = data.includes('van-card')
    const hasSLink = data.includes('/s/')
    const hasVue = data.includes('vue.min.js')
    const hasCaptcha = data.includes('验证') || data.includes('captcha') || data.includes('安全验证') || data.includes('Access Denied')
    const hasCloudflare = data.includes('cloudflare') || data.includes('cf-browser-verification')
    
    cards.push({
      vod_id: 'debug_1',
      vod_name: `HTML长度: ${data.length}字符`,
      vod_pic: '',
      vod_remarks: `van-row:${hasVanRow} van-card:${hasVanCard} /s/:${hasSLink}`,
      ext: { url: url },
    })
    
    cards.push({
      vod_id: 'debug_2',
      vod_name: `检测结果`,
      vod_pic: '',
      vod_remarks: `Vue:${hasVue} 验证码:${hasCaptcha} CF:${hasCloudflare}`,
      ext: { url: url },
    })
    
    // 如果检测到反爬虫
    if (hasCaptcha || hasCloudflare) {
      cards.push({
        vod_id: 'blocked',
        vod_name: '⚠️ 检测到反爬虫保护',
        vod_pic: '',
        vod_remarks: '网站启用了验证机制，脚本无法绕过。建议直接访问网页版搜索',
        ext: { url: url },
      })
      
      // 提供直接访问的选项
      cards.push({
        vod_id: 'direct',
        vod_name: '💡 解决方案：直接访问网站',
        vod_pic: '',
        vod_remarks: '点击打开浏览器访问搜索页面',
        ext: { url: url },
      })
      
      return jsonify({ list: cards })
    }
    
    // 显示HTML片段
    cards.push({
      vod_id: 'debug_3',
      vod_name: 'HTML开头200字符',
      vod_pic: '',
      vod_remarks: data.substring(0, 200).replace(/\s+/g, ' '),
      ext: { url: url },
    })
    
    // 如果页面中有Vue但没有van-row，说明是JS渲染页面
    if (hasVue && !hasVanRow) {
      cards.push({
        vod_id: 'js_render',
        vod_name: '⚠️ 检测到JavaScript渲染页面',
        vod_pic: '',
        vod_remarks: '此网站使用Vue.js动态渲染内容，普通脚本无法解析。需要使用真实浏览器访问',
        ext: { url: url },
      })
      
      cards.push({
        vod_id: 'solution',
        vod_name: '💡 建议使用网页版',
        vod_pic: '',
        vod_remarks: '点击访问搜索页面，在浏览器中查看结果',
        ext: { url: url },
      })
      
      return jsonify({ list: cards })
    }
    
    // 尝试查找链接
    const linkMatches = data.match(/href="(\/s\/[A-Za-z0-9]+)"/g)
    const linkCount = linkMatches ? linkMatches.length : 0
    
    cards.push({
      vod_id: 'debug_4',
      vod_name: `找到 ${linkCount} 个链接`,
      vod_pic: '',
      vod_remarks: linkMatches ? linkMatches.slice(0, 3).join(', ') : '无',
      ext: { url: url },
    })
    
    // 如果找到链接，解析结果
    if (linkMatches && linkMatches.length > 0) {
      const links = linkMatches.map(m => m.match(/href="(\/s\/[A-Za-z0-9]+)"/)[1])
      
      // 去重
      const uniqueLinks = [...new Set(links)]
      
      for (let i = 0; i < Math.min(uniqueLinks.length, 20); i++) {
        const link = uniqueLinks[i]
        
        const linkPos = data.indexOf(`href="${link}"`)
        if (linkPos === -1) continue
        
        const blockStart = Math.max(0, linkPos - 1000)
        const blockEnd = Math.min(data.length, linkPos + 2000)
        const block = data.substring(blockStart, blockEnd)
        
        let title = '未知标题'
        
        const titleMatch1 = block.match(/<div\s+style="[^"]*font-size:medium[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        if (titleMatch1) {
          title = titleMatch1[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ')
        } else {
          const afterLink = data.substring(linkPos, linkPos + 500)
          const textMatch = afterLink.match(/>([^<]{15,200})</i)
          if (textMatch) {
            title = textMatch[1].trim().replace(/\s+/g, ' ')
          }
        }
        
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
      
      // 如果成功解析，移除调试信息
      if (cards.length > 4) {
        cards = cards.filter(c => !c.vod_id.startsWith('debug'))
      }
    } else {
      cards.push({
        vod_id: 'no_links',
        vod_name: '❌ 页面中未找到任何搜索结果',
        vod_pic: '',
        vod_remarks: '可能原因：1.反爬虫拦截 2.JS渲染 3.网络问题',
        ext: { url: url },
      })
    }
    
  } catch (error) {
    cards.push({
      vod_id: 'error',
      vod_name: `❌ 请求错误: ${error.message}`,
      vod_pic: '',
      vod_remarks: '网络连接失败或超时',
      ext: { url: url },
    })
  }
  
  return jsonify({
    list: cards,
  })
}
