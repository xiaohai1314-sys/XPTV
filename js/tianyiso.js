const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

// 更新User-Agent和请求头
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
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
    
    console.log('详情页URL:', url)
    console.log('详情页HTML长度:', data.length)
    
    // 多种方式提取网盘链接
    let pan = null
    
    // 方式1: 天翼云盘链接
    const tianyi1 = data.match(/"(https:\/\/cloud\.189\.cn\/t\/[^"]*)"/)
    if (tianyi1) {
      pan = tianyi1[1]
    }
    
    // 方式2: 天翼云盘链接（不带引号）
    if (!pan) {
      const tianyi2 = data.match(/https:\/\/cloud\.189\.cn\/t\/[A-Za-z0-9]+/)
      if (tianyi2) {
        pan = tianyi2[0]
      }
    }
    
    // 方式3: 百度网盘链接
    if (!pan) {
      const baidu = data.match(/"(https:\/\/pan\.baidu\.com\/s\/[^"]*)"/)
      if (baidu) {
        pan = baidu[1]
      }
    }
    
    // 方式4: 阿里云盘链接
    if (!pan) {
      const aliyun = data.match(/"(https:\/\/www\.aliyundrive\.com\/s\/[^"]*)"/)
      if (aliyun) {
        pan = aliyun[1]
      }
    }
    
    // 方式5: 夸克网盘链接
    if (!pan) {
      const quark = data.match(/"(https:\/\/pan\.quark\.cn\/s\/[^"]*)"/)
      if (quark) {
        pan = quark[1]
      }
    }
    
    console.log('找到的网盘链接:', pan)
    
    if (!pan) {
      console.log('未找到网盘链接，页面前1000字符:', data.substring(0, 1000))
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
    console.log('HTML前500字符:', data.substring(0, 500))
    
    const $ = cheerio.load(data)
    
    // 方式1: 根据实际HTML结构解析 - 查找所有包含 /s/ 链接的 a 标签
    $('a[href^="/s/"]').each((_, element) => {
      const $link = $(element)
      const href = $link.attr('href')
      
      // 查找标题 - 在 van-card 的 title template 中
      let title = ''
      
      // 尝试从多个位置获取标题
      const titleDiv = $link.find('template').first().next('div')
      if (titleDiv.length > 0) {
        title = titleDiv.text().trim()
      }
      
      if (!title) {
        const titleSpan = $link.find('div[style*="font-size:medium"]')
        if (titleSpan.length > 0) {
          title = titleSpan.text().trim()
        }
      }
      
      if (!title) {
        // 最后尝试获取所有文本内容
        title = $link.text().trim().split('时间:')[0].trim()
      }
      
      // 清理标题
      title = title.replace(/\s+/g, ' ').trim()
      
      if (title && href) {
        console.log('找到结果:', { title, href })
        cards.push({
          vod_id: href,
          vod_name: title,
          vod_pic: '',
          vod_remarks: '',
          ext: {
            url: appConfig.site + href,
          },
        })
      }
    })
    
    // 方式2: 如果上面没有找到结果，使用更通用的方法
    if (cards.length === 0) {
      console.log('方式1未找到结果，尝试方式2')
      
      // 查找所有van-row中的链接
      $('van-row a, .van-row a').each((_, element) => {
        const $link = $(element)
        const href = $link.attr('href')
        
        if (href && href.startsWith('/s/')) {
          let title = $link.find('div').text().trim()
          
          if (!title) {
            title = $link.text().trim()
          }
          
          title = title.replace(/时间:.*$/g, '').trim()
          title = title.replace(/\s+/g, ' ')
          
          if (title) {
            console.log('方式2找到结果:', { title, href })
            cards.push({
              vod_id: href,
              vod_name: title,
              vod_pic: '',
              vod_remarks: '',
              ext: {
                url: appConfig.site + href,
              },
            })
          }
        }
      })
    }
    
    // 方式3: 直接从HTML中用正则表达式提取
    if (cards.length === 0) {
      console.log('方式2未找到结果，尝试方式3')
      
      const linkMatches = data.match(/href="(\/s\/[^"]+)"/g)
      if (linkMatches) {
        for (let match of linkMatches) {
          const href = match.replace('href="', '').replace('"', '')
          
          // 查找这个链接周围的标题
          const linkIndex = data.indexOf(match)
          const surroundingText = data.substring(linkIndex, linkIndex + 500)
          
          // 提取标题的正则表达式
          const titleMatch = surroundingText.match(/<span[^>]*style='color:red;'>[^<]*<\/span>([^<]*)|<div[^>]*>([^<]+)<\/div>/)
          if (titleMatch) {
            let title = (titleMatch[1] || titleMatch[2] || '').trim()
            if (title) {
              console.log('方式3找到结果:', { title, href })
              cards.push({
                vod_id: href,
                vod_name: title,
                vod_pic: '',
                vod_remarks: '',
                ext: {
                  url: appConfig.site + href,
                },
              })
            }
          }
        }
      }
    }
    
    console.log('最终解析到的结果数量:', cards.length)
    if (cards.length > 0) {
      console.log('第一个结果:', cards[0])
    } else {
      console.log('没有找到任何结果，可能页面结构已改变或者搜索无结果')
      
      // 添加一个调试信息
      cards.push({
        vod_id: 'debug',
        vod_name: '调试信息: 页面已加载但未解析到结果',
        vod_pic: '',
        vod_remarks: `页面长度: ${data.length}, URL: ${url}`,
        ext: {
          url: url,
        },
      })
    }
    
  } catch (error) {
    console.log('搜索请求错误:', error)
    
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
