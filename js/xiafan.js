/**
 * HDHive 影视资料库 - App插件脚本 (Server Action 直连版 V2.2 - 深度调试版)
 * 
 * 版本说明:
 * - 【最终架构】为 HDHive.com 量身打造，完全基于API和Server Action交互，告别HTML解析。
 * - 【精准实现】所有功能（分类、详情、搜索）均通过调用官方接口实现，速度快、数据准、稳定性高。
 * - 【核心详情】详情页采用“两步走”策略：先通过主API获取数字ID，再调用Server Action获取资源。
 * - 【缓存优化】集成了高级搜索缓存机制，体验流畅。
 * - 【深度调试】当加载失败时，会将完整的错误对象信息显示为卡片，用于在无日志环境下进行最终诊断。
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
    try { $log(`[HDHive 插件 V2.2] ${msg}`); } 
    catch (_) { console.log(`[HDHive 插件 V2.2] ${msg}`); } 
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

// --- 网络请求 (使用兼容性字符串拼接) ---
async function fetchApi(method, url, params = {}, body = null, additionalHeaders = {}) {
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
        'x-csrf-token': csrfToken, 'Content-Type': 'application/json', ...additionalHeaders
    };
    log(`请求: ${method} ${finalUrl}`);
    const options = { headers };
    if (method === 'POST') {
        options.body = JSON.stringify(body);
        return (await $fetch.post(finalUrl, options.body, options)).data;
    }
    return (await $fetch.get(finalUrl, options)).data;
}

// --- 核心功能函数 ---

async function getConfig() {
  log("插件初始化 (Server Action 直连版 V2.2 - 深度调试版)");
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

// [MODIFIED FOR DEEP DEBUGGING]
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, type } = ext;
  let debugStage = '1. 开始执行';

  try {
    debugStage = '2. 准备请求API';
    const apiUrl = `${API_BASE_URL}/media`;
    const apiParams = { type: type, page: page, per_page: 24 };
    
    debugStage = '3. 正在请求API...';
    const jsonData = await fetchApi('GET', apiUrl, apiParams);
    
    if (!jsonData || (!jsonData.results && !jsonData.data)) {
        debugStage = '4. API响应成功但无数据或格式错误';
        const responsePreview = JSON.stringify(jsonData).substring(0, 100);
        return jsonify({
            list: [{
                vod_id: 'debug_info',
                vod_name: `[调试] API响应无数据`,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `响应预览: ${responsePreview}`
            }]
        });
    }
    
    if (jsonData.results && jsonData.results.length === 0) {
        debugStage = '4. API响应了空列表';
        return jsonify({
            list: [{
                vod_id: 'debug_info_empty',
                vod_name: `[调试] 列表为空`,
                vod_pic: FALLBACK_PIC,
                vod_remarks: `API返回了0条数据，可能是最后一页`
            }]
        });
    }

    debugStage = '5. 正在解析数据';
    const cards = parseJsonToCards(jsonData);
    
    debugStage = '6. 解析完成，返回卡片';
    return jsonify({ list: cards });

  } catch (e) {
    // 关键改动：将完整的错误对象 e 转换成字符串
    const fullErrorString = JSON.stringify(e, Object.getOwnPropertyNames(e));
    return jsonify({
      list: [
        {
          vod_id: 'error_card',
          vod_name: `[完整错误] ${fullErrorString}`, // 卡片标题显示完整的错误信息
          vod_pic: FALLBACK_PIC,
          vod_remarks: `出错阶段: ${debugStage}` // 卡片备注显示出错的环节
        }
      ]
    });
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
