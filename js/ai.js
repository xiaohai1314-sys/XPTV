// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - V1.2 (永久占位修复版)

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.10.105:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

const POSTER_DEFAULT = "https://img.icons8.com/ios-filled/500/film-reel.png";

// ================== 工具方法 ==================
function log(msg ) {
    if (DEBUG) console.log(`[趣乐兔插件 V1.2] ${msg}`);
}

function argsify(ext) {
    return (typeof ext === "string") ? JSON.parse(ext) : (ext || {});
}

function jsonify(obj) {
    return JSON.stringify(obj);
}

// ================== 插件初始化 ==================
async function getConfig() {
    return jsonify({
        ver: 1.2,
        title: "趣乐兔搜索",
        site: SITE_URL,
        tabs: [
            { name: "搜索", ext: {} }
        ]
    });
}

// ================== 分页锁记录 ==================
let SEARCH_END = {};

// ================== 核心：搜索（原版完好逻辑） ==================
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || "";
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (SEARCH_END[keyword]) {
        log(`[search] 关键词 "${keyword}" 已锁定为单页`);
        return jsonify({
            list: [],
            page: 1,
            pagecount: 1,
            pages: 1,
            hasmore: false
        });
    }

    const url = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}&page=${page}`;
    log(`[search] 请求 URL: ${url}`);

    try {
        const { data: jsonString } = await $fetch.get(url, {
            headers: { "User-Agent": UA }
        });

        const resp = JSON.parse(jsonString);

        if (resp.code !== 200 || !resp.data?.list) {
            return jsonify({ list: [] });
        }

        const list = resp.data.list;
        const pageSize = 20;

        const cards = list.map(item => ({
            vod_id: item.url,
            vod_name: item.title,
            vod_pic: POSTER_DEFAULT,
            vod_remarks: item.size || "",
            ext: { pan_url: item.url }
        }));

        if (list.length < pageSize) {
            SEARCH_END[keyword] = true;
            log(`[search] 关键词 "${keyword}" 仅有一页，已锁定`);
        }

        const hasMore = !SEARCH_END[keyword];

        log(`[search] 当前页数量 = ${list.length}, hasMore = ${hasMore}`);

        return jsonify({
            list: cards,
            page: page,
            pagecount: hasMore ? page + 1 : page,
            pages: hasMore ? page + 1 : page,
            hasmore: hasMore,
            total: cards.length
        });

    } catch (e) {
        log(`[search] 出错: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ================== 网盘资源 Tracks ==================
async function getTracks(ext) {
    ext = argsify(ext);
    const url = ext.pan_url || ext.id;

    if (!url) return jsonify({ list: [] });

    return jsonify({
        list: [
            {
                title: "在线播放",
                tracks: [
                    { name: "夸克网盘", pan: url }
                ]
            }
        ]
    });
}

// ================== 兼容函数 ==================
async function init() { return getConfig(); }

async function home() {
    const cfg = await getConfig();
    const tabs = JSON.parse(cfg).tabs;
    return jsonify({ class: tabs, filters: {} });
}

// ★★★★★【V1.2 核心修正：让分类页永久占位，不转圈、不消失】★★★★★
async function category() {
    // 创建一个永远不会结束的 Promise，让函数永久挂起
    // 这会使App停留在当前分类页面，tabs不会消失，也不会转圈
    await new Promise(() => {});
    return jsonify({ list: [] }); // 这行代码永远不会被执行
}

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
