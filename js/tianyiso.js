/**
 * reboys.cn 网盘资源聚合脚本 - V2.1.0 修复版
 * 
 * 修复内容:
 * 1. 修复搜索API调用逻辑
 * 2. 修复数据解析结构
 * 3. 优化错误处理
 * 4. 修复UI无响应问题
 */

const SITE_URL = "https://reboys.cn";
const API_TOKEN = "eyJ0aW1lc3RhbXAiOjE3NjE2MjA0MzYsIm5vbmNlIjoiNjkwMDMxZDQxZWYzNDEuOTc3MTYzMTgiLCJzaWduYXR1cmUiOiIxMWY0YWVlZWZhNDU2NjNlMGZjMTY1NjBjNjMyZGM0YTA4MGRhNGQxOWJjZjYzZmQ5MDRkNDE2NTA2MjAyOWE0In0=";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// ============ 日志函数 ============
function log(msg) {
  const logMsg = `[reboys] ${msg}`;
  try { 
    if (typeof $log !== 'undefined') $log(logMsg); 
    else console.log(logMsg);
  } catch (_) { 
    console.log(logMsg); 
  }
}

function argsify(ext) {
  if (typeof ext === 'string') {
    try { return JSON.parse(ext); } 
    catch (e) { 
      log(`argsify解析失败: ${e.message}`);
      return {}; 
    }
  }
  return ext || {};
}

function jsonify(data) { 
  return JSON.stringify(data); 
}

// ============ 网盘类型识别 ============
const PAN_TYPES = {
  '夸克': { regex: /quark|夸克/i, id: 0 },
  '阿里云盘': { regex: /aliyun|阿里/i, id: 1 },
  '百度网盘': { regex: /baidu|百度/i, id: 2 },
  'UC网盘': { regex: /uc|UC/i, id: 3 },
  '迅雷网盘': { regex: /thunder|迅雷/i, id: 4 }
};

function getPanType(typeStr) {
  if (!typeStr) return { name: '未知网盘', id: -1 };
  
  for (const [name, config] of Object.entries(PAN_TYPES)) {
    if (config.regex.test(typeStr)) {
      return { name, id: config.id };
    }
  }
  return { name: '未知网盘', id: -1 };
}

function detectPanType(url) {
  if (!url) return '资源链接';
  if (url.includes('quark')) return '夸克网盘';
  if (url.includes('aliyun')) return '阿里云盘';
  if (url.includes('baidu')) return '百度网盘';
  if (url.includes('115')) return '115网盘';
  if (url.includes('thunder')) return '迅雷网盘';
  return '网盘链接';
}

// ============ HTTP 请求封装 ============
async function httpGet(url, headers = {}) {
  log(`[HTTP] GET: ${url}`);
  
  try {
    // 尝试使用 $fetch
    if (typeof $fetch !== 'undefined' && $fetch.get) {
      const response = await $fetch.get(url, { headers });
      
      // 处理不同的返回类型
      if (typeof response === 'string') {
        try {
          return JSON.parse(response);
        } catch (e) {
          return response;
        }
      }
      return response;
    }
    
    // 回退到原生 fetch
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url, { 
        method: 'GET',
        headers: headers 
      });
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    }
    
    throw new Error('没有可用的HTTP客户端');
  } catch (e) {
    log(`[HTTP] 请求失败: ${e.message}`);
    throw e;
  }
}

// ============ API 调用层 ============
async function searchAPI(keyword, page = 1) {
  const url = `${SITE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  
  log(`[API] 搜索: "${keyword}" 第${page}页`);
  
  try {
    const data = await httpGet(url, {
      'API-TOKEN': API_TOKEN,
      'User-Agent': UA,
      'Accept': 'application/json'
    });
    
    log(`[API] 返回数据类型: ${typeof data}`);
    
    // 确保返回对象格式
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        log(`[API] JSON解析失败`);
        return { code: -1, message: '数据解析失败', data: null };
      }
    }
    
    return data;
  } catch (e) {
    log(`[API] 异常: ${e.message}`);
    return { code: -1, message: e.message, data: null };
  }
}

// ============ 资源链接提取 ============
async function extractResourceLink(resourceUrl) {
  log(`[Extract] 提取: ${resourceUrl}`);
  
  try {
    const pageData = await httpGet(resourceUrl, {
      'User-Agent': UA
    });
    
    const htmlText = typeof pageData === 'string' ? pageData : JSON.stringify(pageData);
    
    // 方案1: 直接匹配网盘链接
    const panPatterns = [
      /(https?:\/\/pan\.quark\.cn[^\s"'<>]+)/gi,
      /(https?:\/\/[^\s]*aliyundrive\.com[^\s"'<>]+)/gi,
      /(https?:\/\/pan\.baidu\.com[^\s"'<>]+)/gi,
      /(https?:\/\/115\.com[^\s"'<>]+)/gi
    ];
    
    for (const pattern of panPatterns) {
      const match = htmlText.match(pattern);
      if (match && match[0]) {
        const url = match[0];
        log(`[Extract] ✓ 找到: ${url.substring(0, 50)}...`);
        return {
          success: true,
          url: url,
          type: detectPanType(url)
        };
      }
    }
    
    // 方案2: 查找跳转链接
    const redirectMatch = htmlText.match(/window\.open\(['"]([^'"]+)['"]\)/);
    if (redirectMatch && redirectMatch[1]) {
      log(`[Extract] ✓ 找到跳转链接`);
      return {
        success: true,
        url: redirectMatch[1],
        type: detectPanType(redirectMatch[1])
      };
    }
    
    log(`[Extract] ⚠ 未找到直接链接`);
    return {
      success: false,
      url: resourceUrl,
      type: '资源页面',
      message: '请手动获取'
    };
    
  } catch (e) {
    log(`[Extract] 异常: ${e.message}`);
    return {
      success: false,
      url: resourceUrl,
      type: '错误',
      message: e.message
    };
  }
}

// ============ 插件接口 ============

async function getConfig() {
  log("==== 初始化 V2.1.0 ====");
  
  return jsonify({
    ver: 1,
    title: 'reboys资源聚合',
    site: SITE_URL,
    cookie: '',
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
  
  log(`[getCards] 分类="${categoryName}" 页=${page}`);
  
  try {
    // 使用分类名作为关键词搜索
    const apiResp = await searchAPI(categoryName, page);
    
    log(`[getCards] API返回 code=${apiResp.code}`);
    
    if (apiResp.code !== 0 || !apiResp.data) {
      log(`[getCards] API失败: ${apiResp.message || '无数据'}`);
      return jsonify({ list: [] });
    }
    
    // 解析数据结构: apiResp.data.data.results
    const results = apiResp.data?.data?.results || apiResp.data?.results || [];
    
    log(`[getCards] 解析到 ${results.length} 条结果`);
    
    const cards = results
      .filter(item => item && item.title) // 过滤无效数据
      .map(item => {
        const firstLink = item.links && item.links[0] ? item.links[0].url : '';
        const resourceUrl = firstLink || `${SITE_URL}/d/${item.id}.html`;
        
        return {
          vod_id: item.id || Math.random().toString(),
          vod_name: item.title || '未知资源',
          vod_pic: item.image || FALLBACK_PIC,
          vod_remarks: item.source_name ? `[${item.source_name}]` : '',
          ext: {
            url: resourceUrl,
            resourceId: item.id,
            sourceType: getPanType(item.source_name || '').id
          }
        };
      });
    
    log(`[getCards] ✓ 返回 ${cards.length} 张卡片`);
    return jsonify({ list: cards });
    
  } catch (e) {
    log(`[getCards] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  
  if (!text || text.trim() === '') {
    log(`[search] 空关键词`);
    return jsonify({ list: [] });
  }
  
  log(`[search] 关键词="${text}" 页=${page}`);
  
  try {
    const apiResp = await searchAPI(text, page);
    
    log(`[search] API返回 code=${apiResp.code}`);
    
    if (apiResp.code !== 0 || !apiResp.data) {
      log(`[search] 搜索失败: ${apiResp.message || '无数据'}`);
      return jsonify({ list: [] });
    }
    
    // 多层级数据结构适配
    const results = apiResp.data?.data?.results || 
                   apiResp.data?.results || 
                   [];
    
    log(`[search] 解析到 ${results.length} 条结果`);
    
    const cards = results
      .filter(item => {
        if (!item || !item.title) return false;
        
        // 过滤黑名单网盘
        const sourceName = item.source_name || '';
        return !sourceName.includes('迅雷') && !sourceName.includes('百度');
      })
      .map(item => {
        const firstLink = item.links && item.links[0] ? item.links[0].url : '';
        const resourceUrl = firstLink || `${SITE_URL}/d/${item.id}.html`;
        
        return {
          vod_id: item.id || Math.random().toString(),
          vod_name: item.title || '未知资源',
          vod_pic: FALLBACK_PIC,
          vod_remarks: `[${item.source_name || '未知来源'}]`,
          ext: {
            url: resourceUrl,
            resourceId: item.id,
            sourceType: getPanType(item.source_name || '').id
          }
        };
      });
    
    log(`[search] ✓ 返回 ${cards.length} 个结果`);
    return jsonify({ list: cards });
    
  } catch (e) {
    log(`[search] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url, resourceId } = ext;
  
  if (!url && !resourceId) {
    log(`[getTracks] 缺少URL和ID`);
    return jsonify({ list: [] });
  }
  
  log(`[getTracks] URL=${url}`);
  
  try {
    const result = await extractResourceLink(url);
    
    let finalUrl = result.url;
    let trackName = result.type || '资源链接';
    
    return jsonify({
      list: [{
        title: result.success ? '获取成功' : '请手动获取',
        tracks: [{
          name: trackName,
          pan: finalUrl,
          ext: {}
        }]
      }]
    });
    
  } catch (e) {
    log(`[getTracks] 异常: ${e.message}`);
    return jsonify({
      list: [{
        title: '获取失败',
        tracks: [{
          name: '错误',
          pan: url || '',
          ext: {}
        }]
      }]
    });
  }
}

// ============ 兼容接口 ============

async function init(cfg) {
  log('[init] 初始化');
  return await getConfig();
}

async function home(filter) {
  log('[home] 获取首页');
  const configStr = await getConfig();
  const config = JSON.parse(configStr);
  
  return jsonify({ 
    class: config.tabs, 
    filters: {} 
  });
}

async function category(tid, pg, filter, extend) {
  log(`[category] tid=${JSON.stringify(tid)} pg=${pg}`);
  
  // 处理不同的参数格式
  let categoryId = tid;
  let pageNum = pg || 1;
  
  if (typeof tid === 'object' && tid.id) {
    categoryId = tid.id;
  }
  
  return await getCards({ 
    id: categoryId, 
    page: pageNum 
  });
}

async function detail(id) {
  log(`[detail] id=${id}`);
  return await getTracks({ url: id });
}

async function play(flag, id, flags) {
  log(`[play] flag=${flag} id=${id}`);
  return jsonify({ url: id });
}

// ============ 导出 ============
log('==== V2.1.0 加载完成 ====');

// 确保全局可访问
if (typeof globalThis !== 'undefined') {
  globalThis.init = init;
  globalThis.home = home;
  globalThis.category = category;
  globalThis.detail = detail;
  globalThis.play = play;
  globalThis.search = search;
}
