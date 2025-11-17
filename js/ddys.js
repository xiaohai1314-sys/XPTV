/**
 * Nullbr 影视库前端插件 - V42.1 (最终兼容版)
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(x){ return JSON.stringify(x); }
function log(x){ console.log("[V42.1] " + x); }

/* ★★★ Vidplay 标准分类格式（顶层必须是 id） ★★★ */
const CATEGORIES = [
    { name: '热门电影', id: 2142788 },
    { name: '热门剧集', id: 2143362 },
    { name: '高分电影', id: 2142753 },
    { name: '高分剧集', id: 2143363 }
];

async function init(ext){ return jsonify({}); }

async function getConfig(){
    return jsonify({
        ver: 42.1,
        title: "Nullbr 影视库",
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home(){
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

/* ★★★ category 现在可靠接收 tid.id ★★★ */
async function category(tid, pg){
    log("category() 调用, tid=" + JSON.stringify(tid));

    let id = null;

    if (tid && typeof tid === "object" && tid.id){
        id = tid.id;
    } else if (typeof tid === "number"){
        id = tid;
    }

    if (!id){
        id = CATEGORIES[0].id;
    }

    log("最终分类 ID = " + id);

    return getCards({ id, page: pg || 1 });
}

/* ★★★ 使用 /api/list/:id?page=1 ★★★ */
async function getCards(ext){
    const url = `${API_BASE_URL}/api/list/${ext.id}?page=${ext.page}`;
    log("请求后端：" + url);

    try{
        const res = await $fetch.get(url);
        const data = typeof res === "string" ? JSON.parse(res) : res;

        if (!data.items) return jsonify({ list: [] });

        const list = data.items.map(v => ({
            vod_id: `${v.media_type}_${v.tmdbid}`,
            vod_name: v.title,
            vod_pic: v.poster ? TMDB_IMAGE_BASE_URL + v.poster : "",
            vod_remarks: v.vote_average ? `⭐${v.vote_average.toFixed(1)}` : ""
        }));

        return jsonify({
            list,
            page: data.page,
            pagecount: data.total_page,
            total: data.total_items
        });

    }catch(e){
        log("失败: " + e.message);
        return jsonify({ list: [] });
    }
}

async function detail(id){ return jsonify({}); }
async function play(flag,id,flags){ return jsonify({url:""}); }
async function search(wd){ return jsonify({list:[]}); }
