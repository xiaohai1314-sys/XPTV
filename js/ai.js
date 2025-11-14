/**
 * 这是一个用于从 PanSou (s.panhunt.com) 网站抓取搜索结果的脚本。
 * 它的结构和函数签名模仿了您提供的 tianyiso.com 示例脚本。
 * 
 * 依赖项说明 (需要由您的运行环境提供):
 * - createCheerio(): 一个函数，应返回一个 Cheerio 实例的 load 方法。
 * - createCryptoJS(): 在此脚本中未使用，但为保持结构一致性而保留。
 * - $fetch: 一个支持 async/await 的 HTTP 请求客户端，类似于 aixo 或 ofetch。
 * - argsify(), jsonify(): 您的框架提供的辅助函数，用于参数解析和响应格式化。
 */

// 假设这些函数由您的环境提供
const cheerio = createCheerio()
const CryptoJS = createCryptoJS() // 未使用，但保留结构
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

// PanSou 似乎不需要特殊的 Referer 或 Origin，但保留 User-Agent
const headers = {
  'User-Agent': UA,
}

// 脚本的核心配置
const appConfig = {
  ver: 1,
  title: "PanSou",
  site: "https://s.panhunt.com",
  // PanSou 只有一个搜索功能，没有复杂的分类
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
}

// --- 框架函数实现 ---

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  // PanSou 的首页没有推荐内容，直接返回空列表
  ext = argsify(ext)
  let cards = []
  return jsonify({
    list: cards,
  })
}

async function getTracks(ext) {
  // 此函数用于从详情页提取最终的网盘链接
  const { url } = argsify(ext)
  
  const { data } = await $fetch.get(url, {
    headers
  })
  
  const $ = cheerio.load(data)
  
  // 在 PanSou 的详情页中，最终的资源链接通常在 class="res-link" 的 <a> 标签里
  const panLink = $('.res-link').attr('href')
  
  if (panLink) {
    return jsonify({ 
      list: [{
        title: '在线', // 保持结构一致
        tracks: [{
          name: '网盘', // 资源类型
          pan: panLink, // 提取到的链接
        }]
      }]
    })
  } else {
    // 如果没有找到链接，返回空列表
    return jsonify({ list: [] })
  }
}

async function getPlayinfo(ext) {
  // PanSou 不直接提供播放流，此函数返回空
  return jsonify({
    urls: [],
  })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = [];

  // PanSou 没有明显的分页功能，所以只处理第一页
  let page = ext.page || 1
  if (page > 1) {
    return jsonify({
      list: cards,
    })
  }

  // PanSou 的搜索参数是 'keyword'
  const url = `<LaTex>${appConfig.site}/search?keyword=$</LaTex>{encodeURIComponent(ext.text)}`
  
  const { data } = await $fetch.get(url, {
    headers
  })
  
  const $ = cheerio.load(data)
  
  // PanSou 的每个搜索结果项都包裹在 <div class="item"> 中
  $('div.item').each((_, element) => {
    const aTag = $(element).find('a').first()
    const path = aTag.attr('href') ?? ''
    
    // 确保链接是有效的详情页链接
    if (path) {
      const title = aTag.text().trim()
      
      cards.push({
        vod_id: path, // 使用相对路径作为唯一 ID
        vod_name: title,
        vod_pic: '', // 列表页没有图片
        vod_remarks: '', // 列表页没有备注
        ext: {
          url: new URL(path, appConfig.site).href, // 构造完整的详情页 URL
        },
      })
    }
  })

  return jsonify({
      list: cards,
  })
}
