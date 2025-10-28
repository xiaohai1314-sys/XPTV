/**
 * reboys.cn 聚合脚本 - V6.0.0 (适配新后端API)
 * 
 * 更新日志:
 * - 修复数据结构解析
 * - 增加详细错误日志
 * - 优化显示格式
 */

// !! 重要: 替换为你的后端地址
const MY_BACKEND_API_URL = "http://192.168.10.106:3000";
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// ============ 工具函数 ============
function log(msg) { 
  console.log(`[reboys-plugin] ${msg}`); 
}

function argsify(ext) { 
  return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); 
}

function jsonify(data) { 
  return JSON.stringify(data); 
}

// ============ API 调用 ============
async function searchAPI(keyword, page = 1) {
  const url = `${MY_BACKEND_API_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  log(`请求后端: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    log(`后端响应: code=${data.code}, message=${data.message}`);
    return data;
  } catch (e) {
    log(`请求失败: ${e.message}`);
    return { code: -1, message: e.message, data: null };
  }
}

// ============ 数据转换 ============
function parseResults(apiResp) {
  if (!apiResp || apiResp.code !== 0) {
    log(`API错误: code=${apiResp?.code}, message=${apiResp?.message}`);
    return [];
  }

  // 根据实际返回结构解析
  // 可能的路径: data.data.data.results 或 data.results
  let results = null;
  
  if (apiResp.data?.data?.data?.results) {
    results = apiResp.data.data.data.results;
  } else if (apiResp.data?.results) {
    results = apiResp.data.results;
  } else if (Array.isArray(apiResp.data)) {
    results = apiResp.data;
  }

  if (!results || !Array.isArray(results)) {
    log(`无法解析结果，data结构: ${JSON.stringify(apiResp.data).substring(0, 200)}`);
    return [];
  }

  log(`解析到 ${results.length} 条结果`);
  return results;
}

function convertToCard(item) {
  return {
    vod_id: String(item.id || item.message_id || ''),
    vod_name: item.title || item.content || '未知标题',
    vod_pic: item.image || item.pic || FALLBACK_PIC,
    vod_remarks: `[${item.source_name || item.channel || '未知来源'}]`,
    vod_year: item.datetime ? new Date(item.datetime).getFullYear() : '',
  };
}

// ============ 插件接口 ============
async function getConfig() {
  return jsonify({
    ver: 1,
    title: 'reboys聚合(V6)',
    site: MY_BACKEND_API_URL,
    tabs: [
      { name: '短剧', ext: { id: '短剧' } },
      { name: '电影', ext: { id: '电影' } },
      { name: '电视剧', ext: { id: '电视剧' } },
      { name: '动漫', ext: { id: '动漫' } },
      { name: '综艺', ext: { id: '综艺' } }
    ]
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { id: categoryName = '电影', page = 1 } = ext;
  
  log(`getCards: 分类=${categoryName}, 页码=${page}`);
  
  const apiResp = await searchAPI(categoryName, page);
  const results = parseResults(apiResp);
  
  const cards = results.map(convertToCard);
  log(`返回 ${cards.length} 张卡片`);
  
  return jsonify({ list: cards });
}

async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  
  if (!text.trim()) {
    log('搜索关键词为空');
    return jsonify({ list: [] });
  }
  
  log(`search: 关键词="${text}", 页码=${page}`);
  
  const apiResp = await searchAPI(text, page);
  const results = parseResults(apiResp);
  
  const cards = results.map(convertToCard);
  log(`搜索返回 ${cards.length} 条结果`);
  
  return jsonify({ list: cards });
}

async function detail(id) {
  log(`detail: id=${id}`);
  // 如果有详情接口，在这里实现
  // 目前返回空，让播放器直接使用播放接口
  return jsonify({ 
    list: [{
      vod_id: id,
      vod_name: '正在加载...',
      vod_play_from: 'reboys',
      vod_play_url: id
    }]
  });
}

async function play(flag, id) {
  log(`play: flag=${flag}, id=${id}`);
  // 如果播放地址需要解析，在这里实现
  // 目前直接返回原始链接
  return jsonify({ url: id });
}

// ============ 标准导出 ============
async function init(cfg) { 
  log('插件初始化');
  return await getConfig(); 
}

async function home(filter) { 
  const config = JSON.parse(await getConfig()); 
  return jsonify({ 
    class: config.tabs, 
    filters: {} 
  }); 
}

async function category(tid, pg) { 
  return await getCards({ id: tid, page: pg || 1 }); 
}

// 导出到全局
if (typeof globalThis !== 'undefined') {
  globalThis.init = init;
  globalThis.home = home;
  globalThis.category = category;
  globalThis.detail = detail;
  globalThis.play = play;
  globalThis.search = search;
  
  log('插件已加载，版本: V6.0.0');
}
