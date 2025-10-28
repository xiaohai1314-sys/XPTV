/**
 * reboys.cn 网盘资源聚合脚本 - V4.0.0 最终版 (带持久化缓存)
 *
 * 更新日志 (V4.0.0):
 * 1. [核心] 引入持久化缓存，解决了前端脚本无状态执行环境下的缓存失效问题。
 * 2. [架构] 使用一个通用的 storage 对象来读写缓存，方便适配不同App环境的存储API。
 * 3. [性能] 大幅提升了连续操作（如翻页、切换分类）的响应速度，显著改善用户体验。
 * 4. [稳定] 这是在当前架构下能实现的最稳定、最高效的最终版本。
 */

const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/favicon.ico";
const CREDENTIALS_KEY = 'reboys_credentials_cache'; // 用于持久化存储的键名

// ============ [适配层] App持久化存储适配器 ============
// !! 重要 !!: 您需要根据您App环境的实际API来修改此部分 。
const storage = {
  /**
   * @param {string} key 键
   * @param {string} value 值 (必须是字符串)
   */
  setItem: (key, value) => {
    // 示例1: 如果环境支持 localStorage
    try { localStorage.setItem(key, value); } catch(e) { log('localStorage不可用'); }
    
    // 示例2: 如果环境是某种特定的setProperty函数
    // try { someApp.setProperty(key, value); } catch(e) { log('setProperty不可用'); }
  },
  /**
   * @param {string} key 键
   * @returns {string | null}
   */
  getItem: (key) => {
    // 示例1:
    try { return localStorage.getItem(key); } catch(e) { return null; }

    // 示例2:
    // try { return someApp.getProperty(key); } catch(e) { return null; }
  }
};

// ============ 日志与其他辅助函数 (无变化) ============
function log(msg) { /* ... */ }
function argsify(ext) { /* ... */ }
function jsonify(data) { /* ... */ }
// ... (此处省略其他无变化辅助函数以保持简洁)


// ============ HTTP 请求封装 (无变化) ============
async function httpGet(url, headers = {}, getFullResponse = false ) { /* ... */ }


// ============ [核心] 动态凭证获取模块 (使用持久化缓存) ============
async function getDynamicCredentials(keyword) {
  const now = Date.now();
  
  // 1. 尝试从持久化存储中读取缓存
  const cachedDataStr = storage.getItem(CREDENTIALS_KEY);
  if (cachedDataStr) {
    try {
      const cachedData = JSON.parse(cachedDataStr);
      // 检查缓存是否在5分钟有效期内
      if (cachedData.apiToken && (now - cachedData.lastFetchTime < 300000)) {
        log('[Auth] 使用持久化缓存的凭证');
        return cachedData;
      }
    } catch(e) {
      log('[Auth] 解析缓存失败');
    }
  }

  log('[Auth] 缓存无效或不存在，开始动态获取新凭证...');
  const url = `${SITE_URL}/s/${encodeURIComponent(keyword || '电影')}.html`;
  log(`[Auth] 访问页面: ${url}`);

  try {
    const response = await httpGet(url, { 'User-Agent': UA }, true );
    if (!response.ok) throw new Error(`HTTP状态码: ${response.status}`);

    const setCookieHeader = response.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/PHPSESSID=[^;]+/);
    const cookie = cookieMatch ? cookieMatch[0] : '';
    if (cookie) log(`[Auth] ✓ 成功获取Cookie: ${cookie}`);
    else log('[Auth] 警告: 未能从响应头中获取PHPSESSID。');

    const html = await response.text();
    const tokenMatch = html.match(/const apiToken = "([^"]+)"/);
    if (!tokenMatch || !tokenMatch[1]) throw new Error('未能从HTML中提取到apiToken');
    const apiToken = tokenMatch[1];
    log(`[Auth] ✓ 成功提取apiToken`);

    // 2. 将新获取的凭证存入持久化存储
    const newCredentials = { apiToken, cookie, lastFetchTime: now };
    storage.setItem(CREDENTIALS_KEY, JSON.stringify(newCredentials));
    log('[Auth] ✓ 新凭证已存入持久化缓存');

    return newCredentials;

  } catch (e) {
    log(`[Auth] 动态获取凭证失败: ${e.message}`);
    return { apiToken: '', cookie: '' };
  }
}

// ============ API 调用层 (无变化) ============
async function searchAPI(keyword, page = 1) { /* ... */ }

// ============ 插件接口 (无变化) ============
async function getConfig() { /* ... */ }
async function getCards(ext) { /* ... */ }
async function search(ext) { /* ... */ }
async function getTracks(ext) { /* ... */ }

// ============ 兼容接口与导出 (无变化) ============
async function init(cfg) { /* ... */ }
async function home(filter) { /* ... */ }
async function category(tid, pg) { /* ... */ }
async function detail(id) { /* ... */ }
async function play(flag, id) { /* ... */ }

// =======================================================
// 为了保证代码的完整性，请将下面省略的函数实现补充完整
// =======================================================
function log(msg) { const logMsg = `[reboys V4] ${msg}`; try { if (typeof $log !== 'undefined') $log(logMsg); else console.log(logMsg); } catch (_) { console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { log(`argsify解析失败: ${e.message}`); return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
async function httpGet(url, headers = {}, getFullResponse = false ) { log(`[HTTP] GET: ${url}`); try { if (typeof fetch !== 'undefined') { const response = await fetch(url, { method: 'GET', headers: headers }); if (getFullResponse) return response; const contentType = response.headers.get('content-type'); if (contentType && contentType.includes('application/json')) return await response.json(); const text = await response.text(); try { return JSON.parse(text); } catch(e) { return text; } } if (typeof $fetch !== 'undefined' && $fetch.get) { log('[HTTP] 警告: 使用$fetch，可能无法获取响应头(Cookie)'); const response = await $fetch.get(url, { headers }); if (typeof response === 'string') { try { return JSON.parse(response); } catch (e) { return response; } } return response; } throw new Error('没有可用的HTTP客户端'); } catch (e) { log(`[HTTP] 请求失败: ${e.message}`); throw e; } }
async function searchAPI(keyword, page = 1) { log(`[API] 开始处理搜索: "${keyword}"`); const creds = await getDynamicCredentials(keyword); if (!creds.apiToken) return { code: -1, message: '获取动态凭证失败', data: null }; const apiUrl = `${SITE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`; log(`[API] 使用凭证请求: ${apiUrl}`); try { const headers = { 'API-TOKEN': creds.apiToken, 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${SITE_URL}/s/${encodeURIComponent(keyword)}.html` }; if (creds.cookie) headers['Cookie'] = creds.cookie; const data = await httpGet(apiUrl, headers ); if (typeof data === 'string') { try { return JSON.parse(data); } catch(e) { log(`[API] JSON解析失败`); return { code: -1, message: 'API返回非JSON字符串', data: null }; } } return data; } catch (e) { log(`[API] 请求异常: ${e.message}`); return { code: -1, message: e.message, data: null }; } }
async function getConfig() { log("==== 初始化 V4.0.0 ===="); return jsonify({ ver: 1, title: 'reboys资源聚合', site: SITE_URL, cookie: '', tabs: [{ name: '短剧', ext: { id: '短剧' } }, { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } }, { name: '综艺', ext: { id: '综艺' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id: categoryName = '电影', page = 1 } = ext; try { const apiResp = await searchAPI(categoryName, page); if (apiResp.code !== 0 || !apiResp.data) { log(`[getCards] API失败: ${apiResp.message || '无数据'}`); return jsonify({ list: [] }); } const results = apiResp.data?.data?.data?.results || []; log(`[getCards] 解析到 ${results.length} 条结果`); const cards = results.filter(item => item && item.title).map(item => ({ vod_id: item.id.toString(), vod_name: item.title, vod_pic: item.image || FALLBACK_PIC, vod_remarks: `[${item.source_name || '未知'}]`, ext: { url: (item.links && item.links[0]?.url) || `${SITE_URL}/d/${item.id}.html` } })); return jsonify({ list: cards }); } catch (e) { log(`[getCards] 异常: ${e.message}`); return jsonify({ list: [] }); } }
async function search(ext) { ext = argsify(ext); const { text = '', page = 1 } = ext; if (!text.trim()) return jsonify({ list: [] }); try { const apiResp = await searchAPI(text, page); if (apiResp.code !== 0 || !apiResp.data) { log(`[search] API失败: ${apiResp.message || '无数据'}`); return jsonify({ list: [] }); } const results = apiResp.data?.data?.data?.results || []; log(`[search] 解析到 ${results.length} 条结果`); const cards = results.filter(item => item && item.title).map(item => ({ vod_id: item.id.toString(), vod_name: item.title, vod_pic: FALLBACK_PIC, vod_remarks: `[${item.source_name || '未知来源'}]`, ext: { url: (item.links && item.links[0]?.url) || `${SITE_URL}/d/${item.id}.html` } })); return jsonify({ list: cards }); } catch (e) { log(`[search] 异常: ${e.message}`); return jsonify({ list: [] }); } }
async function getTracks(ext) { ext = argsify(ext); const { url } = ext; if (!url) { log(`[getTracks] 缺少URL`); return jsonify({ list: [] }); } log(`[getTracks] URL=${url}`); return jsonify({ list: [{ title: '请在新页面手动获取', tracks: [{ name: '资源页面', pan: url, ext: {} }] }] }); }
async function init(cfg) { return await getConfig(); }
async function home(filter) { const c = JSON.parse(await getConfig()); return jsonify({ class: c.tabs, filters: {} }); }
async function category(tid, pg) { return await getCards({ id: tid, page: pg || 1 }); }
async function detail(id) { return await getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
if (typeof globalThis !== 'undefined') { globalThis.init = init; globalThis.home = home; globalThis.category = category; globalThis.detail = detail; globalThis.play = play; globalThis.search = search; }
