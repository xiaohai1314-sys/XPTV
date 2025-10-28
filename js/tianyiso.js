/**
 * reboys.cn 网盘资源聚合脚本 - V2.0.0
 * 纯前端实现，零后端依赖
 * 
 * 功能:
 * - 直接调用reboys.cn的搜索API（已有API-TOKEN在前端）
 * - 提取网盘链接，无需额外后端API
 * - 支持多网盘类型识别
 */

const SITE_URL = "https://reboys.cn";
const API_TOKEN = "eyJ0aW1lc3RhbXAiOjE3NjE2MjA0MzYsIm5vbmNlIjoiNjkwMDMxZDQxZWYzNDEuOTc3MTYzMTgiLCJzaWduYXR1cmUiOiIxMWY0YWVlZWZhNDU2NjNlMGZjMTY1NjBjNjMyZGM0YTA4MGRhNGQxOWJjZjYzZmQ5MDRkNDE2NTA2MjAyOWE0In0=";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// ============ 日志函数 ============
function log(msg) {
  const logMsg = `[reboys] ${msg}`;
  try { $log(logMsg); } 
  catch (_) { console.log(logMsg); }
}

function argsify(ext) {
  if (typeof ext === 'string') {
    try { return JSON.parse(ext); } 
    catch (e) { return {}; }
  }
  return ext || {};
}

function jsonify(data) { return JSON.stringify(data); }

// ============ 网盘类型识别 ============
const PAN_TYPES = {
  '夸克': { regex: /quark|夸克/i, id: 0 },
  '阿里云盘': { regex: /aliyun|阿里/i, id: 1 },
  '百度网盘': { regex: /baidu|百度/i, id: 2 },
  'UC网盘': { regex: /uc|UC/i, id: 3 },
  '迅雷网盘': { regex: /thunder|迅雷/i, id: 4 }
};

function getPanType(typeStr) {
  for (const [name, config] of Object.entries(PAN_TYPES)) {
    if (config.regex.test(typeStr)) {
      return { name, id: config.id };
    }
  }
  return { name: '未知网盘', id: -1 };
}

// ============ API 调用层 ============
/**
 * 直接调用reboys.cn的搜索API
 * 使用前端已有的API-TOKEN
 */
async function searchAPI(keyword, page = 1) {
  const url = `${SITE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  
  log(`[API] 调用搜索: ${keyword} (第${page}页)`);
  
  try {
    // 使用内置的$fetch（如果环境支持）或原生fetch
    let response;
    
    if (typeof $fetch !== 'undefined') {
      response = await $fetch.get(url, {
        headers: {
          'API-TOKEN': API_TOKEN,
          'User-Agent': UA
        }
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      return data;
    } else {
      // 浏览器环境
      const fetchResp = await fetch(url, {
        headers: {
          'API-TOKEN': API_TOKEN,
          'User-Agent': UA
        }
      });
      return await fetchResp.json();
    }
  } catch (e) {
    log(`[API] ❌ 搜索异常: ${e.message}`);
    return { code: -1, message: e.message, data: {} };
  }
}

/**
 * 从资源详情页提取真实网盘链接
 */
async function extractResourceLink(resourceUrl) {
  log(`[Extract] 提取资源链接: ${resourceUrl}`);
  
  try {
    let pageData;
    
    if (typeof $fetch !== 'undefined') {
      pageData = await $fetch.get(resourceUrl, {
        headers: { 'User-Agent': UA }
      });
      if (typeof pageData !== 'string') {
        pageData = JSON.stringify(pageData);
      }
    } else {
      const resp = await fetch(resourceUrl, {
        headers: { 'User-Agent': UA }
      });
      pageData = await resp.text();
    }
    
    // 方案1: 查找href中的网盘链接
    const panUrlMatch = pageData.match(
      /(https?:\/\/(pan\.quark\.cn|aliyundrive\.com|pan\.baidu\.com|115\.com|thunder:\/\/)[^\s"'<>]+)/gi
    );
    
    if (panUrlMatch && panUrlMatch.length > 0) {
      const panUrl = panUrlMatch[0];
      log(`[Extract] ✓ 找到网盘链接: ${panUrl.substring(0, 50)}...`);
      return {
        success: true,
        url: panUrl,
        type: detectPanType(panUrl)
      };
    }
    
    // 方案2: 查找常见的跳转链接
    const linkMatch = pageData.match(/onclick="[^"]*window\.open\('([^']+)'\)/);
    if (linkMatch) {
      const url = linkMatch[1];
      log(`[Extract] ✓ 找到跳转链接`);
      return {
        success: true,
        url: url,
        type: detectPanType(url)
      };
    }
    
    log(`[Extract] ⚠ 未找到直接链接，返回资源页面`);
    return {
      success: false,
      url: resourceUrl,
      type: '资源页面',
      message: '请在资源页面获取'
    };
    
  } catch (e) {
    log(`[Extract] ❌ 异常: ${e.message}`);
    return {
      success: false,
      url: resourceUrl,
      type: '资源页面',
      message: `提取失败: ${e.message}`
    };
  }
}

function detectPanType(url) {
  if (url.includes('quark')) return '夸克网盘';
  if (url.includes('aliyun')) return '阿里云盘';
  if (url.includes('baidu')) return '百度网盘';
  if (url.includes('115')) return '115网盘';
  if (url.includes('thunder')) return '迅雷网盘';
  return '网盘链接';
}

// ============ 插件接口 ============

async function getConfig() {
  log("==== 插件初始化 V2.0.0 ====");
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
  const { id: categoryName, page = 1 } = ext;
  
  log(`[getCards] 分类: ${categoryName}, 页: ${page}`);
  
  try {
    // 调用API获取分类数据
    const apiResp = await searchAPI(`分类:${categoryName}`, page);
    
    if (apiResp.code !== 0 || !apiResp.data) {
      return jsonify({ list: [] });
    }
    
    const cards = (apiResp.data.results || []).map(item => ({
      vod_id: `/d/${item.id}.html`,
      vod_name: item.title || item.name || '',
      vod_pic: item.image || FALLBACK_PIC,
      vod_remarks: item.source_category_id ? `[${item.source_category_id}]` : '',
      ext: {
        url: item.links ? item.links[0].url : `/d/${item.id}.html`
      }
    }));
    
    log(`[getCards] ✓ 获得 ${cards.length} 个卡片`);
    return jsonify({ list: cards });
    
  } catch (e) {
    log(`[getCards] ❌ ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  
  if (!text) {
    return jsonify({ list: [] });
  }
  
  log(`[search] 关键词: "${text}", 页: ${page}`);
  
  try {
    // 直接调用reboys的搜索API
    const apiResp = await searchAPI(text, page);
    
    if (apiResp.code !== 0 || !apiResp.data) {
      log(`[search] API返回: code=${apiResp.code}, msg=${apiResp.message}`);
      return jsonify({ list: [] });
    }
    
    const results = apiResp.data.data?.results || [];
    
    const cards = results
      .filter(item => {
        // 过滤掉迅雷和百度
        const source = item.source_name || '';
        return !source.includes('迅雷') && !source.includes('百度');
      })
      .map(item => ({
        vod_id: item.id || Math.random(),
        vod_name: item.title || item.name || '未知资源',
        vod_pic: FALLBACK_PIC,
        vod_remarks: `[${item.source_name || '未知'}]`,
        ext: {
          url: item.links ? item.links[0].url : '',
          resourceId: item.id,
          sourceType: getPanType(item.source_name || '').id
        }
      }));
    
    log(`[search] ✓ 获得 ${cards.length} 个结果`);
    return jsonify({ list: cards });
    
  } catch (e) {
    log(`[search] ❌ ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url, resourceId } = ext;
  
  if (!url && !resourceId) {
    return jsonify({ list: [] });
  }
  
  log(`[getTracks] 获取详情: ${url || resourceId}`);
  
  try {
    // 首先尝试直接提取
    const result = await extractResourceLink(url);
    
    let trackUrl = result.url;
    let trackName = result.type;
    
    // 如果提取失败且有resourceId，尝试通过API获取
    if (!result.success && resourceId) {
      log(`[getTracks] 尝试通过API获取资源 ${resourceId}`);
      const apiResp = await searchAPI(`id:${resourceId}`);
      if (apiResp.data && apiResp.data.links && apiResp.data.links[0]) {
        trackUrl = apiResp.data.links[0].url;
      }
    }
    
    return jsonify({
      list: [{
        title: '获取成功',
        tracks: [{
          name: trackName,
          pan: trackUrl,
          ext: {}
        }]
      }]
    });
    
  } catch (e) {
    log(`[getTracks] ❌ ${e.message}`);
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
async function init() { return getConfig(); }

async function home() {
  const c = await getConfig();
  const config = JSON.parse(c);
  return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id, page: pg || 1 });
}

async function detail(id) {
  log(`[detail] ${id}`);
  return getTracks({ url: id });
}

async function play(flag, id) {
  return jsonify({ url: id });
}

log('==== V2.0.0 加载完成 (纯前端) ====');
