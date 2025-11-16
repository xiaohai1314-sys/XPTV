/**
 * Nullbr 影视库前端插件 - V24.2 (终极修复版)
 *
 * 核心修复：
 * 1. 分类 ID 丢失时 fallback，但不会覆盖已解析好的分类 ID。
 * 2. 页码 page 绝对不会丢失。
 * 3. 修复无限重复第一页的问题。
 * 4. 保持 V21.1 架构不变，四个分类正常显示各自内容。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V24.1] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 24.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// -------------------- category（保持 V21.1 完整实现） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }

    if (!id && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) id = n;
    }

    if (!id && typeof tid === "number") {
        id = tid;
    }

    if (!id) {
        log("category()：tid 无效，使用默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 解析后的分类 ID：${id}, page=${pg || 1}`);
    // ✅ 传递 page 保证分页
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards（绝望修正升级） --------------------

async function getCards(ext) {
    log(`getCards() 调用，ext 原始值：${JSON.stringify(ext)}`);

    let categoryId = null;
    let page = 1;

    // --- 尝试安全获取 categoryId ---
    if (typeof ext === "object" && ext !== null) {
        if (ext.id) categoryId = ext.id;
        if (ext.page) page = ext.page;
    }

    // 如果 categoryId 依然无效，则 fallback
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 请求 URL：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
            return jsonify({ list: [], page: 1, pagecount: 1, limit: 0, total: 0 });
        }

        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        // ✅ 保证 page/pagecount/total 正确返回
        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: data.total_page || 1,
            limit: cards.length,
            total: data.total_items || cards.length
        });

    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [], page: page, pagecount: 1, limit: 0, total: 0 });
    }
}

// ----------------- 占位函数 -----------------

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
