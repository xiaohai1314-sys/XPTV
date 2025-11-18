/**
 * Nullbr 影视库前端插件 - V65.0 (前后端对齐版)
 *
 * 变更日志:
 * - V65.0 (2025-11-18):
 *   - [严格对齐] 本版本严格按照用户提供的 V2.8 后端代码逻辑进行前端适配。
 *   - [回归基准] 列表和分页功能完全基于用户确认可用的 V59 前端代码，原封不动。
 *   - [功能嫁接] 在 V59 基础上，嫁接了 `search`, `detail`, `play` 函数。
 *   - [必要适配] 根据 V2.8 后端代码要求，为 `search` 函数的请求添加了必要的 `X-API-KEY` 请求头，以确保搜索功能正常工作。
 *   - 这是一个确保前后端逻辑完全匹配的、最可靠的整合版本。
 *
 * 作者: Manus (在用户的最终指引下完成)
 * 日期: 2025-11-18
 */

// =======================================================================
// --- 核心配置区 ---
// =======================================================================

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const API_KEY = '5sJvQEDxhJXdsTquRsMdfSksDgiajta1'; // ★ 新增：根据后端V2.8代码 ，定义API_KEY

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V65.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let CATEGORY_END_LOCK = {};

// =======================================================================
// --- V59 核心代码区 (原封不动) ---
// =======================================================================

async function init(ext) {
    CATEGORY_END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 65.0, title: 'Nullbr影视库 (V65)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// ★★★★★【V59 的 getCards 函数 - 原封不动地复制于此】★★★★★
async function getCards(ext) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}`);
    
    let placeholderId = null;
    let page = 1;
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt } = extObj.ext || extObj || {};
        placeholderId = id || CATEGORIES[0].ext.id;
        page = pg || page_alt || 1;
    } catch (e) {
        placeholderId = CATEGORIES[0].ext.id;
        page = 1;
    }
    log(`解析成功！占位符ID: ${placeholderId}, 页码: ${page}`);

    if (CATEGORY_END_LOCK[placeholderId] && page > 1) {
        log(`分类 "${placeholderId}" 已被锁定，直接返回空列表，阻止无效请求。`);
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) {
        log(`请求第一页，解除分类 "${placeholderId}" 的锁。`);
        delete CATEGORY_END_LOCK[placeholderId];
    }

    const url = `${API_BASE_URL}/api/list?id=${placeholderId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

    try {
        // ★★★ V59的请求方式，不带额外请求头 ★★★
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (!data || !Array.isArray(data.items)) {
            CATEGORY_END_LOCK[placeholderId] = true;
            return jsonify({ list: [], page: page, pagecount: page });
        }
        
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        const pageSize = 30;
        if (data.items.length < pageSize) {
            log(`返回条目数 ${data.items.length} 小于每页数量 ${pageSize}，锁定分类 "${placeholderId}"。`);
            CATEGORY_END_LOCK[placeholderId] = true;
        }

        const hasMore = !CATEGORY_END_LOCK[placeholderId];
        log(`当前分类 "${placeholderId}" 是否还有更多: ${hasMore}`);

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: data.items.length,
            total: data.total_items
        });

    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// --- 新增功能区 (嫁接并根据后端V2.8适配) ---
// =======================================================================

// ★★★★★【搜索函数 - 根据后端V2.8适配】★★★★★
async function search(wd, quick) {
    log(`search() 被调用，关键词: "${wd}"`);
    if (!wd) { return jsonify({ list: [] }); }

    const encodedWd = encodeURIComponent(wd);
    const url = `${API_BASE_URL}/api/search?keyword=${encodedWd}`;
    log(`搜索请求URL: ${url}`);

    try {
        // ★★★ 适配后端V2.8：添加 X-API-KEY 请求头 ★★★
        const response = await $fetch.get(url, {
            headers: { 'X-API-KEY': API_KEY }
        });
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("搜索API返回数据格式不正确或无结果。");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => {
            const card = {
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
            if (item['115-flg']) { card['115-flg'] = item['115-flg']; }
            return card;
        });
        log(`搜索到 ${cards.length} 个结果。`);
        return jsonify({ list: cards });
    } catch (err) {
        log(`搜索请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情函数 - 原封不动嫁接】★★★★★
async function detail(id, ext) {
    log(`detail() 被调用, ID: ${id}`);
    const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
    const vod = { vod_id: id, vod_play_from: '', vod_play_url: '' };

    if (extObj && extObj['115-flg'] === 1) {
        log(`ID: ${id} 检测到 115-flg 标志，声明播放源。`);
        vod.vod_play_from = "115网盘";
        vod.vod_play_url = `在线播放$${id}`;
    } else {
        log(`ID: ${id} 未检测到 115-flg 标志，不提供播放源。`);
    }
    return jsonify({ list: [vod] });
}

// ★★★★★【播放函数 - 原封不动嫁接】★★★★★
async function play(flag, id, flags) {
    log(`play() 被调用, flag: ${flag}, id: ${id}`);
    if (flag !== '115网盘') { return jsonify({ url: "" }); }

    try {
        const [media_type, tmdbid] = id.split('_');
        if (!media_type || !tmdbid) { throw new Error("无效的ID格式"); }

        const url = `${API_BASE_URL}/api/resource?type=${media_type}&tmdbid=${tmdbid}`;
        log(`请求资源链接: ${url}`);

        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const resources = data['115'];

        if (!resources || resources.length === 0) {
            log("资源API未返回任何115链接。");
            return jsonify({ url: "" });
        }
        log(`获取到 ${resources.length} 个115资源。`);

        if (media_type === 'tv') {
            log("检测为剧集，返回第一个分享链接。");
            return jsonify({ url: resources[0].share_link });
        }

        if (media_type === 'movie') {
            let bestLink = resources[0].share_link;
            let bestQuality = 0;
            for (const res of resources) {
                const title = (res.title || '').toLowerCase();
                if (title.includes('2160p') || title.includes('4k')) { bestLink = res.share_link; bestQuality = 2160; break; }
                if (title.includes('1080p') && bestQuality < 1080) { bestLink = res.share_link; bestQuality = 1080; }
            }
            log(`检测为电影，选择的最佳清晰度为: ${bestQuality || '默认'}p`);
            return jsonify({ url: bestLink });
        }
        return jsonify({ url: resources[0].share_link });
    } catch (err) {
        log(`play() 过程出错: ${err.message}`);
        return jsonify({ url: "" });
    }
}
