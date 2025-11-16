/**
 * Nullbr 影视库前端插件 - V21.1 (最终修正版)
 *
 * 修复说明：
 * 1. 完整修复 APP 传入 tid 的各种格式（对象、字符串、数字、undefined）
 *    确保 getCards() 永远会执行，不再出现“分类显示但列表空”的问题。
 * 2. 其他所有架构严格保持 V1.0 / V21.0 风格不变。
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V21.1] ${msg}`); }

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    return getConfig();
}

async function getConfig() {
    const categories = [
        { name: 'IMDB：热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];

    return jsonify({
        ver: 21.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories
    });
}

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

// -------------------- category（核心修复） --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，tid 原始值：${JSON.stringify(tid)}`);

    let id = null;

    // ★ 1. tid 是对象形式
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext?.id) id = tid.ext.id;
    }

    // ★ 2. tid 是字符串形式
    if (!id && typeof tid === "string") {
        const n = parseInt(tid);
        if (!isNaN(n)) id = n;
    }

    // ★ 3. tid 是数字
    if (!id && typeof tid === "number") {
        id = tid;
    }

    // ★ 4. 首次加载：tid = undefined/null
    if (!id) {
        log("tid 无效，使用默认分类 ID");
        const cfg = JSON.parse(await getConfig());
        id = cfg.tabs[0].ext.id;
    }

    log(`解析后的分类 ID：${id}`);

    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards --------------------

async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`请求后端：${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("后端返回空 items");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => {
            return {
                vod_id: `${item.media_type}_${item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
                vod_remarks: item.vote_average > 0
                    ? `⭐ ${item.vote_average.toFixed(1)}`
                    : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        });

    } catch (err) {
        log(`请求失败：${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 详情 / 播放 / 搜索（占位） -----------------

async function detail(id) {
    log(`detail 未实现: ${id}`);
    return jsonify({ list: [] });
}

async function play(flag, id, flags) {
    log(`play 未实现: ${id}`);
    return jsonify({ url: "" });
}

async function search(wd, quick) {
    log(`search 未实现: ${wd}`);
    return jsonify({ list: [] });
}
