// 文件名: plugin_funletu.js
// 描述: “趣乐兔”搜索插件 - 完整版（支持多页 + 智能分页 + 海报美化 A）

// ----------------- 配置区 -----------------
const API_ENDPOINT = "http://192.168.1.7:3005/search";
const SITE_URL = "https://pan.funletu.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEBUG = true;

// ★★★ 海报样式方案 A：统一封面 ★★★
const POSTER_DEFAULT = "https://i.imgs.ovh/2024/01/01/default.jpg";

// ----------------- 常用辅助函数 -----------------
function log(msg) {
    if (DEBUG) console.log(`[趣乐兔插件] ${msg}`);
}

function argsify(ext) {
    return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {});
}

function jsonify(data) {
    return JSON.stringify(data);
}

// ----------------- 插件入口 -----------------

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


// ----------------- 核心：搜索功能（含智能分页） -----------------

async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || "";
    const page = parseInt(ext.page || 1, 10);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    const keyword = encodeURIComponent(searchText);
    const requestUrl = `${API_ENDPOINT}?keyword=${keyword}&page=${page}`;

    log(`[search] 请求第 ${page} 页: ${requestUrl}`);

    try {
        const { data: jsonString } = await $fetch.get(requestUrl, {
            headers: { "User-Agent": UA }
        });

        const response = JSON.parse(jsonString);

        if (response.code !== 200 || !response.data?.list) {
            return jsonify({ list: [] });
        }

        const list = response.data.list;

        // -------- 格式化卡片数据 --------
        const cards = list.map(item => ({
            vod_id: item.url,
            vod_name: item.title,
            vod_pic: POSTER_DEFAULT,      // ★ 使用统一海报 ★
            vod_remarks: item.size || "",
            ext: { pan_url: item.url }
        }));

        // ======================================================
        // ★★★ 智能分页：自动检测下一页是否还有数据 ★★★
        // ======================================================
        let hasMore = false;

        try {
            const nextUrl = `${API_ENDPOINT}?keyword=${keyword}&page=${page + 1}`;
            const { data: nextString } = await $fetch.get(nextUrl, {
                headers: { "User-Agent": UA }
            });
            const nextRes = JSON.parse(nextString);

            if (nextRes.code === 200 &&
                Array.isArray(nextRes.data?.list) &&
                nextRes.data.list.length > 0) {

                hasMore = true;  // 说明有下一页
            }

        } catch (e) {
            // 请求失败默认视为没有下一页
        }

        log(`[search] 本页数量: ${cards.length}, hasMore=${hasMore}`);

        // 通知 App 如何翻页（关键）
        return jsonify({
            list: cards,
            page: page,
            pagecount: hasMore ? page + 1 : page,
            pages: hasMore ? page + 1 : page,
            hasmore: hasMore,
            total: cards.length
        });

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// ----------------- 提取网盘链接 -----------------

async function getTracks(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan_url || ext.id;

    if (!panUrl) return jsonify({ list: [] });

    return jsonify({
        list: [
            {
                title: "在线播放",
                tracks: [
                    {
                        name: "夸克网盘",
                        pan: panUrl
                    }
                ]
            }
        ]
    });
}


// ----------------- 兼容接口（保持原样） -----------------
async function init() { return getConfig(); }

async function home() {
    const cfg = await getConfig();
    const tabs = JSON.parse(cfg).tabs;
    return jsonify({ class: tabs, filters: {} });
}

async function category(tid, pg) {
    return jsonify({ list: [] });
}

async function detail(id) {
    return getTracks({ id });
}

async function play(flag, id) {
    return jsonify({ url: id });
}
