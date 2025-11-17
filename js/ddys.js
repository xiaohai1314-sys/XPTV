/**
 * Nullbr 影视库前端插件 - V43 (分类显示修复最终版)
 */

const API_BASE_URL = "http://192.168.1.7:3003";
const TMDB = "https://image.tmdb.org/t/p/w500";

function jsonify(o){ return JSON.stringify(o); }
function log(s){ console.log("[V43] " + s); }

// ★★★ 分类采用 Vidplay 官方支持格式：type_id ★★★
const CATEGORIES = [
    { type_name: "热门电影", type_id: "2142788" },
    { type_name: "热门剧集", type_id: "2143362" },
    { type_name: "高分电影", type_id: "2142753" },
    { type_name: "高分剧集", type_id: "2143363" }
];

async function init(ext){ return jsonify({}); }

async function getConfig() {
    return jsonify({
        ver: 43,
        title: "Nullbr影视库",
        site: API_BASE_URL,
        tabs: CATEGORIES     // Vidplay 只认这结构
    });
}

async function home() {
    return jsonify({
        class: CATEGORIES,   // 必须提供 class，否则不显示
        filters: {}
    });
}

async function category(tid, pg) {
    log("收到分类参数：" + JSON.stringify(tid));
    
    let id = null;
    
    // tid = { type_name: "热门电影", type_id: "2142788" }
    if (tid && tid.type_id) id = tid.type_id;

    if (!id) id = CATEGORIES[0].type_id;

    log("最终分类ID：" + id);

    return getCards({ id, page: pg || 1 });
}

async function getCards(ext) {
    const url = `${API_BASE_URL}/api/list/${ext.id}?page=${ext.page}`;
    log("请求：" + url);

    try {
        const res = await $fetch.get(url);
        const data = typeof res === "string" ? JSON.parse(res) : res;

        if (!data.items) return jsonify({ list: [] });

        const list = data.items.map(v => ({
            vod_id: `${v.media_type}_${v.tmdbid}`,
            vod_name: v.title,
            vod_pic: v.poster ? TMDB + v.poster : "",
            vod_remarks: v.vote_average ? `⭐${v.vote_average.toFixed(1)}` : ""
        }));

        return jsonify({
            list,
            page: data.page,
            pagecount: data.total_page,
            total: data.total_items
        });

    } catch(e){
        log("错误：" + e.message);
        return jsonify({ list: [] });
    }
}

async function detail(id){ return jsonify({}); }
async function play(flag,id){ return jsonify({url:""}); }
async function search(wd){ return jsonify({list:[]}); }
