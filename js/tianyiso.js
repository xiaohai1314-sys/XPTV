/**
 * reboys.cn 前端插件 - V25.0 (终极加强版)
 * 变更日志:
 * 1. [最终方案] 回归并强化 V22 的“轻量级ID+全局缓存”方案。
 * 2. [核心修复] 引入一个全新的、更强大的 `robustParse` 函数，专门用于解析从 App 环境传递过来的、可能被污染的 JSON 字符串。
 * 3. [兼容性Max] `robustParse` 能处理多重转义、错误引号等问题，最大限度地保证 vod_id 解析成功。
 * 4. [逻辑定型] 确认了“后端获取->前端缓存->轻量ID关联”是唯一正确的道路。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 ---
let searchCache = {}; 
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V24] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}

/**
 * 【V24 核心】更强大的 JSON 解析函数
 * @param {string | object} ext - 可能被污染的 JSON 字符串或已经是对象
 * @returns {object} 解析后的对象，失败则返回空对象
 */
function robustParse(ext) {
    if (typeof ext === 'object' && ext !== null) return ext;
    if (typeof ext !== 'string') return {};

    let str = ext.trim();
    try {
        // 尝试直接解析
        return JSON.parse(str);
    } catch (e) {
        log(`[robustParse] 直接解析失败: ${e.message}`);
        try {
            // 尝试处理可能存在的多重转义，例如 '\"' -> '"'
            str = str.replace(/\\"/g, '"');
            // 尝试处理字符串被错误地用单引号或双引号包裹的情况，例如 "'{...}'"
            if ((str.startsWith(`'`) && str.endsWith(`'`)) || (str.startsWith(`"`) && str.endsWith(`"`))) {
                str = str.substring(1, str.length - 1);
            }
            // 再次尝试解析
            return JSON.parse(str);
        } catch (e2) {
            log(`[robustParse] 再次尝试解析失败: ${e2.message}. 返回空对象.`);
            return {};
        }
    }
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V24 (终极加强版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V24)', site: SITE_URL, tabs: CATEGORIES });
}

// ----------------------------------------------------------------------
// 首页/分类 (与V22/V23一致)
// ----------------------------------------------------------------------
async function getCards(ext) {
    // ... 此处代码与 V22/V23 版本完全相同 ...
    ext = robustParse(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            cards.push({
                vod_id: jsonify({ type: 'home', path: $item.attr('href') }),
                vod_name: $item.find('p').text().trim(),
                vod_pic: $item.find('img').attr('src') || FALLBACK_PIC,
            });
        });
        return jsonify({ list: cards });
    } catch (e) { return jsonify({ list: [] }); }
}


// ----------------------------------------------------------------------
// 搜索 (与V22一致)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = robustParse(ext);
    const keyword = ext.text || '';
    const page = ext.page || 1;
    
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}", 页码: ${page}`);
    
    try {
        const cacheKey = `search_${keyword}`;
        let allResults = searchCache[cacheKey];
        
        if (!allResults) {
            log(`[search] 缓存未命中，请求后端`);
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
            let response = JSON.parse(fetchResult.data || fetchResult);
            if (!response || response.code !== 0) throw new Error(response.message || '后端错误');
            
            allResults = response.data?.data?.results || [];
            if (allResults.length === 0) throw new Error('无结果');
            
            searchCache[cacheKey] = allResults;
            log(`[search] 缓存了 ${allResults.length} 条结果`);
        }
        
        const pageSize = 10;
        const pageData = allResults.slice((page - 1) * pageSize, page * pageSize);
        
        const list = pageData.map(item => ({
            vod_id: jsonify({ type: 'search', unique_id: item.unique_id, keyword: keyword }),
            vod_name: item.title,
            vod_pic: item.image || FALLBACK_PIC,
            vod_remarks: `${(item.links || []).length}个网盘`
        }));
        
        return jsonify({ list: list, page: page, pagecount: Math.ceil(allResults.length / pageSize), total: allResults.length });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 详情 (核心修改：使用 robustParse)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    log(`[getTracks] 开始获取详情, 接收到的原始 vod_id: ${ext.vod_id}`);
    
    try {
        // 【V24 核心】使用我们新的、更强大的解析函数
        const idData = robustParse(ext.vod_id);
        
        if (!idData.type) {
            throw new Error(`使用 robustParse 后仍无法解析出 type。解析结果: ${JSON.stringify(idData)}`);
        }
        
        log(`[getTracks] 解析后类型: ${idData.type}`);
        
        if (idData.type === 'search' && idData.unique_id && idData.keyword) {
            const { unique_id, keyword } = idData;
            const cachedResults = searchCache[`search_${keyword}`];
            if (!cachedResults) throw new Error(`缓存丢失 (keyword: ${keyword})`);
            
            const targetItem = cachedResults.find(item => item.unique_id === unique_id);
            if (!targetItem) throw new Error(`缓存中未找到 (unique_id: ${unique_id})`);
            
            const links = targetItem.links || [];
            if (links.length === 0) return jsonify({ list: [] });
            
            const tracks = links.map(link => ({
                name: `[${link.type || '网盘'}] ${targetItem.title}${link.password ? ` 码:${link.password}` : ''}`,
                pan: link.url
            }));
            
            return jsonify({ 
                list: [{ title: targetItem.title, tracks: tracks }],
                vod_play_from: '网盘',
                vod_play_url: tracks.map(t => `${t.name}$${t.pan}`).join('#')
            });
        } 
        else if (idData.type === 'home') {
            // ... 首页逻辑 ...
            return jsonify({ list: [] });
        } 
        else {
            throw new Error(`未知的 vod_id 类型: ${idData.type}`);
        }
    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (robustParse(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ parse: 0, url: id }); }

log('==== 插件加载完成 V24 ====');
