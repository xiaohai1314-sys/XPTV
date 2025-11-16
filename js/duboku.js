/**
 * Nullbr 影视库前端插件 - V29.0 (终极适配：直调 getCards + tid + Tab 必现)
 * 修复：getCards() 解析 ext.tid（你的 App 传 tid）
 * 保留：home() 原结构，保证 Tab 显示
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) {
    const text = `[V29.0] ${msg}`;
    console.log(text);
    try { $utils.toastError?.(text, 5000); } catch (_) { try { $utils.toast?.(text, 5000); } catch (_) {} }
}
function clean(str) { return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim(); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 29.0, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// ★★★ home() 不变，保证 Tab 显示 ★★★
async function home() {
    return jsonify({ class: CATEGORIES, filters: {} });
}

// ★★★ getCards：解析 ext.tid（你的 App 传 tid）★★★
async function getCards(ext) {
    ext = ext || {};
    log(`getCards() ext: ${JSON.stringify(ext)}`);

    let categoryId = null;

    // 1. 优先从 ext.tid 取
    if (ext.tid !== undefined) {
        categoryId = parseInt(clean(ext.tid), 10);
        log(`从 tid 取到 ID: ${categoryId}`);
    }
    // 2. 再从 ext.id 取
    else if (ext.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10);
        log(`从 id 取到 ID: ${categoryId}`);
    }

    if (!categoryId || isNaN(categoryId)) {
        log("ID 无效，使用默认 2142788");
        categoryId = 2142788;
    }

    const page = ext.page || 1;
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

// 占位
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
