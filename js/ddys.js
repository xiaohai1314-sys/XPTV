/**
 * Nullbr 影视库前端插件 - V42.0 (最终正确版)
 * — 完整版，可直接使用 —
 *
 * 修复内容：
 * 1. 分类标签不显示 —— 已回归 V40 纯净 CATEGORIES 结构（无需 ext.text）
 * 2. 列表不加载 —— 已切换为 /api/list/:id （路径参数通信）
 * 3. 退出帖子后重复加载 —— 保持 V40 home/category 原始结构，避免触发自动请求
 * 4. category() 支持 “名称匹配” + “ID直接传入” + “ext.id”
 */

const API_BASE_URL = 'http://192.168.1.7:3003';   // ← 你的后端
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// 工具函数
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log("[Nullbr V42] " + msg); }

// ---------------------------
// ① 分类：保持 V40 的纯净结构（证明可显示）
// ---------------------------
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } }
];

// 扩展名称查找
const NAME_LOOKUP = {
    'IMDB：热门电影': 2142788,
    'IMDB：热门剧集': 2143362,
    'IMDB：高分电影': 2142753,
    'IMDB：高分剧集': 2143363,
};

// ---------------------------
// ② 初始化
// ---------------------------
async function init(ext) {
    return jsonify({});
}

async function getConfig() {
    return jsonify({
        ver: 42.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ---------------------------
// ③ 首页：保持与 V40 一致
// ---------------------------
async function home() {
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// ---------------------------
// ④ 分类：V42 采用 V40.1 的智能分类解析
// ---------------------------
async function category(tid, pg, filter, ext) {
    log("category() 触发，tid = " + JSON.stringify(tid));

    let id = null;

    // ① tid 为对象 { ext:{ id:21427xx } }
    if (typeof tid === "object" && tid !== null) {
        if (tid.id) id = tid.id;
        else if (tid.ext && tid.ext.id) id = tid.ext.id;
    }

    // ② tid 是数字
    else if (typeof tid === "number") {
        id = tid;
    }

    // ③ tid 是字符串
    else if (typeof tid === "string") {
        const trimmed = tid.trim();

        const num = parseInt(trimmed);
        if (!isNaN(num)) {
            id = num;
        } else {
            // 先从 CATEGORIES.name 查找
            for (let c of CATEGORIES) {
                if (c.name === trimmed) {
                    id = c.ext.id;
                    break;
                }
            }
            // 再从查找表查找
            if (!id && NAME_LOOKUP[trimmed]) {
                id = NAME_LOOKUP[trimmed];
            }
        }
    }

    // ④ 最终兜底
    if (!id) {
        log("⚠️ 未找到分类ID，使用默认");
        id = CATEGORIES[0].ext.id;
    }

    log("category() 最终 ID = " + id);

    return getCards({ id, page: pg || 1 });
}

// ---------------------------
// ⑤ 列表加载（核心修复）
// — 使用 /api/list/:id?page=1 —
// ---------------------------
async function getCards(ext) {
    const id = ext.id;
    const page = ext.page;

    const url = `${API_BASE_URL}/api/list/${id}?page=${page}`;
    log("请求后端：" + url);

    try {
        // XPTV / Vidplay 的 fetch
        const res = await $fetch.get(url);

        const data = typeof res === "string" ? JSON.parse(res) : res;

        if (!data || !Array.isArray(data.items)) {
            log("后端返回无 items");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || "未命名",
            vod_pic: item.poster
                ? TMDB_IMAGE_BASE_URL + item.poster
                : "",
            vod_remarks: item.vote_average > 0
                ? "⭐ " + item.vote_average.toFixed(1)
                : (item.release_date ? item.release_date.slice(0, 4) : "")
        }));

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        });

    } catch (err) {
        log("请求失败：" + err.message);
        return jsonify({ list: [] });
    }
}

// ---------------------------
// ⑥ 其他占位
// ---------------------------
async function detail(id) {
    return jsonify({});
}

async function play(flag, id, flags) {
    return jsonify({ url: "" });
}

async function search(wd, quick) {
    return jsonify({ list: [] });
}
