/**
 * Nullbr 影视库前端插件 - V27.7 (诊断专用完整版：强制 Toast 所有关键参数 + 保留 Tab + 精准定位 tid)
 *
 * 目的：让你看到 App 到底传了什么给 category() 和 getCards()
 * 修复：无（仅诊断）
 * 保留：原 V27.0 结构 + 4 个 Tab
 * 完整代码：100% 可直接复制运行
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 超强 Toast 日志（红色 + 5秒 + 强制弹）★★★
function log(msg) {
    const text = `[诊断 V27.7] ${msg}`;
    console.log(text);
    try {
        if ($utils && $utils.toastError) {
            $utils.toastError(text, 5000);
        } else if ($utils && $utils.toast) {
            $utils.toast(text, 5000);
        } else if (typeof alert !== 'undefined') {
            alert(text);
        }
    } catch (e) {}
}

// ★★★ 彻底清理字符串（移除零宽字符、空格、换行等）★★★
function clean(str) {
    return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim();
}

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口函数 ----------------

async function init(ext) {
    log(`init() 被调用，ext: ${JSON.stringify(ext)}`);
    return getConfig();
}

async function getConfig() {
    log("getConfig() 被调用");
    return jsonify({
        ver: 27.7,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ★★★ home() 不变，保证分类 Tab 显示 ★★★
async function home() {
    log("home() 被调用，返回 class");
    return jsonify({
        class: CATEGORIES,
        filters: {}
    });
}

// -------------------- category：强制打印所有参数 --------------------
async function category(tid, pg, filter, ext) {
    log(`===== category() 被调用 =====`);
    log(`tid 原始值: ${JSON.stringify(tid)}`);
    log(`tid 类型: ${typeof tid}`);
    log(`pg: ${pg}`);
    log(`filter: ${JSON.stringify(filter)}`);
    log(`ext: ${JSON.stringify(ext)}`);

    let id = null;

    // 1. 字符串处理
    if (typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
            log(`category()：字符串解析成功 → ID ${id}`);
        } else {
            log(`category()：字符串解析失败，清理后: "${cleaned}"`);
        }
    }

    // 2. 对象处理
    if (!id && typeof tid === "object" && tid !== null) {
        if (tid.id !== undefined) {
            id = tid.id;
            log(`category()：从 tid.id 取到 ${id}`);
        } else if (tid.ext?.id !== undefined) {
            id = tid.ext.id;
            log(`category()：从 tid.ext.id 取到 ${id}`);
        } else if (tid.name) {
            const found = CATEGORIES.find(c => clean(c.name) === clean(tid.name));
            if (found) {
                id = found.ext.id;
                log(`category()：通过 name 匹配 → ID ${id}`);
            }
        }
    }

    // 3. 回退默认
    if (!id) {
        log("category()：所有解析失败，使用默认 ID 2142788");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终返回 ID: ${id}`);
    log(`===== category() 结束 =====`);

    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards：强制打印 ext --------------------
async function getCards(ext) {
    log(`===== getCards() 被调用 =====`);
    log(`ext 完整值: ${JSON.stringify(ext)}`);

    let categoryId = null;
    if (ext && ext.id !== undefined) {
        const cleaned = clean(ext.id);
        categoryId = parseInt(cleaned, 10);
        if (isNaN(categoryId)) {
            log(`getCards()：id 转数字失败，原始: "${ext.id}"`);
        } else {
            log(`getCards()：成功解析 id → ${categoryId}`);
        }
    }

    if (!categoryId) {
        log("getCards()：id 无效，使用默认 2142788");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`最终请求 URL: ${url}`);
    log(`===== getCards() 结束 =====`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
            log("后端返回空 items");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 
                ? `⭐ ${item.vote_average.toFixed(1)}` 
                : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

        return jsonify({
            list: cards,
            page: data.page || page,
            pagecount: data.total_page || 1,
            limit: cards.length,
            total: data.total_items || 0
        });

    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------

async function detail(id) {
    log(`detail() 被调用，id: ${id}`);
    return jsonify({ list: [] });
}

async function play(flag, id, flags) {
    log(`play() 被调用，flag: ${flag}, id: ${id}`);
    return jsonify({ url: "" });
}

async function search(wd, quick) {
    log(`search() 被调用，wd: ${wd}, quick: ${quick}`);
    return jsonify({ list: [] });
}
