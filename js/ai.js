// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - V1.8 (分类锁恢复最终版)

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.10.105:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

const POSTER_DEFAULT = "https://img.icons8.com/ios-filled/500/film-reel.png";

// ================== 工具方法 ==================
function log(msg ) {
    if (DEBUG) console.log(`[趣乐兔插件 V1.8] ${msg}`);
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
        ver: 1.8,
        title: "趣乐兔搜索",
        site: SITE_URL,
        tabs: [
            { name: "仅搜索功能", ext: { url: '/' } }
        ]
    });
}

// ★★★★★【V1.8 核心修正：恢复您的“分类锁”逻辑】★★★★★
let SEARCH_END = {};   // 记录某个关键词是否已经确定只有一页

// ================== 核心：搜索（恢复了分类锁的完好逻辑） ==================
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || "";
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    // 【分类锁】如果以前已经判定该关键词只有 1 页，则永远不让翻页
    if (SEARCH_END[keyword] && page > 1) { // 修正：只在请求第二页及以后时才拦截
        log(`[search] 关键词 "${keyword}" 已锁定为单页，拒绝翻页`);
        return jsonify({ list: [] });
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
        const pageSize = 20; // 假设每页20条

        const cards = list.map(item => ({
            vod_id: item.url,
            vod_name: item.title,
            vod_pic: POSTER_DEFAULT,
            vod_remarks: item.size || "",
            ext: { pan_url: item.url }
        }));

        // 【分类锁】如果当前页返回的结果数小于每页期望数，说明没有下一页了
        if (list.length < pageSize) {
            SEARCH_END[keyword] = true;
            log(`[search] 关键词 "${keyword}" 已被锁定为最后一页`);
        }

        const hasMore = !SEARCH_END[keyword];

        log(`[search] 当前页数量 = ${list.length}, hasMore = ${hasMore}`);

        return jsonify({
            list: cards,
            page: page,
            pagecount: hasMore ? page + 1 : page, // 动态计算总页数
            total: cards.length // 当前返回的数量
        });

    } catch (e) {
        log(`[search] 出错: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ================== 详情页与兼容函数 (保持不变) ==================

async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  return jsonify({
    list: cards,
  });
}

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

async function init() { return getConfig(); }

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
