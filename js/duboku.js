/**
 * Nullbr 影视库前端插件 - V30.1 (终极回退版：标准 type_id + 强制默认 + 内容必现)
 * 修复：CATEGORIES 使用 type_id + type_name
 *       getCards() 强制默认 ID 2142788 (热门电影)
 *       保证至少有内容显示
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) {
    const text = `[V30.1] ${msg}`;
    console.log(text);
    try { $utils.toastError?.(text, 5000); } catch (_) { try { $utils.toast?.(text, 5000); } catch (_) {} }
}
function clean(str) { return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim(); }

// ★★★ 标准分类 ★★★
const CATEGORIES = [
    { type_id: '2142788', type_name: '热门电影' },
    { type_id: '2143362', type_name: '热门剧集' },
    { type_id: '2142753', type_name: '高分电影' },
    { type_id: '2143363', type_name: '高分剧集' },
];

async function init(ext) { return getConfig(); }
async function getConfig() {
    return jsonify({ ver: 30.1, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

// ★★★ home() 返回标准 class ★★★
async function home() {
    log("home() 返回 class");
    return jsonify({ class: CATEGORIES, filters: {} });
}

// ★★★ getCards：强制默认 ID ★★★
async function getCards(ext) {
    ext = ext || {};
    log(`getCards() ext: ${JSON.stringify(ext)}`);

    let categoryId = 2142788; // 强制默认热门电影
    log(`强制使用 ID: ${categoryId}`);

    if (ext.tid !== undefined) {
        const tid = parseInt(clean(ext.tid), 10);
        if (!isNaN(tid)) {
            categoryId = tid;
            log(`从 tid 切换到: ${categoryId}`);
        }
    }

    const page = ext.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data?.items?.length) {
            log("后端返回空");
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

async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
