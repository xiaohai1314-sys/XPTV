// 确保您已经通过某种方式引入了 cheerio 和 crypto-js
// 例如在您的环境中：
// const cheerio = require('cheerio');
// const CryptoJS = require('crypto-js');
// 在您提供的脚本环境中，这可能是由外部加载器完成的
const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

// 稍微增强了一下 headers，更像真实浏览器
const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
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

async function getConfig( ) {
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
      /"(https:\/\/cloud\.189\.cn\/t\/[^"]* )"/,
      /https:\/\/cloud\.189\.cn\/t\/[A-Za-z0-9]+/,
      /"(https:\/\/pan\.baidu\.com\/s\/[^"]* )"/,
      /"(https:\/\/www\.aliyundrive\.com\/s\/[^"]* )"/,
      /"(https:\/\/pan\.quark\.cn\/s\/[^"]* )"/,
      /https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9]+/,
      /https:\/\/www\.aliyundrive\.com\/s\/[A-Za-z0-9]+/,
      /https:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9]+/,
    ]
    
    for (let pattern of patterns ) {
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
    
    // --- 核心解析逻辑开始 ---
    // 使用 Cheerio 加载获取到的 HTML 内容
    const $ = cheerio.load(data);

    // 每个结果项都被一个 a 标签包裹，其链接以 /s/ 开头。这是最精确的选择器。
    const resultItems = $('a[href^="/s/"]');

    console.log(`Cheerio 解析：找到了 ${resultItems.length} 个结果项。`);

    if (resultItems.length > 0) {
        resultItems.each((index, element) => {
            const item = $(element);

            // 1. 提取详情页链接
            const link = item.attr('href');
            if (!link) return; // 如果没有链接，则跳过当前循环

            // 2. 提取标题
            // 标题在 van-card 的 title 插槽内的 div 中
            const titleDiv = item.find('div[style*="font-size:medium"]');
            // .text() 会自动移除所有内部的HTML标签（如高亮的<span>），并返回纯文本
            const title = titleDiv.text().trim().replace(/\s+/g, ' '); // 清理所有多余的空白字符

            // 3. 提取底部描述信息（时间、格式、大小等）
            const bottomDiv = item.find('div[style*="padding-bottom"]');
            const remarks = bottomDiv.text().trim().replace(/\s+/g, ' ');

            if (title && link) {
                console.log('成功解析结果:', { title, link, remarks });
                cards.push({
                    vod_id: link,
                    vod_name: title,
                    vod_pic: '', // 您可以根据需要设置一个默认图片
                    vod_remarks: remarks || '点击获取网盘链接',
                    ext: {
                        url: appConfig.site + link,
                    },
                });
            }
        });
    }
    
    // 如果经过解析后，cards数组仍然为空，说明可能被拦截或页面结构大变
    if (cards.length === 0) {
      console.log('解析完成，但未找到任何有效资源。可能被反爬虫拦截或页面已更新。');
      cards.push({
        vod_id: 'no_results_parsed',
        vod_name: '未解析到有效资源',
        vod_pic: '',
        vod_remarks: '请检查是否被反爬虫拦截或网站结构已更新',
        ext: {
          url: url,
        },
      });
    }
    // --- 核心解析逻辑结束 ---
    
  } catch (error) {
    console.log('搜索请求或解析时发生错误:', error);
    
    cards.push({
      vod_id: 'error',
      vod_name: `搜索失败: ${error.message || '未知网络错误'}`,
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
