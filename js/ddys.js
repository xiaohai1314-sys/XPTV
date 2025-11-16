/**
 * 影视聚合前端插件 - V6.0-fix (最小化修正)
 *
 * 策略:
 * - 完全基于用户提供的、能显示Tab的V6.0版本。
 * - 只修正 getCards 和 detail 函数的数据解析错误。
 * - 不做任何其他改动，以确保Tab显示逻辑不被破坏。
 */

// --- 配置区 ---
const MY_BACKEND_URL = "http://192.168.1.7:3003/api";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[插件V6.0-fix] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- 核心数据获取与格式化函数 ---

// 【已修正】内部函数：获取卡片列表
async function getCards(params) {
    let requestUrl, context;
    if (params.listId) {
        context = 'Category';
        requestUrl = `<LaTex>${MY_BACKEND_URL}/list?id=$</LaTex>{params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) {
        context = 'Search';
        requestUrl = `<LaTex>${MY_BACKEND_URL}/search?keyword=$</LaTex>{encodeURIComponent(params.keyword)}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[<LaTex>${context}] 正在请求后端: $</LaTex>{requestUrl}`);
    try {
        // ▼▼▼ 唯一的、核心的修正 ▼▼▼
        const response = await $fetch.get(requestUrl);
        if (!response.items || !Array.isArray(response.items)) {
            throw new Error("后端返回的数据中缺少 items 数组");
        }
        const cards = response.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `<LaTex>${POSTER_BASE_URL}$</LaTex>{item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));
        // ▲▲▲ 修正结束 ▲▲▲

        log(`[<LaTex>${context}] ✓ 成功格式化 $</LaTex>{cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[<LaTex>${context}] ❌ 请求或处理数据时发生异常: $</LaTex>{e.message}`);
        return jsonify({ list: [] });
    }
}

// --- APP 插件入口函数 (完全保留V6.0的结构) ---

// 规范函数1: getConfig (用于初始化)
async function getConfig() {
    log("==== 插件初始化 V6.0-fix ====");
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];
    return jsonify({
        ver: "6.0-fix",
        title: '影视聚合(API)-fix', // 修改标题以防万一
        site: MY_BACKEND_URL,
        tabs: CATEGORIES,
    });
}

// 规范函数2: home (APP调用以获取分类)
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// 规范函数3: category (APP调用以获取分类下的内容)
async function category(tid, pg) {
    const listId = tid.listId;
    log(`[category] APP请求分类, listId: <LaTex>${listId}, page: $</LaTex>{pg}`);
    return getCards({ listId: listId, page: pg || 1 });
}

// 规范函数4: search (APP调用以获取搜索结果)
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);
    if (page > 1) {
        log(`[search] 页码 > 1，返回空列表以停止。`);
        return jsonify({ list: [] });
    }
    if (!searchText) return jsonify({ list: [] });
    log(`[search] APP请求搜索, keyword: "${searchText}"`);
    return getCards({ keyword: searchText });
}

// 【已修正】规范函数5: detail (APP调用以获取详情和播放列表)
async function detail(id) {
    log(`[detail] APP请求详情, vod_id: ${id}`);
    try {
        const { tmdbid, type } = JSON.parse(id);
        if (!tmdbid || !type) throw new Error("vod_id 格式不正确");
        const requestUrl = `<LaTex>${MY_BACKEND_URL}/resource?tmdbid=$</LaTex>{tmdbid}&type=${type}`;
        log(`[detail] 正在请求后端: ${requestUrl}`);
        
        // ▼▼▼ 唯一的、核心的修正 ▼▼▼
        const response = await $fetch.get(requestUrl);
        if (!response['115'] || !Array.isArray(response['115'])) {
            throw new Error("后端未返回有效的115资源列表");
        }
        const tracks = response['115'].map(item => ({
            name: `[115] <LaTex>${item.title} ($</LaTex>{item.size})`,
            pan: item.share_link,
            ext: {}
        }));
        // ▲▲▲ 修正结束 ▲▲▲

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        return jsonify({
            list: [{ title: '115网盘资源', tracks: tracks }]
        });
    } catch (e) {
        log(`[detail] ❌ 获取详情时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 规范函数6: play (APP调用以播放)
async function play(flag, id) {
    log(`[play] APP请求播放, URL: ${id}`);
    return jsonify({ url: id });
}

// 规范函数7: init (兼容旧版APP的初始化入口)
async function init() {
    return getConfig();
}
