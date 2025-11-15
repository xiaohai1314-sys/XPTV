/**
 * 趣乐兔 (pan.funletu.com) 专用脚本
 * 
 * 功能: 
 * 1. 使用网站的后端API进行搜索，而非抓取HTML。
 * 2. 直接从搜索结果获取标题、大小和夸克网盘链接。
 * 3. 详情页功能被简化，因为搜索已返回所有必要信息。
 * 
 * 作者: Manus
 * 日期: 2025-11-15
 */

// 必要的库，由运行环境提供
const cheerio = createCheerio()
const CryptoJS = createCryptoJS()

// 定义一个通用的浏览器User-Agent
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"

// 网站和API的基本配置
const appConfig = {
  ver: 1,
  title: "趣乐兔",
  site: "https://pan.funletu.com",
  apiUrl: "https://b.funletu.com/search", // API端点
  tabs: [{
    name: 'API搜索', // 标签页名称，表明这是基于API的
    ext: {
      url: '/'
    },
  }]
}

/**
 * 获取应用配置
 */
async function getConfig() {
  return jsonify(appConfig)
}

/**
 * 获取首页卡片（此网站首页无动态卡片，返回空列表）
 */
async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  return jsonify({
    list: cards,
  })
}

/**
 * 获取播放轨道/网盘链接
 * 
 * @param {string} ext - 包含网盘链接的扩展参数
 * 
 * 说明：
 * 由于search函数在搜索时已经获取了最终的网盘链接并存储在ext.pan_url中，
 * 此函数只需直接读取并返回该链接即可，无需再次发起网络请求。
 */
async function getTracks(ext) {
  const { pan_url } = argsify(ext)
  
  if (!pan_url) {
    return jsonify({ list: [] });
  }

  return jsonify({ 
    list: [{
      title: '在线资源',
      tracks: [{
        name: '夸克网盘',
        pan: pan_url, // 直接使用传入的链接
      }]
    }]
  })
}

/**
 * 获取播放信息（此脚本不涉及直接播放，返回空）
 */
async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  })
}

/**
 * 搜索功能实现
 * 
 * @param {string} ext - 包含搜索文本(text)和页码(page)的参数
 * 
 * 说明：
 * 此函数通过向网站的后端API发送一个POST请求来获取搜索结果。
 */
async function search(ext) {
  ext = argsify(ext)
  const page = ext.page || 1;

  // 构建发送给API的请求体 (Payload)
  const payload = {
    keyword: ext.text,
    page: page,
    pageSize: 20, // 每页加载20条数据
    sortBy: "sort",
    order: "desc",
    filetypeid: 0,
    categoryid: 0,
    courseid: 1,
    offset: 0
  };

  // 定义请求头
  const headers = {
    'Content-Type': 'application/json',
    'Origin': appConfig.site,
    'Referer': appConfig.site + '/',
    'User-Agent': UA,
  };

  // 使用$fetch.post方法发起API请求
  const { data: responseJson } = await $fetch.post(appConfig.apiUrl, {
    headers: headers,
    body: payload, // 将 payload 作为请求体
  });

  const cards = [];
  // 检查API返回的数据是否有效
  if (responseJson && responseJson.code === 200 && responseJson.data && responseJson.data.list) {
    responseJson.data.list.forEach(item => {
      cards.push({
        // vod_id 使用网盘链接或唯一ID均可，这里用ID更规范
        vod_id: JSON.stringify({ pan_url: item.url }), 
        vod_name: item.title,
        vod_pic: '', // 网站API不提供图片
        vod_remarks: item.size || '未知大小', // 将文件大小作为备注
        ext: {
          // 将网盘链接存到ext中，方便getTracks直接使用
          pan_url: item.url, 
        },
      });
    });
  }

  return jsonify({
      list: cards,
  });
}
