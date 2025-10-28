/**
 * reboys.cn 网盘资源聚合脚本 - V3.0.0 完全重构版
 * 
 * 重大更新:
 * 1. 放弃API调用,改用网页爬取
 * 2. 解析HTML获取资源列表
 * 3. 修复UI显示和搜索功能
 */

const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// ============ 工具函数 ============
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
    catch (e) { return {}; }
  }
  return ext || {};
}

function jsonify(data) { 
  return JSON.stringify(data); 
}

// ============ HTTP 请求 ============
async function httpGet(url, headers = {}) {
  log(`[HTTP] GET: ${url}`);
  
  try {
    // 优先使用 $fetch
    if (typeof $fetch !== 'undefined' && $fetch.get) {
      const response = await $fetch.get(url, { 
        headers: Object.assign({ 'User-Agent': UA }, headers)
      });
      return response;
    }
    
    // 回退到 fetch
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url, { 
        method: 'GET',
        headers: Object.assign({ 'User-Agent': UA }, headers)
      });
      return await response.text();
    }
    
    throw new Error('没有可用的HTTP客户端');
  } catch (e) {
    log(`[HTTP] 失败: ${e.message}`);
    throw e;
  }
}

// ============ HTML 解析 ============
function parseResourceCards(html) {
  const cards = [];
  
  try {
    // 匹配模式: <a href="/s/资源名.html"> ... <img src="图片URL"> ... 资源名 ...
    // 修改正则以匹配实际的HTML结构
    const linkPattern = /<a[^>]*href="(\/s\/[^"]+\.html)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
    
    let match;
    let count = 0;
    
    while ((match = linkPattern.exec(html)) && count < 50) {
      const detailUrl = match[1];
      const picUrl = match[2];
      
      // 从URL中提取资源名 (例如: /s/她靠弹幕翻身.html -> 她靠弹幕翻身)
      const nameMatch = detailUrl.match(/\/s\/(.+?)\.html/);
      const resourceName = nameMatch ? decodeURIComponent(nameMatch[1]) : '未知资源';
      
      cards.push({
        vod_id: detailUrl,
        vod_name: resourceName,
        vod_pic: picUrl.startsWith('http') ? picUrl : `${SITE_URL}${picUrl}`,
        vod_remarks: '',
        ext: {
          url: `${SITE_URL}${detailUrl}`
        }
      });
      
      count++;
    }
    
    log(`[Parse] 解析出 ${cards.length} 个资源`);
  } catch (e) {
    log(`[Parse] 解析失败: ${e.message}`);
  }
  
  return cards;
}

function extractPanLinks(html) {
  const links = [];
  
  try {
    // 匹配各种网盘链接
    const patterns = [
      // 夸克网盘
      /(https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9]+)/gi,
      // 阿里云盘
      /(https?:\/\/www\.aliyundrive\.com\/s\/[a-zA-Z0-9]+)/gi,
      /(https?:\/\/www\.alipan\.com\/s\/[a-zA-Z0-9]+)/gi,
      // 百度网盘
      /(https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9\-_]+)/gi,
      // 通用网盘链接
      /(https?:\/\/[^\s<>"']+\.(com|cn)\/s\/[a-zA-Z0-9\-_]+)/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        if (!links.includes(url)) {
          links.push(url);
        }
      }
    }
    
    log(`[Extract] 提取到 ${links.length} 个网盘链接`);
  } catch (e) {
    log(`[Extract] 提取失败: ${e.message}`);
  }
  
  return links;
}

function detectPanType(url) {
  if (!url) return '资源链接';
  if (url.includes('quark')) return '夸克网盘';
  if (url.includes('aliyun') || url.includes('alipan')) return '阿里云盘';
  if (url.includes('baidu')) return '百度网盘';
  if (url.includes('115')) return '115网盘';
  if (url.includes('xunlei') || url.includes('thunder')) return '迅雷网盘';
  return '网盘链接';
}

// ============ 核心功能 ============

/**
 * 获取首页或分类资源
 */
async function fetchResources(keyword = '', page = 1) {
  log(`[Fetch] 关键词="${keyword}" 页=${page}`);
  
  try {
    let url;
    if (keyword && keyword.trim()) {
      // 搜索URL
      url = `${SITE_URL}/search.html?wd=${encodeURIComponent(keyword)}&page=${page}`;
    } else {
      // 首页
      url = page === 1 ? SITE_URL : `${SITE_URL}/?page=${page}`;
    }
    
    const html = await httpGet(url);
    const cards = parseResourceCards(html);
    
    return cards;
  } catch (e) {
    log(`[Fetch] 失败: ${e.message}`);
    return [];
  }
}

/**
 * 获取资源详情页的网盘链接
 */
async function fetchResourceDetail(detailUrl) {
  log(`[Detail] 获取: ${detailUrl}`);
  
  try {
    const html = await httpGet(detailUrl);
    const links = extractPanLinks(html);
    
    if (links.length === 0) {
      log(`[Detail] 未找到网盘链接`);
      return {
        success: false,
        message: '未找到网盘链接',
        url: detailUrl
      };
    }
    
    log(`[Detail] 找到 ${links.length} 个链接`);
    return {
      success: true,
      links: links
    };
    
  } catch (e) {
    log(`[Detail] 失败: ${e.message}`);
    return {
      success: false,
      message: e.message,
      url: detailUrl
    };
  }
}

// ============ 插件接口 ============

async function getConfig() {
  log("==== 初始化 V3.0.0 ====");
  
  return jsonify({
    ver: 1,
    title: 'reboys资源聚合',
    site: SITE_URL,
    cookie: '',
    tabs: [
      { name: '首页', ext: { id: '' } },
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
  const { id: keyword = '', page = 1 } = ext;
  
  log(`[getCards] 关键词="${keyword}" 页=${page}`);
  
  try {
    const cards = await fetchResources(keyword, page);
    
    if (cards.length === 0) {
      log(`[getCards] 无结果`);
    }
    
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
  
  log(`[search] 搜索="${text}" 页=${page}`);
  
  try {
    const cards = await fetchResources(text, page);
    
    log(`[search] 返回 ${cards.length} 个结果`);
    return jsonify({ list: cards });
  } catch (e) {
    log(`[search] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  
  if (!url) {
    log(`[getTracks] 缺少URL`);
    return jsonify({ list: [] });
  }
  
  log(`[getTracks] 获取详情: ${url}`);
  
  try {
    const result = await fetchResourceDetail(url);
    
    if (!result.success) {
      return jsonify({
        list: [{
          title: '获取失败',
          tracks: [{
            name: result.message || '未知错误',
            pan: result.url || url,
            ext: {}
          }]
        }]
      });
    }
    
    // 返回所有找到的网盘链接
    const tracks = result.links.map(link => ({
      name: detectPanType(link),
      pan: link,
      ext: {}
    }));
    
    return jsonify({
      list: [{
        title: '网盘链接',
        tracks: tracks
      }]
    });
    
  } catch (e) {
    log(`[getTracks] 异常: ${e.message}`);
    return jsonify({
      list: [{
        title: '获取失败',
        tracks: [{
          name: '错误',
          pan: url,
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
  
  let categoryId = '';
  let pageNum = pg || 1;
  
  if (typeof tid === 'object' && tid.id !== undefined) {
    categoryId = tid.id;
  } else if (typeof tid === 'string') {
    categoryId = tid;
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
log('==== V3.0.0 加载完成 ====');

if (typeof globalThis !== 'undefined') {
  globalThis.init = init;
  globalThis.home = home;
  globalThis.category = category;
  globalThis.detail = detail;
  globalThis.play = play;
  globalThis.search = search;
}
