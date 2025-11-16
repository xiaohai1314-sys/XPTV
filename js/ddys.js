// ============================================
// 版本: v6.5.0 - 完全按照原代码，只加日志
// ============================================

const MY_BACKEND_URL = "http://192.168.1.7:3003/api";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_PIC = 'https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg';
const DEBUG = true;

// 日志
function log(msg) { if (DEBUG) console.log(`[插件V6.5] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// 内部函数：获取卡片列表
async function getCards(params) {
    let requestUrl;
    let context;

    if (params.listId) {
        context = 'Category';
        requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
    } else if (params.keyword) {
        context = 'Search';
        requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}`;
    } else {
        return jsonify({ list: [] });
    }

    log(`[${context}] 正在请求后端: ${requestUrl}`);
    try {
        const { data } = await $fetch.get(requestUrl);
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error("后端返回的数据中缺少 items 数组");
        }

        const cards = data.items.map(item => ({
            vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
            vod_name: item.title,
            vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
            vod_remarks: item.release_date || item.vote_average?.toFixed(1) || '',
            ext: { tmdbid: item.tmdbid, type: item.media_type }
        }));

        log(`[${context}] ✓ 成功格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[${context}] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// getConfig
async function getConfig() {
    log("==== getConfig 被调用 ====");
    const CATEGORIES = [
        { name: 'IMDb-热门电影', ext: { listId: 2142788 } },
        { name: 'IMDb-热门剧集', ext: { listId: 2143362 } },
        { name: 'IMDb-高分电影', ext: { listId: 2142753 } },
        { name: 'IMDb-高分剧集', ext: { listId: 2143363 } }
    ];
    return jsonify({
        ver: 6.5,
        title: '影视聚合(API)',
        site: MY_BACKEND_URL,
        tabs: CATEGORIES,
    });
}

// home
async function home() {
    log("==== home 被调用 ====");
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

// category
async function category(tid, pg) {
    log(`==== category 被调用 ==== tid类型=${typeof tid}, 值=${JSON.stringify(tid)}, pg=${pg}`);
    const listId = tid.listId;
    log(`[category] APP请求分类, listId: ${listId}, page: ${pg}`);
    return getCards({ listId: listId, page: pg || 1 });
}

// search
async function search(ext) {
    log(`==== search 被调用 ==== ext类型=${typeof ext}, 值=${JSON.stringify(ext)}`);
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

// detail
async function detail(id) {
    log(`==== detail 被调用 ==== id=${id}`);
    try {
        const { tmdbid, type } = JSON.parse(id);
        if (!tmdbid || !type) throw new Error("vod_id 格式不正确");

        const requestUrl = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
        log(`[detail] 正在请求后端: ${requestUrl}`);
        
        const { data } = await $fetch.get(requestUrl);
        if (!data['115'] || !Array.isArray(data['115'])) {
            throw new Error("后端未返回有效的115资源列表");
        }

        const tracks = data['115'].map(item => ({
            name: `[115] ${item.title} (${item.size})`,
            pan: item.share_link,
            ext: {}
        }));

        log(`[detail] ✓ 成功解析出 ${tracks.length} 个115网盘链接`);
        return jsonify({
            list: [{ title: '115网盘资源', tracks: tracks }]
        });

    } catch (e) {
        log(`[detail] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// play
async function play(flag, id) {
    log(`==== play 被调用 ==== URL: ${id}`);
    return jsonify({ url: id });
}

// init
async function init() {
    log("==== init 被调用 ====");
    return getConfig();
}
