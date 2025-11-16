/**
 * Nullbr 影视库前端插件 - V27.6 (终极修复：字符串 tid + 强制清理)
 * 修复：category() 优先处理字符串 tid + 彻底 clean
 * 保留原 home() 结构，保证 Tab 显示
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }

// ★★★ Toast 日志 ★★★
function log(msg) {
    const text = `[Nullbr V27.6] ${msg}`;
    console.log(text);
    try { $utils.toastError?.(text, 5000); } 
    catch (_) { try { $utils.toast?.(text, 5000); } catch (_) {} }
}

// ★★★ 彻底清理 ★★★
function clean(str) {
    return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim();
}

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 27.6, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// ★★★ home() 不变 —— Tab 正常显示 ★★★
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// ★★★ category：优先处理字符串 tid ★★★
async function category(tid, pg, filter, ext) {
    log(`category() 传入 tid: "${tid}" (type: ${typeof tid})`);
    let id = null;

    // ★★★ 1. 字符串优先（你的 App 传字符串）★★★
    if (typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
            log(`category()：字符串解析成功 → ID ${id}`);
        } else {
            log(`category()：字符串转数字失败，原始: "${tid}"`);
        }
    }

    // ★★★ 2. 对象回退（兼容其他 App）★★★
    if (!id && typeof tid === "object" && tid !== null) {
        if (tid.id) id = parseInt(clean(tid.id), 10);
        else if (tid.ext?.id) id = parseInt(clean(tid.ext.id), 10);
        if (id && !isNaN(id)) log(`category()：对象解析 → ID ${id}`);
    }

    // ★★★ 3. 最终回退 ★★★
    if (!id || isNaN(id)) {
        log("category()：解析失败，使用默认分类");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// ★★★ getCards：强制净化 ★★★
async function getCards(ext) {
    log(`getCards() 传入 ext: ${JSON.stringify(ext)}`);
    let categoryId = parseInt(clean(ext?.id), 10);
    if (isNaN(categoryId)) categoryId = CATEGORIES[0].ext.id;

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求后端: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data?.items?.length) return jsonify({ list: [] });

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

async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
