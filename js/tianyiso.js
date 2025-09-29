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
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
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
    const { data } = await $fetch.get(url, {
      headers
    })
    
    console.log('详情页URL:', url)
    
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
    
    console.log('找到的网盘链接:', pan)
    
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
    console.log('获取详情页错误:', error)
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
  console.log('====================================')
  console.log('搜索URL:', url)
  console.log('====================================')
  
  try {
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 15000
    })
    
    console.log('页面HTML总长度:', data.length)
    
    // 详细调试：输出完整HTML的关键部分
    console.log('\n=== HTML 样本分析 ===')
    console.log('前3000字符:')
    console.log(data.substring(0, 3000))
    console.log('\n... 中间省略 ...\n')
    
    // 查找第一个 /s/ 链接所在的位置
    const firstLinkIndex = data.indexOf('href="/s/')
    if (firstLinkIndex !== -1) {
      console.log('\n=== 找到第一个 /s/ 链接的位置 ===')
      console.log('位置:', firstLinkIndex)
      console.log('前后500字符:')
      console.log(data.substring(Math.max(0, firstLinkIndex - 250), firstLinkIndex + 250))
    } else {
      console.log('\n!!! 警告: 页面中完全没有找到 href="/s/ 的链接 !!!')
    }
    
    // 尝试多种正则匹配策略
    console.log('\n=== 尝试多种匹配策略 ===')
    
    // 策略1: 最宽松的匹配 - 只要有 /s/ 链接
    const links = data.match(/href="(\/s\/[A-Za-z0-9]+)"/g)
    console.log('策略1 - 找到的所有 /s/ 链接数量:', links ? links.length : 0)
    if (links) {
      console.log('前3个链接:', links.slice(0, 3))
    }
    
    // 策略2: 匹配 <a href="/s/..." 标签
    const aTagRegex = /<a\s+href="(\/s\/[A-Za-z0-9]+)"[^>]*>/g
    let aTagMatches = []
    let match
    while ((match = aTagRegex.exec(data)) !== null) {
      aTagMatches.push(match[1])
    }
    console.log('策略2 - 匹配到的 <a> 标签数量:', aTagMatches.length)
    
    // 策略3: 使用 Cheerio 尝试解析
    const $ = cheerio.load(data)
    const cheerioLinks = $('a[href^="/s/"]')
    console.log('策略3 - Cheerio 找到的链接数量:', cheerioLinks.length)
    
    // 如果找到链接，使用最宽松的策略提取所有信息
    if (aTagMatches.length > 0) {
      console.log('\n=== 开始提取数据（使用 <a> 标签匹配）===')
      
      for (let i = 0; i < aTagMatches.length; i++) {
        const link = aTagMatches[i]
        console.log(`\n处理第 ${i + 1} 个链接: ${link}`)
        
        // 找到这个链接在HTML中的位置
        const linkPattern = new RegExp(`<a\\s+href="${link.replace(/\//g, '\\/')}"[^>]*>([\\s\\S]{0,2000}?)<\\/a>`, 'i')
        const linkBlock = data.match(linkPattern)
        
        if (!linkBlock) {
          console.log('  未能提取到此链接的完整块')
          continue
        }
        
        const block = linkBlock[0]
        
        // 提取标题 - 尝试多种模式
        let title = ''
        
        // 模式1: <div style="font-size:medium
        const titleMatch1 = block.match(/<div\s+style="[^"]*font-size:medium[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        if (titleMatch1) {
          title = titleMatch1[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ')
          console.log('  标题(模式1):', title)
        }
        
        // 模式2: 如果模式1失败，尝试获取 van-card 内的第一个有意义的文本
        if (!title) {
          const textMatch = block.match(/>([^<]{10,})</i)
          if (textMatch) {
            title = textMatch[1].trim().replace(/\s+/g, ' ')
            console.log('  标题(模式2-通用文本):', title)
          }
        }
        
        // 提取备注信息
        let remarks = ''
        const remarksMatch = block.match(/<div\s+style="padding-bottom[^>]*>([\s\S]*?)<\/div>/i)
        if (remarksMatch) {
          remarks = remarksMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim()
            .replace(/\s+/g, ' ')
          console.log('  备注:', remarks)
        }
        
        if (title || link) {
          cards.push({
            vod_id: link,
            vod_name: title || '未知标题',
            vod_pic: '',
            vod_remarks: remarks || '点击获取网盘链接',
            ext: {
              url: appConfig.site + link,
            },
          })
          console.log('  ✓ 成功添加')
        }
      }
    }
    
    console.log('\n=== 最终结果 ===')
    console.log('成功解析的结果数:', cards.length)
    
    // 如果还是没有结果，提供详细的诊断信息
    if (cards.length === 0) {
      console.log('\n!!! 诊断信息 !!!')
      console.log('响应状态码可能的问题:')
      console.log('1. 检查是否有反爬虫验证:', data.includes('验证') || data.includes('captcha'))
      console.log('2. 检查是否是错误页面:', data.includes('404') || data.includes('error'))
      console.log('3. 页面是否包含 Vue:', data.includes('vue.min.js'))
      console.log('4. 页面是否包含 van-card:', data.includes('van-card'))
      console.log('5. 页面是否包含搜索关键词:', data.includes('黄飞鸿'))
      
      // 输出整个HTML供分析（如果不太大）
      if (data.length < 50000) {
        console.log('\n=== 完整HTML内容 ===')
        console.log(data)
      }
      
      cards.push({
        vod_id: 'debug',
        vod_name: '调试模式：未找到结果',
        vod_pic: '',
        vod_remarks: '请查看console日志了解详情',
        ext: {
          url: url,
        },
      })
    }
    
  } catch (error) {
    console.log('搜索请求错误:', error)
    console.log('错误堆栈:', error.stack)
    
    cards.push({
      vod_id: 'error',
      vod_name: `搜索失败: ${error.message || '网络错误'}`,
      vod_pic: '',
      vod_remarks: '请检查网络连接',
      ext: {
        url: url,
      },
    })
  }
  
  return jsonify({
    list: cards,
  })
}
