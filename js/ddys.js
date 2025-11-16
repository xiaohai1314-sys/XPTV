/**
 * Nullbr 影视库前端插件 - V27.4 (终极兼容版：Tab 必现 + 内容切换)
 * 修复：
 * 1. home() 返回标准 { type_id, type_name }
 * 2. category() 兼容 type_id 字符串/数字/对象
 * 3. getCards() 强制净化 id
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V27.4] ${msg}`); }
function clean(str) { return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim(); }

// ★★★ 标准分类配置（App 能识别）★★★
const CATEGORIES = [
    { type_id: '2142788', type_name: '热门电影' },
    { type_id: '2143362', type_name: '热门剧集' },
    { type_id: '2142753', type_name: '高分电影' },
    { type_id: '2143363', type_name: '高分剧集' },
];

// ★★★ 映射：type_id → 后端真实 id（字符串）★★★
const ID_MAP = {
    '2142788': 2142788,
    '2143362': 2143362,
    '2142753': 2142753,
    '2143363': 2143363
};

async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 27.4, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// ★★★ home() 返回标准 class ★★★
async function home() {
    return jsonify({
        class: CATEGORIES,  // 必须是 type_id + type_name
        filters: {}
    });
}

// ★★★ category：兼容 type_id 字符串 ★★★
async function category(tid, pg, filter, ext) {
    log(`category() tid: ${JSON.stringify(tid)}`);
    let realId = null;

    // 1. 字符串 type_id
    if (typeof tid === 'string') {
        realId = parseInt(clean(tid), 10);
    }
    // 2. 对象 { type_id: 'xxx' }
    else if (typeof tid === 'object' && tid !== null && tid.type_id !== undefined) {
        realId = parseInt(clean(tid.type_id), 10);
    }

    const backendId = ID_MAP[realId] || CATEGORIES[0].type_id;
    log(`category() 最终后端 ID: ${backendId}`);
    return getCards({ id: backendId, page: pg || 1 });
}

// ★★★ getCards：强制净化 id ★★★
async function getCards(ext) {
    log(`getCards() ext: ${JSON.stringify(ext)}`);
    let categoryId = null;
    if (ext?.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10);
        if (isNaN(categoryId)) categoryId = null;
    }
    if (!categoryId) {
        categoryId = parseInt(CATEGORIES[0].type_id, 10);
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求: ${url}`);

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
