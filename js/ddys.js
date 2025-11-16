/**
 * Nullbr 影视库前端插件 - V27.0 (修复版：解决“内容始终一样”)
 * 仅修复：tid 对象处理 + 彻底清理字符串 + ext.id 强制净化
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.0] ${msg}`); }

// 新增：彻底清理字符串（移除零宽字符）
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
    return jsonify({
        ver: 27.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// home() 不变 —— 能正常显示 Tab
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// ----------------- category：修复 tid 解析 -----------------
async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);
    let id = null;

    // 1. 对象处理（新增）
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
        else if (tid.name) {
            const found = CATEGORIES.find(c => clean(c.name) === clean(tid.name));
            if (found) id = found.ext.id;
        }
    }

    // 2. 字符串处理（增强版）
    if (!id && typeof tid === "string") {
        const cleaned = clean(tid); // 彻底清理
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
        } else {
            const found = CATEGORIES.find(c => clean(c.name) === cleaned);
            if (found) id = found.ext.id;
        }
    }

    // 3. 回退
    if (!id) {
        log("category()：解析失败，回退默认");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// ----------------- getCards：修复 ext.id 污染 -----------------
async function getCards(ext) {
    log(`getCards() 调用，ext: ${JSON.stringify(ext)}`);
    
    let categoryId = null;
    if (ext && typeof ext === "object" && ext.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10); // 强制清理 + 转数字
        if (isNaN(categoryId)) categoryId = null;
    }
    
    if (!categoryId) {
        log("getCards()：id 无效，使用默认");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求: ${url}`);

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
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
