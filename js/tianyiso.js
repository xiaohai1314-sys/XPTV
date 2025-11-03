const cheerio = createCheerio()
const CryptoJS = createCryptoJS()
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

// ⚠️ 【关键修改】指向你的本地代理服务器地址
const PROXY_SERVER_URL = "http://192.168.1.7:3000/api"; 

const headers = {
  'User-Agent': UA,
}

const appConfig = {
  ver: 3.0,
  title: "天逸搜 (本地代理)",
  site: PROXY_SERVER_URL,
  tabs: [{
    name: '请确保本地服务器已运行',
    ext: {
      url: '/'
    },
  }]
}

// --- 辅助函数 ---

function argsify(ext) { 
    return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {});
}

function jsonify(data) { 
    return JSON.stringify(data);
}

// --- 插件兼容接口 ---

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  return jsonify({
    list: [],
  })
}

/**
 * 【修改】getTracks 直接调用代理 API 获取最终链接和密码
 */
async function getTracks(ext) {
  const { url } = argsify(ext) // url 现在是 http://localhost:3000/api/getTracks...
  
  // 构造代理 API 的 URL，传入 tianyiso 的原始详情页 URL
  // 注意：Node.js 服务器要求传入 tianyiso 的完整 URL，所以这里重新构造一下。
  const tianyisoDetailUrl = url.replace(PROXY_SERVER_URL + '/getTracks?url=', '').replace(PROXY_SERVER_URL, 'https://www.tianyiso.com');

  const proxyApiUrl = `${PROXY_SERVER_URL}/getTracks?url=${encodeURIComponent(tianyisoDetailUrl)}`;
  
  try {
      // 插件现在只负责发起对代理服务器的请求
      const response = await $fetch.get(proxyApiUrl, {
          headers,
          timeout: 8000 // 增加超时时间，等待Node.js服务器处理
      });
      
      return response.data; // 假设服务器返回了 App 期望的 JSON 格式数据
      
  } catch (e) {
      console.log(`[getTracks] 代理请求失败: ${e.message}`);
      return jsonify({
          list: [{
              title: "代理服务连接失败",
              tracks: [{
                  name: `请检查代理服务是否运行`,
                  pan: tianyisoDetailUrl,
              }]
          }]
      });
  }
}

async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  })
}

/**
 * 【修改】search 直接调用代理 API 获取搜索结果
 */
async function search(ext) {
  ext = argsify(ext)
  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1

  // 调用代理服务器的搜索接口
  const proxyApiUrl = `${PROXY_SERVER_URL}/search?k=${text}&page=${page}`;
  
  try {
      // 插件现在只负责发起对代理服务器的请求
      const response = await $fetch.get(proxyApiUrl, {
        headers,
        timeout: 8000 // 增加超时时间，等待Node.js服务器处理
      })
      
      return response.data; // 假设服务器返回了 App 期望的 JSON 格式数据

  } catch (e) {
      console.log(`[search] 代理请求失败 (超时/网络错误): ${e.message}`)
      return jsonify({
          list: [],
      })
  }
}

// --- 兼容接口 (保留) ---

async function init() { return getConfig(); }
async function home() { 
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg) { return jsonify({ list: [] }); }
async function detail(id) { 
    // detail 接口应该返回 getTracks 需要的 url
    // 我们这里构造一个假的 URL，让 getTracks 知道要用这个路径去调用代理 API
    return getTracks({ url: `https://www.tianyiso.com${id}` }); 
}
async function play(flag, id) { return jsonify({ url: id }); }
