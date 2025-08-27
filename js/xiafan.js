/**
 * HDHive 影视资料库 - App插件脚本 (V3.0 - HTML解析版)
 * 
 * 版本说明:
 * - 【全新架构】根据2025年后的网站更新，分类页不再请求API，改为直接请求HTML页面并解析内嵌数据。
 * - 【精准分类】分别从 /movie 和 /tv 路径获取电影和剧集数据，移除已失效的音乐分类。
 * - 【保留核心】详情页和搜索功能逻辑暂时保留，继续使用API交互。
 * - 【兼容性】所有代码均考虑了老旧App运行环境的兼容性。
 * - 【配置核心】请务必在下方的【用户配置区】填入您自己的有效Cookie。
 */

// --- 配置区 ---
const SITE_URL = "https://hdhive.com";
const API_BASE_URL = "https://hdhive.com/api";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://hdhive.com/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请将下面的字符串替换为您从浏览器获取的完整Cookie
const COOKIE = 'csrf_access_token=bad5d5c0-6da7-4a22-a591-b332afd1b767;token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NTg1MDE0NSwianRpIjoiYTZmZmM4MDEtZWMzZC00Njc2LWI1MzEtMzEwYjhlNmQwMDU5IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6NDM4ODgsIm5iZiI6MTc1NTg1MDE0NSwiY3NyZiI6ImJhZDVkNWMwLTZkYTctNGEyMi1hNTkxLWIzMzJhZmQxYjc2NyIsImV4cCI6MTc1NjQ1NDk0NX0.juRkeQmlg78kdyQ29tZsyM06jPprnMsbxwuSGEYgh-k;';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) { 
    try { $log(`[HDHive 插件 V3.0] ${msg}`); } 
    catch (_) { console.log(`[HDHive 插件 V3.0] ${msg}`); } 
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

// --- 网络请求 (现在能处理JSON和TEXT两种响应) ---
async function fetchApi(method, url, params = {}, body = null, additionalHeaders = {}, responseType = 'json') {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_HERE")) {
        throw new Error("Cookie not configured. 请在脚本中配置Cookie。");
    }

    let finalUrl = url;
    if (method === 'GET' && Object.keys(params).length > 0) {
        const queryString = Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        finalUrl += `?${queryString}`;
    }

    const csrfToken = getTokenFromCookie(COOKIE, 'csrf_access_token');
    const authToken = getTokenFromCookie(COOKIE, 'token');
    const headers = {
        'User-Agent': UA, 'Cookie': COOKIE, 'Authorization': `Bearer ${authToken}`,
        'x-csrf-token': csrfToken, ...additionalHeaders
    };
    log(`请求: ${method} ${finalUrl}`);
    
    const options = { headers };
    let response;

    if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
        response = await $fetch.post(finalUrl, options.body, options);
    } else {
        response = await $fetch.get(finalUrl, options);
    }

    if (responseType === 'text') {
        return response.text; // 返回HTML文本
    }
    return response.data; // 返回JSON数据
}

// --- 核心功能函数 ---

async function getConfig() {
  log("插件初始化 (V3.0 - HTML解析版)");
  return jsonify({
    ver: 1, title: 'HDHive', site: SITE_URL,
    tabs: [
      { name: '电影', ext: { type: 'movie' } },
      { name: '剧集', ext: { type: 'tv' } },
    ],
  });
}

function parseJsonToCards(jsonData) {
    // 这个函数现在被两个地方调用，需要兼容两种数据结构
    const items = jsonData.results || (jsonData.data ? jsonData.data.data : []);
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

// [REBUILT] 全新重构的 getCards 函数
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, type } = ext;
  try {
    // 1. 根据类型确定请求的URL，并附带翻页参数
    const url = `${SITE_URL}/${type}`;
    const params = { page: page };
    
    // 2. 请求HTML页面，明确要求返回文本
    const html = await fetchApi('GET', url, params, null, {}, 'text');
    
    // 3. 从HTML中提取内嵌的JSON数据
    // 通常数据会藏在 <script> 标签里，格式类似: <script id="__NEXT_DATA__" type="application/json">...</script>
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (!match || !match[1]) {
        throw new Error("在HTML中未找到 __NEXT_DATA__ 数据岛。");
    }
    
    const nextData = JSON.parse(match[1]);
    // 根据经验，真实数据通常在 props.pageProps 下
    const pageData = nextData.props.pageProps.data;
    if (!pageData) {
        throw new Error("在 __NEXT_DATA__ 中未找到 pageProps.data。");
    }

    // 4. 使用旧的解析函数处理提取出的数据
    const cards = parseJsonToCards({ data: pageData });
    return jsonify({ list: cards });

  } catch(e) {
    log(`获取分类列表异常: ${e.message}`);
    // 如果失败，返回一个包含错误信息的卡片用于调试
    return jsonify({ list: [{
        vod_id: 'error',
        vod_name: `[错误] ${e.message}`,
        vod_pic: FALLBACK_PIC,
        vod_remarks: '请检查脚本或网络'
    }] });
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

        const resourceBody = [{ [`${type}_id`]: mediaId, sort_by: "is_admin", sort_order: "descend", per_page: 10000 }];
        const resourceHeaders = { 'next-action': '6c729f84f8333264305bb8516ed5ae3bc9ed1765' };
        const rawResourceData = await fetchApi('POST', `${SITE_URL}/${type}/${slug}`, {}, resourceBody, resourceHeaders);
        
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
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `操作失败: ${e.message}`, pan: '', ext: {} }] }] });
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
    const cards = parseJsonToCards(jsonData.results); 
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
