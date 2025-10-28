/**
 * reboys.cn 网盘资源聚合脚本 - V3.0.0 完整重构版
 *
 * 更新日志 (V3.0.0):
 * 1. [重构] 彻底放弃硬编码，采用动态获取 API_TOKEN 和 PHPSESSID 的方式。
 * 2. [核心] 新增 getDynamicCredentials 函数，用于模拟访问页面并从HTML中提取动态凭证。
 * 3. [修复] searchAPI 函数现在会先调用 getDynamicCredentials 获取凭证，再发起API请求。
 * 4. [架构] 完美适配 reboys.cn 的前后端分离及动态API签名机制。
 * 5. [稳定] 大幅提高脚本的长期可用性，不再因Token或Cookie过期而失效。
 */

const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";

// 全局变量 ，用于缓存动态获取的凭证，避免重复请求
let dynamicCredentials = {
  apiToken: '',
  cookie: '',
  lastFetchTime: 0,
};

// ============ 日志函数 ============
function log(msg) {
  const logMsg = `[reboys V3] ${msg}`;
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
    catch (e) { log(`argsify解析失败: ${e.message}`); return {}; }
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
    if (config.regex.test(typeStr)) return { name, id: config.id };
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
// 注意：此实现依赖一个能够返回完整Response对象的fetch
async function httpGet(url, headers = {}, getFullResponse = false ) {
  log(`[HTTP] GET: ${url}`);
  try {
    // 优先使用原生fetch，因为它能提供完整的Response对象
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url, { method: 'GET', headers: headers });
      if (getFullResponse) {
        return response; // 返回完整的Response对象
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      const text = await response.text();
      try { return JSON.parse(text); } catch(e) { return text; }
    }

    // 如果原生fetch不可用，回退到App环境的$fetch
    if (typeof $fetch !== 'undefined' && $fetch.get) {
        // $fetch可能不支持返回完整响应，这会影响Cookie获取
        log('[HTTP] 警告: 使用$fetch，可能无法获取响应头(Cookie)');
        const response = await $fetch.get(url, { headers });
        if (typeof response === 'string') {
            try { return JSON.parse(response); } catch (e) { return response; }
        }
        return response;
    }
    
    throw new Error('没有可用的HTTP客户端');
  } catch (e) {
    log(`[HTTP] 请求失败: ${e.message}`);
    throw e;
  }
}

// ============ [核心] 动态凭证获取模块 ============
async function getDynamicCredentials(keyword) {
  const now = Date.now();
  if (dynamicCredentials.apiToken && dynamicCredentials.cookie && (now - dynamicCredentials.lastFetchTime < 300000)) {
    log('[Auth] 使用缓存的凭证');
    return dynamicCredentials;
  }

  log('[Auth] 开始动态获取新凭证...');
  const url = `${SITE_URL}/s/${encodeURIComponent(keyword || '电影')}.html`;
  log(`[Auth] 访问页面: ${url}`);

  try {
    // 请求完整Response对象以获取响应头
    const response = await httpGet(url, { 'User-Agent': UA }, true );

    if (!response.ok) {
      throw new Error(`HTTP状态码: ${response.status}`);
    }

    const setCookieHeader = response.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/PHPSESSID=[^;]+/);
    const cookie = cookieMatch ? cookieMatch[0] : (dynamicCredentials.cookie || ''); // 如果没获取到新的，尝试用旧的
    if (!cookie) {
      log('[Auth] 警告: 未能从响应头中获取PHPSESSID。');
    } else {
      log(`[Auth] ✓ 成功获取Cookie: ${cookie}`);
    }

    const html = await response.text();
    const tokenMatch = html.match(/const apiToken = "([^"]+)"/);
    const apiToken = tokenMatch ? tokenMatch[1] : '';

    if (!apiToken) {
      throw new Error('未能从HTML中提取到apiToken');
    }
    log(`[Auth] ✓ 成功提取apiToken: ${apiToken.substring(0, 30)}...`);

    dynamicCredentials = { apiToken, cookie, lastFetchTime: now };
    return dynamicCredentials;

  } catch (e) {
    log(`[Auth] 动态获取凭证失败: ${e.message}`);
    return { apiToken: '', cookie: '' };
  }
}

// ============ API 调用层(重构) ============
async function searchAPI(keyword, page = 1) {
  log(`[API] 开始处理搜索: "${keyword}"`);

  const creds = await getDynamicCredentials(keyword);
  if (!creds.apiToken) {
    return { code: -1, message: '获取动态凭证失败，无法继续请求API', data: null };
  }

  const apiUrl = `${SITE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  log(`[API] 使用新凭证请求: ${apiUrl}`);

  try {
    const headers = {
      'API-TOKEN': creds.apiToken,
      'User-Agent': UA,
      'Accept': 'application/json',
      'Referer': `${SITE_URL}/s/${encodeURIComponent(keyword)}.html` // 添加Referer头
    };
    if (creds.cookie) {
      headers['Cookie'] = creds.cookie;
    }

    const data = await httpGet(apiUrl, headers );

    log(`[API] 返回数据类型: ${typeof data}`);
    if (typeof data === 'string') {
      try { return JSON.parse(data); }
      catch(e) { 
        log(`[API] JSON解析失败: ${data.substring(0, 100)}...`);
        return { code: -1, message: 'API返回非JSON字符串', data: null };
      }
    }
    return data;
  } catch (e) {
    log(`[API] 请求异常: ${e.message}`);
    return { code: -1, message: e.message, data: null };
  }
}

// ============ 插件接口 ============
async function getConfig() {
  log("==== 初始化 V3.0.0 ====");
  return jsonify({
    ver: 1, title: 'reboys资源聚合', site: SITE_URL, cookie: '',
    tabs: [
      { name: '短剧', ext: { id: '短剧' } }, { name: '电影', ext: { id: '电影' } },
      { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } },
      { name: '综艺', ext: { id: '综艺' } }
    ]
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { id: categoryName = '电影', page = 1 } = ext;
  try {
    const apiResp = await searchAPI(categoryName, page);
    if (apiResp.code !== 0 || !apiResp.data) {
      log(`[getCards] API失败: ${apiResp.message || '无数据'}`);
      return jsonify({ list: [] });
    }
    const results = apiResp.data?.data?.data?.results || [];
    log(`[getCards] 解析到 ${results.length} 条结果`);
    const cards = results.filter(item => item && item.title).map(item => ({
      vod_id: item.id.toString(),
      vod_name: item.title,
      vod_pic: item.image || FALLBACK_PIC,
      vod_remarks: `[${item.source_name || '未知'}]`,
      ext: { url: (item.links && item.links[0]?.url) || `${SITE_URL}/d/${item.id}.html` }
    }));
    return jsonify({ list: cards });
  } catch (e) {
    log(`[getCards] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function search(ext) {
    ext = argsify(ext);
    const { text = '', page = 1 } = ext;
    if (!text.trim()) return jsonify({ list: [] });
    try {
        const apiResp = await searchAPI(text, page);
        if (apiResp.code !== 0 || !apiResp.data) {
            log(`[search] API失败: ${apiResp.message || '无数据'}`);
            return jsonify({ list: [] });
        }
        const results = apiResp.data?.data?.data?.results || [];
        log(`[search] 解析到 ${results.length} 条结果`);
        const cards = results.filter(item => item && item.title).map(item => ({
            vod_id: item.id.toString(),
            vod_name: item.title,
            vod_pic: FALLBACK_PIC,
            vod_remarks: `[${item.source_name || '未知来源'}]`,
            ext: { url: (item.links && item.links[0]?.url) || `${SITE_URL}/d/${item.id}.html` }
        }));
        return jsonify({ list: cards });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) { log(`[getTracks] 缺少URL`); return jsonify({ list: [] }); }
  log(`[getTracks] URL=${url}`);
  // 详情页获取逻辑可能也需要动态凭证，但其逻辑与搜索不同，暂保持简单
  // 如果此部分也失效，需要用同样思路重构
  return jsonify({ list: [{ title: '请在新页面手动获取', tracks: [{ name: '资源页面', pan: url, ext: {} }] }] });
}

// ============ 兼容接口与导出 ============
async function init(cfg) { return await getConfig(); }
async function home(filter) { const c = JSON.parse(await getConfig()); return jsonify({ class: c.tabs, filters: {} }); }
async function category(tid, pg) { return await getCards({ id: tid, page: pg || 1 }); }
async function detail(id) { return await getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== V3.0.0 加载完成 ====');
if (typeof globalThis !== 'undefined') {
  globalThis.init = init; globalThis.home = home; globalThis.category = category;
  globalThis.detail = detail; globalThis.play = play; globalThis.search = search;
}
