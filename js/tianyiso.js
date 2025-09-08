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
  const { data } = await $fetch.get(url, {
    headers
  })
  // 注意：这里的解析规则依赖于详情页的结构，如果详情页也改版了，这里可能也需要调整。
  // 根据之前的分析，这个规则可能仍然有效，但需要实际测试。
  let pan = data.match(/"(https:\/\/cloud\.189\.cn\/t\/.* )",/)[1]
  return jsonify({ 
    list: [{
      title: '在线',
      tracks: [{
        name: '网盘',
        pan,
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
  if (page > 1) {
    // 网站似乎是纯前端分页，直接请求第二页的URL无效，
    // 并且脚本本身也只处理第一页，所以这里保持不变。
    return jsonify({
      list: cards,
    })
  }

  const url = appConfig.site + `/search?k=${text}`
  const { data } = await $fetch.get(url, {
    headers
  })
  
  const $ = cheerio.load(data)
  
  // --- 修改开始 ---
  // 遍历所有指向详情页的链接 <a>
  $('a[href^="/s/"]').each((_, each) => {
    const path = $(each).attr('href') ?? ''
    
    // 使用新的选择器来定位并提取标题文本
    // 选择器 'div[style*="font-size:medium"]' 寻找包含特定内联样式的div
    const title = $(each).find('div[style*="font-size:medium"]').text().trim();

    // 确保提取到了标题再添加到结果中
    if (title) {
      cards.push({
        vod_id: path,
        // 清理标题中可能存在的多余空白字符和换行符
        vod_name: title.replace(/\s+/g, ' '), 
        vod_pic: '', // 图片字段留空
        vod_remarks: '', // 备注字段留空
        ext: {
          url: appConfig.site + path,
        },
      })
    }
  })
  // --- 修改结束 ---

  return jsonify({
      list: cards,
  })
}
