/**
 * reboys.cn 聚合脚本 - V6.1.0 (调试版)
 * 
 * 特点：
 * - 添加大量日志帮助排查问题
 * - 立即输出加载信息
 */

// ========== 立即执行的初始化日志 ==========
console.log('==================================================');
console.log('[reboys] 🚀 脚本开始加载...');
console.log('[reboys] 当前时间:', new Date().toISOString());
console.log('==================================================');

// !! 替换为你的后端地址
const MY_BACKEND_API_URL = "http://192.168.10.106:3000";
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

console.log('[reboys] 配置信息:');
console.log('[reboys]   后端地址:', MY_BACKEND_API_URL);
console.log('[reboys]   默认图片:', FALLBACK_PIC);

// ============ 工具函数 ============
function log(msg) { 
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}][reboys] ${msg}`); 
}

function argsify(ext) {
  log(`argsify 输入: ${JSON.stringify(ext)}`);
  const result = (typeof ext === 'string') ? JSON.parse(ext) : (ext || {});
  log(`argsify 输出: ${JSON.stringify(result)}`);
  return result;
}

function jsonify(data) { 
  return JSON.stringify(data); 
}

// ============ API 调用 ============
async function searchAPI(keyword, page = 1) {
  const url = `${MY_BACKEND_API_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  log(`📡 发起请求: ${url}`);
  
  try {
    log('正在 fetch...');
    const response = await fetch(url);
    log(`收到响应: status=${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    log(`✅ 解析成功: code=${data.code}, message=${data.message}`);
    log(`数据预览: ${JSON.stringify(data).substring(0, 200)}...`);
    return data;
  } catch (e) {
    log(`❌ 请求失败: ${e.message}`);
    log(`错误堆栈: ${e.stack}`);
    return { code: -1, message: e.message, data: null };
  }
}

// ============ 数据转换 ============
function parseResults(apiResp) {
  log('开始解析结果...');
  
  if (!apiResp) {
    log('❌ apiResp 为空');
    return [];
  }
  
  if (apiResp.code !== 0) {
    log(`❌ API错误: code=${apiResp.code}, message=${apiResp.message}`);
    return [];
  }

  log('检查数据路径...');
  let results = null;
  
  // 路径1: data.data.data.results
  if (apiResp.data?.data?.data?.results) {
    log('✅ 找到路径: data.data.data.results');
    results = apiResp.data.data.data.results;
  } 
  // 路径2: data.results
  else if (apiResp.data?.results) {
    log('✅ 找到路径: data.results');
    results = apiResp.data.results;
  } 
  // 路径3: data 直接是数组
  else if (Array.isArray(apiResp.data)) {
    log('✅ 找到路径: data (直接数组)');
    results = apiResp.data;
  }
  else {
    log('❌ 无法识别数据结构');
    log(`数据示例: ${JSON.stringify(apiResp.data).substring(0, 300)}`);
    return [];
  }

  if (!Array.isArray(results)) {
    log(`❌ results 不是数组: ${typeof results}`);
    return [];
  }

  log(`✅ 解析成功，共 ${results.length} 条`);
  return results;
}

function convertToCard(item, index) {
  log(`转换第 ${index + 1} 项: ${JSON.stringify(item).substring(0, 100)}...`);
  
  return {
    vod_id: String(item.id || item.message_id || index),
    vod_name: item.title || item.content || '未知标题',
    vod_pic: item.image || item.pic || FALLBACK_PIC,
    vod_remarks: `[${item.source_name || item.channel || '未知'}]`,
    vod_year: item.datetime ? new Date(item.datetime).getFullYear() : '',
  };
}

// ============ 插件接口 ============
async function init(cfg) {
  log('📌 init() 被调用');
  log(`参数: ${JSON.stringify(cfg)}`);
  const result = await getConfig();
  log(`返回: ${result.substring(0, 200)}...`);
  return result;
}

async function home(filter) {
  log('📌 home() 被调用');
  log(`参数: ${JSON.stringify(filter)}`);
  const config = JSON.parse(await getConfig());
  const result = jsonify({ 
    class: config.tabs, 
    filters: {} 
  });
  log(`返回: ${result.substring(0, 200)}...`);
  return result;
}

async function category(tid, pg) {
  log('📌 category() 被调用');
  log(`参数: tid=${tid}, pg=${pg}`);
  const result = await getCards({ id: tid, page: pg || 1 });
  log(`返回: ${result.substring(0, 200)}...`);
  return result;
}

async function detail(id) {
  log('📌 detail() 被调用');
  log(`参数: id=${id}`);
  const result = jsonify({ 
    list: [{
      vod_id: id,
      vod_name: '加载中...',
      vod_play_from: 'reboys',
      vod_play_url: id
    }]
  });
  log(`返回: ${result}`);
  return result;
}

async function play(flag, id) {
  log('📌 play() 被调用');
  log(`参数: flag=${flag}, id=${id}`);
  const result = jsonify({ url: id });
  log(`返回: ${result}`);
  return result;
}

async function search(ext) {
  log('📌 search() 被调用 ⭐⭐⭐');
  log(`原始参数: ${JSON.stringify(ext)}`);
  
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  
  log(`解析后: text="${text}", page=${page}`);
  
  if (!text.trim()) {
    log('⚠️ 搜索关键词为空，返回空列表');
    return jsonify({ list: [] });
  }
  
  log(`🔍 开始搜索: "${text}"`);
  
  const apiResp = await searchAPI(text, page);
  const results = parseResults(apiResp);
  
  log(`准备转换 ${results.length} 条数据...`);
  const cards = results.map((item, idx) => convertToCard(item, idx));
  
  log(`✅ 搜索完成，返回 ${cards.length} 条结果`);
  const finalResult = jsonify({ list: cards });
  log(`最终返回: ${finalResult.substring(0, 300)}...`);
  
  return finalResult;
}

async function getConfig() {
  log('getConfig() 被调用');
  return jsonify({
    ver: 1,
    title: 'reboys聚合(调试版)',
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
  log('getCards() 被调用');
  ext = argsify(ext);
  const { id: categoryName = '电影', page = 1 } = ext;
  
  log(`分类="${categoryName}", 页码=${page}`);
  
  const apiResp = await searchAPI(categoryName, page);
  const results = parseResults(apiResp);
  
  const cards = results.map((item, idx) => convertToCard(item, idx));
  log(`返回 ${cards.length} 张卡片`);
  
  return jsonify({ list: cards });
}

// ============ 全局导出 ============
console.log('[reboys] 开始注册全局函数...');

if (typeof globalThis !== 'undefined') {
  globalThis.init = init;
  globalThis.home = home;
  globalThis.category = category;
  globalThis.detail = detail;
  globalThis.play = play;
  globalThis.search = search;
  
  console.log('[reboys] ✅ 全局函数已注册:');
  console.log('[reboys]    - init');
  console.log('[reboys]    - home');
  console.log('[reboys]    - category');
  console.log('[reboys]    - detail');
  console.log('[reboys]    - play');
  console.log('[reboys]    - search');
} else {
  console.error('[reboys] ❌ globalThis 不可用！');
}

console.log('==================================================');
console.log('[reboys] ✅ 脚本加载完成');
console.log('[reboys] 版本: V6.1.0-debug');
console.log('==================================================');

// 测试函数（可选）
if (typeof globalThis !== 'undefined') {
  globalThis.__reboys_test__ = async function() {
    console.log('[测试] 开始测试...');
    try {
      const result = await searchAPI('测试', 1);
      console.log('[测试] 结果:', result);
      return result;
    } catch (e) {
      console.error('[测试] 失败:', e);
      return null;
    }
  };
  console.log('[reboys] 💡 可通过 __reboys_test__() 测试连接');
}
