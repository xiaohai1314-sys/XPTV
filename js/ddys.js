/**
 * Nullbr 影视库前端插件 - V27.3 (终极修复：点击分类内容必切换)
 * 修复：category() 正确解析 App 传入的 { name, ext } 对象
 *      getCards() 强制净化 ext.id（防空格/字符串污染）
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.3] ${msg}`); }

// ★★★ 新增：彻底清理字符串（移除零宽字符、空格等）★★★
function clean(str) {
    return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim();
}

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口 ----------------
async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 27.3, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// home() 不变 —— Tab 正常显示
async function home() {
    return jsonify({ class: CATEGORIES, filters: {} });
}

// ----------------- category：终极修复 tid 解析 -----------------
async function category(tid, pg, filter, ext) {
    log(`category() 传入 tid: ${JSON.stringify(tid)}`); // ← 必看日志
    let id = null;

    // ★★★ 1. 优先处理对象（App 真实传参）★★★
    if (typeof tid === "object" && tid !== null) {
        if (tid.id !== undefined) {
            id = parseInt(clean(tid.id), 10);
        } else if (tid.ext?.id !== undefined) {
            id = parseInt(clean(tid.ext.id), 10);
        } 
        // ★★★ 新增：支持 { name: 'xxx' } 的情况 ★★★
        else if (tid.name) {
            const cleanedName = clean(tid.name);
            const found = CATEGORIES.find(c => clean(c.name) === cleanedName);
            if (found) {
                id = found.ext.id;
                log(`category()：通过 name 匹配成功 → ID ${id}`);
            }
        }
    }

    // ★★★ 2. 字符串回退（兼容手动传参）★★★
    if (!id && typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
        } else {
            const found = CATEGORIES.find(c => clean(c.name) === cleaned);
            if (found) id = found.ext.id;
        }
    }

    // ★★★ 3. 最终回退 ★★★
    if (!id) {
        log("category()：解析失败，回退默认分类");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// ----------------- getCards：强制净化 id -----------------
async function getCards(ext) {
    log(`getCards() 传入 ext: ${JSON.stringify(ext)}`);

    let categoryId = null;
    if (ext && ext.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10);
        if (isNaN(categoryId)) categoryId = null;
    }

    if (!categoryId) {
        log("getCards()：id 无效，使用默认");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 请求后端: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date?.substring(0,4) || '')
        }));

        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: data.total_page || 1,
            limit: cards.length,
            total: data.total_items || 0
        });
    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位 -----------------
async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
