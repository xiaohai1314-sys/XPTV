/**
 * Nullbr 影视库前端插件 - V27.1 (弹窗日志版：Tab 正常 + 内容切换 + 强制弹 Toast 日志)
 * 修复：
 * 1. category() 正确解析 App 传入的 { name, ext } 对象
 * 2. getCards() 强制净化 ext.id
 * 3. log() 改为弹窗 Toast（你 App 必能看到！）
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 关键：log() 改为弹窗 Toast ★★★
function log(msg) {
    const text = `[Nullbr V27.1] ${msg}`;
    console.log(text);
    try {
        if (typeof $utils !== 'undefined' && $utils.toastError) {
            $utils.toastError(text, 5000);  // 红色错误弹窗，5秒
        } else if (typeof $utils !== 'undefined' && $utils.toast) {
            $utils.toast(text, 5000);       // 普通弹窗
        } else if (typeof alert !== 'undefined') {
            alert(text);                    // 兜底：系统弹窗
        }
    } catch (e) {
        // 静默失败
    }
}

// ★★★ 彻底清理字符串（防不可见字符）★★★
function clean(str) {
    return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim();
}

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口 ----------------
async function init(ext) { return getConfig(); }

async function getConfig() {
    return jsonify({
        ver: 27.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ★★★ home() 不变 —— 保证 Tab 正常显示 ★★★
async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// ----------------- category：修复对象解析 -----------------
async function category(tid, pg, filter, ext) {
    log(`category() 传入 tid: ${JSON.stringify(tid)}`); // ← 必弹窗！
    let id = null;

    // 1. 对象处理（App 真实传参）
    if (typeof tid === "object" && tid !== null) {
        if (tid.ext?.id !== undefined) {
            id = tid.ext.id;
            log(`category()：从 ext.id 取到 ${id}`);
        } else if (tid.id !== undefined) {
            id = tid.id;
            log(`category()：从 id 取到 ${id}`);
        } else if (tid.name) {
            const cleaned = clean(tid.name);
            const found = CATEGORIES.find(c => clean(c.name) === cleaned);
            if (found) {
                id = found.ext.id;
                log(`category()：通过 name 匹配 → ID ${id}`);
            }
        }
    }

    // 2. 字符串处理（兼容）
    if (!id && typeof tid === "string") {
        const cleaned = clean(tid);
        const n = parseInt(cleaned, 10);
        if (!isNaN(n)) {
            id = n;
            log(`category()：字符串转数字 → ${id}`);
        } else {
            const found = CATEGORIES.find(c => clean(c.name) === cleaned);
            if (found) {
                id = found.ext.id;
                log(`category()：字符串 name 匹配 → ${id}`);
            }
        }
    }

    // 3. 回退默认
    if (!id) {
        log("category()：解析失败，使用默认分类");
        id = CATEGORIES[0].ext.id;
    }

    log(`category() 最终 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// ----------------- getCards：强制转数字 -----------------
async function getCards(ext) {
    log(`getCards() 传入 ext: ${JSON.stringify(ext)}`);

    let categoryId = null;
    if (ext && ext.id !== undefined) {
        categoryId = parseInt(clean(ext.id), 10);
        if (isNaN(categoryId)) {
            log(`getCards()：id 解析失败，原始值: "${ext.id}"`);
            categoryId = null;
        } else {
            log(`getCards()：成功解析 id → ${categoryId}`);
        }
    }

    if (!categoryId) {
        log("getCards()：id 无效，使用默认");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`getCards() 请求后端: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data || !Array.isArray(data.items)) {
            log("getCards()：后端返回空 items");
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
        log(`getCards() 请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 -----------------
async function detail(id) { 
    log(`detail 未实现: ${id}`); 
    return jsonify({ list: [] }); 
}

async function play(flag, id, flags) { 
    log(`play 未实现: ${id}`); 
    return jsonify({ url: "" }); 
}

async function search(wd, quick) { 
    log(`search 未实现: ${wd}`); 
    return jsonify({ list: [] }); 
}
