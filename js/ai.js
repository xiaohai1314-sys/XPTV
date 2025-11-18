// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - 完整版（精准分页 + 统一海报 + 稳定兼容 + 分页锁）

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.10.105:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

// ★★★ 使用你指定的海报图片 ★★★
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
            { name: "搜索", ext: {} }
        ]
    });
}

// ================== 分页锁记录 ==================
let SEARCH_END = {};   // 记录某个关键词是否已经确定只有一页

// ================== 核心：搜索（精准分页版 + 分页锁） ==================
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || "";
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    // 如果以前已经判定该关键词只有 1 页，则永远不让翻页
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

        // ======= 格式化 UI 卡片 =======
        const cards = list.map(item => ({
            vod_id: item.url,
            vod_name: item.title,
            vod_pic: POSTER_DEFAULT,       // ★ 统一海报
            vod_remarks: item.size || "",
            ext: { pan_url: item.url }
        }));

        // ======= 分页锁判定 =======
        if (list.length < pageSize) {
            SEARCH_END[keyword] = true;  // 当前页不足 → 说明只有1页
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

async function category() {
    return jsonify({ list: [] });
}

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
