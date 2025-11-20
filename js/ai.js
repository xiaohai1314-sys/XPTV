// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - V1.6 (终极静态入口版)

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.10.105:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

const POSTER_DEFAULT = "https://img.icons8.com/ios-filled/500/film-reel.png";

// ================== 工具方法 ==================
function log(msg ) {
    if (DEBUG) console.log(`[趣乐兔插件 V1.6] ${msg}`);
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
        ver: 1.6,
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

// ★★★★★【V1.6 终极修正：在 home() 中直接返回完整静态结构】★★★★★
async function home() {
    const cfg = await getConfig();
    const tabs = JSON.parse(cfg).tabs;
    
    // 直接在 home() 的响应中包含 class 和一个空的 list
    // App 看到 list 已存在，就不会再去调用 category()，从而避免所有问题
    return jsonify({ 
        class: tabs, 
        list: [] // 关键：直接提供一个空列表，让App认为首页加载已完成
    });
}

// category 函数现在根本不会被调用，但我们依然保留最简单的形式以防万一
async function category() {
    return jsonify({ list: [] });
}

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
