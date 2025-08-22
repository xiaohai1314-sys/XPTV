/**
 * HDHive 影视资料库 - App插件脚本 (Server Action 直连版 V2.0)
 * 
 * 版本说明:
 * - 【最终架构】为 HDHive.com 量身打造，完全基于API和Server Action交互，告别HTML解析。
 * - 【精准实现】所有功能（分类、详情、搜索）均通过调用官方接口实现，速度快、数据准、稳定性高。
 * - 【核心详情】详情页采用“两步走”策略：先通过主API获取数字ID，再调用Server Action获取资源，并严格筛选四种指定网盘。
 * - 【缓存优化】完美集成了高级搜索缓存机制，切换关键词自动刷新，重复搜索和翻页实现秒开，体验流畅。
 * - 【配置核心】请务必在下方的【用户配置区】填入您自己的有效Cookie。
 */

// --- 配置区 ---
const SITE_URL = "https://hdhive.com";
const API_BASE_URL = "https://hdhive.com/api";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://hdhive.com/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请将下面的字符串替换为您从浏览器获取的完整Cookie
const COOKIE = 'csrf_access_token=ed91378d-05d4-452c-8b3b-2053ddd121a7;token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NTg1MTg4MCwianRpIjoiZGYxZmE3MzItZjE4Mi00OWM3LTgxN2QtNzc5N2FkOGUyZGUzIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6NDM4ODgsIm5iZiI6MTc1NTg1MTg4MCwiY3NyZiI6ImVkOTEzNzhkLTA1ZDQtNDUyYy04YjNiLTIwNTNkZGQxMjFhNyIsImV4cCI6MTc1NjQ1NjY4MH0.e9uwSBnnMaeFmJ8TmTSWs4j6jwIOAf_NSoM4Yb1aV88;';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) { 
    try { $log(`[HDHive 插件 V2.0] ${msg}`); } 
    catch (_) { console.log(`[HDHive 插件 V2.0] ${msg}`); } 
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(data) { return JSON.stringify(data); }
function getTokenFromCookie(cookie, key) {
    const match = cookie.match(new RegExp(`${key}=([^;]+)`));
    return match ? match[1] : '';
}

// --- 网络请求 ---
async function fetchApi(method, url, params = {}, body = null, additionalHeaders = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_HERE")) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const finalUrl = new URL(url);
    if (method === 'GET') {
        Object.keys(params).forEach(key => finalUrl.searchParams.append(key, params[key]));
    }
    const csrfToken = getTokenFromCookie(COOKIE, 'csrf_access_token');
    const authToken = getTokenFromCookie(COOKIE, 'token');
    const headers = {
        'User-Agent': UA, 'Cookie': COOKIE, 'Authorization': `Bearer ${authToken}`,
        'x-csrf-token': csrfToken, 'Content-Type': 'application/json', ...additionalHeaders
    };
    log(`请求: ${method} ${finalUrl.toString()}`);
    const options = { headers };
    if (method === 'POST') {
        options.body = JSON.stringify(body);
        return (await $fetch.post(finalUrl.toString(), options.body, options)).data;
    }
    return (await $fetch.get(finalUrl.toString(), options)).data;
}

// --- 核心功能函数 ---

async function getConfig() {
  log("插件初始化 (Server Action 直连版 V2.0)");
  return jsonify({
    ver: 1, title: 'HDHive', site: SITE_URL,
    tabs: [
      { name: '电影', ext: { type: 'movie' } },
      { name: '剧集', ext: { type: 'tv' } },
      { name: '音乐', ext: { type: 'music' } },
    ],
  });
}

function parseJsonToCards(jsonData) {
    const items = jsonData.results || (jsonData.data ? jsonData.data : []);
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => {
        const type = item.type || item.media_type || 'movie';
        const slug = item.slug || item.id;
        return {
            vod_id: `${type}/${slug}`,
            vod_name: item.title || item.name,
            vod_pic: item.poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : FALLBACK_PIC ),
            vod_remarks: item.release_date || item.first_air_date || '',
            ext: { slug: slug, type: type }
        };
    });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, type } = ext;
  try {
    const jsonData = await fetchApi('GET', `${API_BASE_URL}/media`, { type: type, page: page, per_page: 24 });
    const cards = parseJsonToCards(jsonData);
    return jsonify({ list: cards });
  } catch(e) {
    log(`获取分类列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const { slug, type } = ext;
    if (!slug || !type) return jsonify({ list: [] });
    log(`开始处理详情页: type=${type}, slug=${slug}`);
    try {
        const mainData = await fetchApi('GET', `${API_BASE_URL}/${type}/${slug}`);
        const mediaId = mainData.data.id;
        if (!mediaId) throw new Error("未能从主数据中获取到media_id");
        log(`获取到 Media ID: ${mediaId}`);

        // 调用Server Action获取资源
        const resourceBody = [{ [`${type}_id`]: mediaId, sort_by: "is_admin", sort_order: "descend", per_page: 10000 }];
        const resourceHeaders = { 'next-action': '6c729f84f8333264305bb8516ed5ae3bc9ed1765' };
        const rawResourceData = await fetchApi('POST', `${SITE_URL}/${type}/${slug}`, {}, resourceBody, resourceHeaders);
        
        // Server Action返回的数据是流式文本，需要解析
        const lines = rawResourceData.split('\n');
        const jsonDataLine = lines.find(line => line.startsWith('2:'));
        if (!jsonDataLine) throw new Error("在Server Action响应中未找到资源数据");
        const resourceData = JSON.parse(jsonDataLine.substring(2));

        if (!resourceData || !Array.isArray(resourceData.data)) throw new Error("资源API返回格式不正确");

        const allowedDrivers = { 'Aliyundrive': '阿里云盘', 'Quark': '夸克网盘', 'Ctpan': '天翼云盘', '115': '115网盘' };
        const groupedTracks = {};
        resourceData.data.forEach(resource => {
            if (allowedDrivers[resource.driver]) {
                if (!groupedTracks[resource.driver]) groupedTracks[resource.driver] = [];
                groupedTracks[resource.driver].push({ name: resource.title, pan: resource.link, ext: {} });
            }
        });
        log(`资源筛选与分组完成: ${Object.keys(groupedTracks).join(', ')}`);

        const finalList = Object.keys(allowedDrivers).map(driver => {
            if (groupedTracks[driver] && groupedTracks[driver].length > 0) {
                return { title: allowedDrivers[driver], tracks: groupedTracks[driver] };
            }
            return null;
        }).filter(Boolean);

        if (finalList.length === 0) {
            log("未找到指定类型的网盘资源。");
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "未找到指定类型的网盘资源", pan: '', ext: {} }] }] });
        }
        return jsonify({ list: finalList });
    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie或网络", pan: '', ext: {} }] }] });
    }
}

const searchCache = {};

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = ext.page || 1;
  if (!text) return jsonify({ list: [] });

  if (searchCache.keyword !== text) {
    log(`新关键词 "${text}"，清空旧缓存。`);
    searchCache.keyword = text;
    searchCache.resultsByPage = {};
    searchCache.pageCount = 0;
  }

  if (searchCache.resultsByPage[page]) {
    log(`从缓存中获取搜索结果，关键词: "${text}", 页码: ${page}`);
    return jsonify({ list: searchCache.resultsByPage[page], pagecount: searchCache.pageCount });
  }

  log(`缓存未命中，开始网络搜索，关键词: "${text}", 页码: ${page}`);
  try {
    const requestBody = ["/api/proxy/tmdb/3/search/multi", { query: text, page: page.toString(), language: "zh-CN" }];
    const jsonData = await fetchApi('POST', `${API_BASE_URL}/search`, {}, requestBody);
    const cards = parseJsonToCards(jsonData); 
    if (jsonData.total_pages) {
        searchCache.pageCount = jsonData.total_pages;
        log(`总页数已更新为: ${searchCache.pageCount}`);
    }
    searchCache.resultsByPage[page] = cards;
    log(`搜索完成，关键词: "${text}", 页码: ${page}, 找到 ${cards.length} 条结果。`);
    return jsonify({ list: cards, pagecount: searchCache.pageCount });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg, filter, ext) { const type = ext.type || tid; return getCards({ type: type, page: pg }); }
async function detail(id) { const [type, slug] = id.split('/'); return getTracks({ slug, type }); }
async function play(flag, id, flags) { return jsonify({ url: id }); }
