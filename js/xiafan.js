/**
 * HDHive 影视资料库 - App插件脚本 (API直连版 V1.0)
 * 
 * 版本说明:
 * - 【全新架构】为 HDHive.com 量身打造，完全基于API交互，告别HTML解析。
 * - 【API驱动】所有功能（分类、详情、搜索）均通过直接调用官方API实现，速度快、数据准、稳定性高。
 * - 【精准筛选】详情页严格按照您的要求，仅提取和展示 115、阿里云盘、天翼云盘、夸克网盘 四种资源。
 * - 【缓存优化】完美集成了高级搜索缓存机制，切换关键词自动刷新，重复搜索和翻页实现秒开，体验流畅。
 * - 【配置核心】请务必在下方的【用户配置区】填入您自己的有效Cookie。
 */

// --- 配置区 ---
const SITE_URL = "https://hdhive.com";
const API_BASE_URL = "https://hdhive.com/api";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio(); // 保留以备不时之需
const FALLBACK_PIC = "https://hdhive.com/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请将下面的字符串替换为您从浏览器获取的完整Cookie
const COOKIE = 'csrf_access_token=bad5d5c0-6da7-4a22-a591-b332afd1b767;token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc1NTg1MDE0NSwianRpIjoiYTZmZmM4MDEtZWMzZC00Njc2LWI1MzEtMzEwYjhlNmQwMDU5IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6NDM4ODgsIm5iZiI6MTc1NTg1MDE0NSwiY3NyZiI6ImJhZDVkNWMwLTZkYTctNGEyMi1hNTkxLWIzMzJhZmQxYjc2NyIsImV4cCI6MTc1NjQ1NDk0NX0.juRkeQmlg78kdyQ29tZsyM06jPprnMsbxwuSGEYgh-k;';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) { 
    try { $log(`[HDHive 插件 V1.0] ${msg}`); } 
    catch (_) { console.log(`[HDHive 插件 V1.0] ${msg}`); } 
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {}; 
}
function jsonify(data) { return JSON.stringify(data); }

// 从Cookie中提取关键令牌的辅助函数
function getTokenFromCookie(cookie, key) {
    const match = cookie.match(new RegExp(`${key}=([^;]+)`));
    return match ? match[1] : '';
}

// --- 网络请求 ---
async function fetchApi(method, endpoint, params = {}, body = null) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_HERE")) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }

    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (method === 'GET') {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const csrfToken = getTokenFromCookie(COOKIE, 'csrf_access_token');
    const authToken = getTokenFromCookie(COOKIE, 'token');

    const headers = {
        'User-Agent': UA,
        'Cookie': COOKIE,
        'Authorization': `Bearer ${authToken}`,
        'x-csrf-token': csrfToken,
        'Content-Type': 'application/json'
    };

    log(`请求API: ${method} ${url.toString()}`);
    
    const options = { headers };
    if (method === 'POST') {
        options.body = JSON.stringify(body);
        return $fetch.post(url.toString(), options.body, options);
    }
    return $fetch.get(url.toString(), options);
}

// --- 核心功能函数 ---

async function getConfig() {
  log("插件初始化 (API直连版 V1.0)");
  return jsonify({
    ver: 1, 
    title: 'HDHive', 
    site: SITE_URL,
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
    
    return items.map(item => ({
        vod_id: `${item.type || (item.media_type || 'movie')}/${item.slug || item.id}`,
        vod_name: item.title || item.name,
        vod_pic: item.poster_url || `https://image.tmdb.org/t/p/w500${item.poster_path}` || FALLBACK_PIC,
        vod_remarks: item.release_date || item.first_air_date || '',
        ext: { slug: item.slug || item.id, type: item.type || (item.media_type || 'movie' ) }
    }));
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, type } = ext;
  try {
    const jsonData = await fetchApi('GET', `/${type}`, { page: page, per_page: 24 });
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
        // 1. 获取主数据，拿到数字ID
        const mainData = await fetchApi('GET', `/${type}/${slug}`);
        const mediaId = mainData.data.id;
        if (!mediaId) {
            throw new Error("未能从主数据中获取到media_id");
        }
        log(`获取到 Media ID: ${mediaId}`);

        // 2. 用数字ID请求资源列表
        const resourceData = await fetchApi('GET', '/customer/resource', { [`${type}_id`]: mediaId, page: 1, per_page: 200 });
        if (!resourceData || !Array.isArray(resourceData.data)) {
            throw new Error("资源API返回格式不正确");
        }

        // 3. 筛选并分组
        const allowedDrivers = ['Aliyundrive', 'Quark', 'Ctpan', '115'];
        const groupedTracks = {};

        resourceData.data.forEach(resource => {
            if (allowedDrivers.includes(resource.driver)) {
                if (!groupedTracks[resource.driver]) {
                    groupedTracks[resource.driver] = [];
                }
                groupedTracks[resource.driver].push({
                    name: resource.title,
                    pan: resource.link,
                    ext: {},
                });
            }
        });
        log(`资源筛选与分组完成: ${Object.keys(groupedTracks).join(', ')}`);

        // 4. 格式化为最终输出
        const finalList = [];
        const driverNames = {
            'Aliyundrive': '阿里云盘',
            'Quark': '夸克网盘',
            'Ctpan': '天翼云盘',
            '115': '115网盘'
        };

        for (const driver of allowedDrivers) {
            if (groupedTracks[driver] && groupedTracks[driver].length > 0) {
                finalList.push({
                    title: driverNames[driver],
                    tracks: groupedTracks[driver]
                });
            }
        }

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

// =================================================================================
// ====================【带缓存的搜索功能 (API直连版)】================================
// =================================================================================

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
    const requestBody = ["/api/proxy/tmdb/3/search/multi", {
        query: text,
        page: page.toString(),
        language: "zh-CN"
    }];
    
    const jsonData = await fetchApi('POST', '/search', {}, requestBody);
    
    // TMDB API 返回的数据在 results 字段
    const cards = parseJsonToCards(jsonData); 

    // 从返回数据中获取总页数
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
