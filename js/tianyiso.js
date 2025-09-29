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
  'Sec-Ch-Ua': '"Chromium";v="140", "Google Chrome";v="140", "Not A(Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
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
    console.log('HTML前1000字符:', data.substring(0, 1000))
    
    const $ = cheerio.load(data);

    // 方案1: 更精确的选择器 - 选择 van-row 内的直接 a 标签
    let resultItems = $('van-row > a[href^="/s/"]');
    console.log(`方案1找到 ${resultItems.length} 个结果`);

    // 方案2: 如果方案1失败，尝试更宽松的选择器
    if (resultItems.length === 0) {
      resultItems = $('a[href^="/s/"][target="_blank"]');
      console.log(`方案2找到 ${resultItems.length} 个结果`);
    }

    // 方案3: 如果还是失败，尝试查找所有包含 /s/ 的链接
    if (resultItems.length === 0) {
      resultItems = $('a[href*="/s/"]').filter(function() {
        const href = $(this).attr('href');
        return href && href.match(/^\/s\/[A-Za-z0-9]+$/);
      });
      console.log(`方案3找到 ${resultItems.length} 个结果`);
    }

    if (resultItems.length > 0) {
      resultItems.each((index, element) => {
        try {
          const item = $(element);
          const link = item.attr('href');
          
          if (!link) return;

          // 多种方式尝试提取标题
          let title = '';
          
          // 方法1: 通过 style 属性查找
          const titleDiv1 = item.find('div[style*="font-size:medium"]');
          if (titleDiv1.length > 0) {
            title = titleDiv1.text().trim();
          }
          
          // 方法2: 通过 template #title 查找
          if (!title) {
            const titleDiv2 = item.find('[slot="title"] div, template[slot="title"] div');
            if (titleDiv2.length > 0) {
              title = titleDiv2.text().trim();
            }
          }
          
          // 方法3: 查找 van-card 内的第一个 div
          if (!title) {
            const titleDiv3 = item.find('van-card div').first();
            if (titleDiv3.length > 0) {
              title = titleDiv3.text().trim();
            }
          }
          
          title = title.replace(/\s+/g, ' ');

          // 提取底部信息
          let remarks = '';
          const bottomDiv1 = item.find('div[style*="padding-bottom"]');
          if (bottomDiv1.length > 0) {
            remarks = bottomDiv1.text().trim();
          } else {
            const bottomDiv2 = item.find('[slot="bottom"] div, template[slot="bottom"] div');
            if (bottomDiv2.length > 0) {
              remarks = bottomDiv2.text().trim();
            }
          }
          remarks = remarks.replace(/\s+/g, ' ');

          if (title && link) {
            console.log(`成功解析结果 ${index + 1}:`, { title, link, remarks });
            cards.push({
              vod_id: link,
              vod_name: title,
              vod_pic: '',
              vod_remarks: remarks || '点击获取网盘链接',
              ext: {
                url: appConfig.site + link,
              },
            });
          }
        } catch (itemError) {
          console.log(`解析第 ${index + 1} 个结果时出错:`, itemError);
        }
      });
    }
    
    // 检查是否被反爬
    if (data.includes('安全验证') || data.includes('验证码') || data.includes('Access Denied')) {
      console.log('检测到反爬虫机制');
      cards.push({
        vod_id: 'blocked',
        vod_name: '检测到反爬虫验证',
        vod_pic: '',
        vod_remarks: '网站要求验证，请稍后重试或访问网页版',
        ext: {
          url: url,
        },
      });
    } else if (cards.length === 0) {
      console.log('未找到结果，可能是页面结构变化');
      // 输出更多调试信息
      console.log('页面包含的关键元素:', {
        'van-row': $('van-row').length,
        'van-card': $('van-card').length,
        'a标签总数': $('a').length,
        '包含/s/的链接': $('a[href*="/s/"]').length,
      });
      
      cards.push({
        vod_id: 'no_results',
        vod_name: '未找到搜索结果',
        vod_pic: '',
        vod_remarks: '可能是搜索词无结果或页面结构已更新',
        ext: {
          url: url,
        },
      });
    }
    
  } catch (error) {
    console.log('搜索请求错误:', error);
    console.log('错误详情:', error.stack);
    
    cards.push({
      vod_id: 'error',
      vod_name: `搜索失败: ${error.message || '网络错误'}`,
      vod_pic: '',
      vod_remarks: '请检查网络连接或目标网站状态',
      ext: {
        url: url,
      },
    });
  }
  
  return jsonify({
    list: cards,
  });
}
