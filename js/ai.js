// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - 彻底修正版（首页不转圈 + 锁优化）

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.1.7:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

// 固定占位海报
const POSTER_DEFAULT = "https://img.icons8.com/ios-filled/500/film-reel.png";

// ================== 工具方法 ==================
function log(msg) {
    if (DEBUG) console.log(`[趣乐兔插件] ${msg}`);
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
        ver: 1.0,
        title: "趣乐兔搜索",
        site: SITE_URL,
        tabs: [
            { name: "搜索", ext: { text: "", id: 1, type: 3 } } // 加 id/type 确保 App 分类识别
        ]
    });
}

// ================== 分页锁记录 ==================
let SEARCH_END = {};   // 记录单页关键词
let LAST_KEYWORD = ""; // 上一次搜索关键词

// ================== 核心搜索函数 ==================
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || "";
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    // 搜索切换时清理锁
    if (keyword !== LAST_KEYWORD) {
        SEARCH_END = {};
        LAST_KEYWORD = keyword;
        log(`[search] 新关键词 "${keyword}"，清理锁`);
    }

    // 已锁定单页且请求页>1，阻止翻页
    if (SEARCH_END[keyword] && page > 1) {
        log(`[search] 关键词 "${keyword}" 单页锁生效，阻止翻页`);
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

        // 格式化卡片，固定占位海报
        const cards = list.map(item => ({
            vod_id: item.url,
            vod_name: item.title,
            vod_pic: POSTER_DEFAULT,
            vod_remarks: item.size || "",
            ext: { pan_url: item.url }
        }));

        // 锁定逻辑：当前页不足 pageSize → 单页/末页锁定
        if (list.length < pageSize) {
            SEARCH_END[keyword] = true;
            log(`[search] 关键词 "${keyword}" 单页或末页锁定`);
        }

        const hasMore = list.length === pageSize && !SEARCH_END[keyword];

        log(`[search] 当前页数量=${list.length}, hasMore=${hasMore}`);

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
    // filters 返回固定结构，避免 App 二次请求触发转圈
    return jsonify({ class: tabs, filters: { all: [] } });
}

async function category() {
    return jsonify({ list: [] });
}

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
