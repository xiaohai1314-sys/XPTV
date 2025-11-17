/**
 * Nullbr 影视库前端插件 - V36.0 (终极架构版)
 *
 * 变更日志:
 * - V36.0 (2025-11-17):
 *   - [架构对齐] 在明确后端存在的前提下，全面看齐“观影网”案例的成功实践。
 *   - [废弃category] 彻底废弃不稳定的 category 函数，避免对 tid 的复杂解析。
 *   - [强化home] 在 home 函数的分类定义中，直接包含用于请求的ID。
 *   - [统一入口] 使用统一的 getCards 函数来处理所有列表请求，它只负责从 ext 中取 id。
 *   - 这是基于对整个系统（前端+App+后端）的正确理解后，提出的最健壮、最可靠的方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

// ★ 指向你自己的后端服务器
const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V36.0] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }

// --- 数据定义 (直接定义请求ID) ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口函数 ----------------

async function init(ext) {
    log("插件初始化...");
    return jsonify({});
}

async function getConfig() {
    return jsonify({
        ver: 36.0,
        title: 'Nullbr影视库 (V36)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ★★★ 核心改动点 1: home 函数现在是唯一的数据定义源 ★★★
async function home() {
    log("加载首页...");
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// ★★★ 核心改动点 2: 废弃 category 函数 ★★★
// 我们假设App会直接调用一个通用的列表函数，或者我们可以在App设置里指定首页点击后调用 getCards
// 为了安全起见，我们保留一个空的category函数，以防万一。
async function category(tid, pg, filter, ext) {
    log("category函数被调用，但在此架构中被忽略。");
    // 直接将参数透传给 getCards
    return getCards(ext);
}


// ★★★ 核心改动点 3: getCards 作为统一的列表获取函数 ★★★
async function getCards(ext) {
    ext = argsify(ext); // 确保 ext 是一个对象
    log(`getCards() 调用，接收到 ext: ${JSON.stringify(ext)}`);
    
    // 直接从 ext 中获取 id，这是最可靠的方式
    const id = ext.id;
    const page = ext.page || 1;

    if (!id) {
        log("getCards() 错误: ext 中没有找到 id。");
        return jsonify({ list: [] });
    }

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
    log(`getCards() 最终请求后端 URL: ${url}`);

    try {
        // 注意：你的后端返回的是纯JSON，不是 response.data
        const data = await $fetch.get(url);

        if (!data || !Array.isArray(data.items)) {
            log(`后端返回的数据格式不正确或 items 数组为空。`);
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        log(`请求后端或解析失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 其他函数 -----------------
async function detail(id) { log(`detail() 未实现，ID: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play() 未实现，ID: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search() 未实现，关键词: ${wd}`); return jsonify({ list: [] }); }
