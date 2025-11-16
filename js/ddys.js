/**
 * Nullbr 影视库前端插件 - V21.2 (分类修复 + 列表正常版)
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(v) { return JSON.stringify(v); }
function log(t) { console.log(`[Nullbr V21.2] ${t}`); }


// ---------------------------------------------------------
// getConfig 修复：必须返回 class 才能让 APP 显示分类
// ---------------------------------------------------------
async function getConfig() {
    const categories = [
        { name: 'IMDB：热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];

    return jsonify({
        ver: 21.2,
        title: 'Nullbr影视库',
        site: API_BASE_URL,

        // ★★关键修复：必须返回 class，否则分类不显示★★
        class: categories,

        // ★ 仍然保留你自己定义的 tabs
        tabs: categories
    });
}


// ---------------------------------------------------------
// home：必须使用 config.class 返回分类
// ---------------------------------------------------------
async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.class,   // ★ 不能用 tabs
        filters: {}
    });
}


// ---------------------------------------------------------
// category：V21.1 兼容全部 tid 传参格式
// ---------------------------------------------------------
async function category(tid, pg, filter, ext) {
    log(`category 调用, tid = ${JSON.stringify(tid)}`);

    let id = null;

    if (typeof tid === "object" && tid !== null) {
        id = tid.id || tid.ext?.id;
    }

    if (!id && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) id = n;
    }

    if (!id && typeof tid === "number") {
        id = tid;
    }

    if (!id) {
        log("tid 无效，使用默认分类");
        const cfg = JSON.parse(await getConfig());
        id = cfg.class[0].ext.id;
    }

    log(`解析 id = ${id}`);
    return getCards({ id, page: pg || 1 });
}


// ---------------------------------------------------------
// getCards：与后端保持一致
// ---------------------------------------------------------
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求：${url}`);

    try {
        const res = await $fetch.get(url);
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

        const list = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title,
            vod_pic: `${TMDB_IMAGE_BASE_URL}${item.poster}`,
            vod_remarks:
                item.vote_average > 0
                    ? `⭐ ${item.vote_average.toFixed(1)}`
                    : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        return jsonify({
            list,
            page: data.page,
            pagecount: data.total_page,
            total: data.total_items,
            limit: list.length
        });

    } catch (e) {
        log(`请求失败：${e.message}`);
        return jsonify({ list: [] });
    }
}


// ---------------------------------------------------------
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
// ---------------------------------------------------------
