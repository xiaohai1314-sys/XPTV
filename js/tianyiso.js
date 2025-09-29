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
    name: '只有搜索',
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
  console.log('搜索URL:', url)
  
  try {
    const { data } = await $fetch.get(url, {
      headers,
      timeout: 15000
    })
    
    console.log('搜索页面HTML长度:', data.length)
    
    // 使用正则表达式直接从原始HTML中提取数据
    // 匹配模式: <van-row>...<a href="/s/xxxxx" target="_blank">...内容...</a>...</van-row>
    
    // 匹配每个搜索结果块
    const blockRegex = /<van-row>\s*<a href="(\/s\/[^"]+)"\s+target="_blank">[\s\S]*?<\/van-row>/g
    
    let blockMatch
    let count = 0
    
    while ((blockMatch = blockRegex.exec(data)) !== null) {
      count++
      const fullBlock = blockMatch[0]
      const link = blockMatch[1]
      
      console.log(`\n处理第 ${count} 个结果块, 链接: ${link}`)
      
      // 从块中提取标题 - 在 <template #title> 或 style="font-size:medium" 的 div 中
      let title = ''
      
      // 方法1: 匹配 <div style="font-size:medium;..."> 中的内容
      const titleRegex1 = /<div\s+style="[^"]*font-size:medium[^"]*"[^>]*>([\s\S]*?)<\/div>/
      const titleMatch1 = fullBlock.match(titleRegex1)
      
      if (titleMatch1) {
        // 移除HTML标签（如 <span style='color:red;'>）
        title = titleMatch1[1]
          .replace(/<[^>]+>/g, '') // 移除所有HTML标签
          .trim()
          .replace(/\s+/g, ' ') // 压缩空白字符
        
        console.log('提取到的标题:', title)
      }
      
      // 提取底部信息 - 在 <template #bottom> 中
      let remarks = ''
      
      // 匹配 <div style="padding-bottom: 20px;"> 中的内容
      const remarksRegex = /<div\s+style="padding-bottom:\s*20px;"[^>]*>([\s\S]*?)<\/div>/
      const remarksMatch = fullBlock.match(remarksRegex)
      
      if (remarksMatch) {
        remarks = remarksMatch[1]
          .replace(/<[^>]+>/g, '') // 移除HTML标签
          .replace(/&nbsp;/g, ' ') // 替换HTML实体
          .trim()
          .replace(/\s+/g, ' ')
        
        console.log('提取到的备注:', remarks)
      }
      
      if (title && link) {
        console.log('✓ 成功解析结果')
        cards.push({
          vod_id: link,
          vod_name: title,
          vod_pic: '',
          vod_remarks: remarks || '点击获取网盘链接',
          ext: {
            url: appConfig.site + link,
          },
        })
      } else {
        console.log('✗ 解析失败 - 标题或链接为空')
      }
    }
    
    console.log(`\n总共找到 ${count} 个结果块，成功解析 ${cards.length} 个`)
    
    // 检查是否被反爬
    if (data.includes('安全验证') || data.includes('验证码') || data.includes('Access Denied')) {
      console.log('检测到反爬虫机制')
      cards = [{
        vod_id: 'blocked',
        vod_name: '检测到反爬虫验证',
        vod_pic: '',
        vod_remarks: '网站要求验证，请稍后重试',
        ext: {
          url: url,
        },
      }]
    } else if (cards.length === 0) {
      // 输出HTML样本帮助调试
      console.log('\n页面HTML样本 (前2000字符):')
      console.log(data.substring(0, 2000))
      console.log('\n查找关键标记:')
      console.log('包含 van-row:', data.includes('van-row'))
      console.log('包含 /s/:', data.includes('/s/'))
      console.log('包含 van-card:', data.includes('van-card'))
      
      cards.push({
        vod_id: 'no_results',
        vod_name: '未找到搜索结果',
        vod_pic: '',
        vod_remarks: '可能是搜索词无结果或页面结构已更新',
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
