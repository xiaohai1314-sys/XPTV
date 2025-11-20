// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - V2.0 (严谨模仿“天逸搜”结构版)

// ================== 配置区 ==================
const API_ENDPOINT = "http://192.168.10.105:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const DEBUG = true;

const POSTER_DEFAULT = "https://img.icons8.com/ios-filled/500/film-reel.png";

// ================== 工具方法 (保持不变 ) ==================
function log(msg ) {
    if (DEBUG) console.log(`[趣乐兔插件 V2.0] ${msg}`);
}

function argsify(ext) {
    return (typeof ext === "string") ? JSON.parse(ext) : (ext || {});
}

function jsonify(obj) {
    return JSON.stringify(obj);
}

// ================== 插件初始化 (★ 严谨模仿“天逸搜” ★) ==================
// 1. 定义一个与“天逸搜”结构完全相同的 appConfig 对象
const appConfig = {
  ver: 2.0, // 版本号可自定义
  title: "趣乐兔", // 插件主标题
  site: SITE_URL,
  tabs: [{
    name: '只有搜索功能', // 分类名，与“天逸搜”完全一致
    ext: {
      url: '/' // 扩展参数，与“天逸搜”完全一致
    },
  }]
};

// 2. getConfig 函数仅返回这个预定义的 appConfig 对象
async function getConfig() {
  return jsonify(appConfig);
}

// ================== 核心函数 (部分模仿，部分保留) ==================

// 3. getCards 函数，与“天逸搜”的实现完全一致，返回空列表
async function getCards(ext) {
  ext = argsify(ext);
  let cards = [];
  return jsonify({
    list: cards,
  });
}

// 您的“分类锁”逻辑，保持不变
let SEARCH_END = {};

// 核心搜索函数 search，保持您原有的逻辑不变
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || "";
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (SEARCH_END[keyword] && page > 1) {
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
            log(`[search] 关键词 "${keyword}" 已被锁定为最后一页`);
        }
        
        return jsonify({
            list: cards,
            page: page,
            pagecount: SEARCH_END[keyword] ? page : page + 1,
            total: cards.length
        });

    } catch (e) {
        log(`[search] 出错: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ================== 详情页与兼容函数 (保持不变) ==================

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
