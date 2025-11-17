/**
 * Nullbr 影视库前端插件 - V42.0 (回归正确版)
 *
 * 变更日志:
 * - V42.0 (2025-11-17):
 *   - [拨乱反正] 基于用户反馈“V40可以显示分类”，确认了 jsonify 是必须的，且 CATEGORIES 定义不能有额外属性。
 *   - [回归V40基础] 使用V40被证明能正确显示分类的 home() 和 CATEGORIES 定义。
 *   - [嫁接V40.1优点] 引入V40.1中强大的、支持双重名称查找的 category() 函数逻辑，并进行适配。
 *   - [保持路径通信] 坚持使用V40被证明有效的 /api/list/ID 的路径参数通信方式。
 *   - 这份代码旨在同时解决“分类能显示”和“分类能切换”两个核心问题。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V42.0] " + msg); }

// ★★★ 使用V40被证明能成功显示分类的、纯净的CATEGORIES定义 ★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// 为了在category函数中实现双重名称查找，我们单独定义一个查找表
const NAME_LOOKUP = {
    'IMDB：热门电影': 2142788,
    'IMDB：热门剧集': 2143362,
    'IMDB：高分电影': 2142753,
    'IMDB：高分剧集': 2143363
};

// ---------------- 入口函数 (回归V40) ----------------

async function init(ext) { return jsonify({}); }

async function getConfig() {
    return jsonify({
        ver: 42.0,
        title: 'Nullbr影视库 (V42)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ★★★ 使用V40被证明能成功显示分类的 home() 函数 ★★★
async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// ★★★ 嫁接并适配了V40.1的强大category函数 ★★★
async function category(tid, pg, filter, ext) {
    log("category() 调用，tid 原始值: " + JSON.stringify(tid));
    let id = null;

    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext && tid.ext.id) id = tid.ext.id;
    } else if (typeof tid === "number") {
        id = tid;
    }
    
    if (!id && typeof tid === "string") {
        const trimmedTid = tid.trim();
        const n = parseInt(trimmedTid);
        if (!isNaN(n)) {
            id = n;
        } else {
            // 先在 CATEGORIES 的 name 中查找
            for (let i = 0; i < CATEGORIES.length; i++) {
                if (CATEGORIES[i].name === trimmedTid) {
                    id = CATEGORIES[i].ext.id;
                    break;
                }
            }
            // 如果找不到，再去 NAME_LOOKUP 查找表中查找
            if (!id && NAME_LOOKUP[trimmedTid]) {
                id = NAME_LOOKUP[trimmedTid];
            }
        }
    }

    if (!id) {
        log("category()：解析失败，回退到默认 ID");
        id = CATEGORIES[0].ext.id;
    }

    log("category() 解析后的最终分类 ID：" + id);
    return getCards({ id: id, page: pg || 1 });
}

// ★★★ 使用V40被证明有效的 getCards 函数 ★★★
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page;

    const url = API_BASE_URL + "/api/list/" + categoryId + "?page=" + page;
    log("getCards() 最终请求后端：" + url);

    try {
        const response = await $fetch.get(url);
        // 假设后端返回的是纯JSON对象或可解析的JSON字符串
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(function(item) {
            return {
                vod_id: item.media_type + "_" + item.tmdbid,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? TMDB_IMAGE_BASE_URL + item.poster : "",
                vod_remarks: item.vote_average > 0 ? "⭐ " + item.vote_average.toFixed(1) : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log("请求失败：" + err.message);
        return jsonify({ list: [] });
    }
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
