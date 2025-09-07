// ==UserScript==
// @name         天逸搜脚本 (修复版)
// @version      2.0
// @description  修复了因网站API改版导致的搜索功能失效问题。
// @author       你和Manus
// @match        *://*/*
// @grant        none
// ==/UserScript==

// 核心依赖，这些函数通常由脚本的运行环境提供
const cheerio = createCheerio();
const CryptoJS = createCryptoJS();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// 统一的请求头
const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
  'Content-Type': 'application/json', // POST请求需要指明内容为JSON
};

// 应用配置
const appConfig = {
  ver: 2, // 版本升级
  title: "天逸搜 (修复版 )",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: 'API搜索',
    ext: {
      url: '/'
    },
  }]
};

// [无需修改] 获取配置函数
async function getConfig( ) {
  return jsonify(appConfig);
}

// [无需修改] 获取卡片列表（此脚本中用不到）
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  return jsonify({
    list: cards,
  });
}

// [已优化] 获取详情页磁力链接的函数
async function getTracks(ext) {
  const { url } = argsify(ext);
  try {
    const { data } = await $fetch.get(url, { headers });
    const $ = cheerio.load(data);
    
    // 详情页的网盘链接现在位于一个特定的 <template> 标签内
    const panLink = $('template').text().trim();

    if (panLink && panLink.includes('cloud.189.cn')) {
      return jsonify({
        list: [{
          title: '在线播放/下载',
          tracks: [{
            name: '天翼云盘',
            pan: panLink,
          }]
        }]
      });
    }
  } catch (e) {
    // 如果发生错误，返回空列表
    console.error("获取详情页失败:", e);
  }
  
  return jsonify({ list: [] });
}

// [无需修改] 获取播放信息（此脚本中用不到）
async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  });
}

// [核心修复] 搜索函数
async function search(ext) {
  ext = argsify(ext);
  const keyword = ext.text;
  let cards = [];

  // 网站API似乎不支持分页，如果请求第二页或更高，直接返回空
  if (ext.page > 1) {
    return jsonify({ list: cards });
  }

  // --- 核心加密与API请求逻辑 ---

  // 1. 定义从公开分析中获得的加密密钥(key)和偏移量(iv)
  const key = CryptoJS.enc.Utf8.parse('tys* postural ');
  const iv = CryptoJS.enc.Utf8.parse('tys* postural ');

  // 2. 准备要加密的数据：当前时间的毫秒时间戳字符串
  const dataToEncrypt = String(Date.now());

  // 3. 执行AES加密 (模式: CBC, 填充: Pkcs7)
  const encrypted = CryptoJS.AES.encrypt(dataToEncrypt, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // 4. 将加密结果转换为字符串，这就是token
  const token = encrypted.toString();

  // 5. 准备API请求地址和请求体(payload)
  const apiUrl = appConfig.site + "/api/search";
  const payload = {
    k: keyword,
    token: token,
  };

  // 6. 发送POST请求到API端点
  const { data } = await $fetch.post(apiUrl, payload, { headers });

  // 7. 解析API返回的JSON数据
  // 根据观察，成功时数据在 response.data.list 中
  if (data && data.data && data.data.list) {
    data.data.list.forEach(item => {
      cards.push({
        vod_id: appConfig.site + '/s/' + item.hash, // 使用hash作为唯一ID构建详情页URL
        vod_name: item.title,
        vod_pic: 'https://www.tianyiso.com/favicon.ico', // 网站不提供图片 ，使用logo作为占位图
        vod_remarks: item.size_str, // 使用文件大小作为备注信息
        ext: {
          url: appConfig.site + '/s/' + item.hash,
        },
      });
    });
  }

  // 8. 返回格式化的结果列表
  return jsonify({
    list: cards,
  });
}
