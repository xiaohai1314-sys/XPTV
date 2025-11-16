/**
 * Nullbr 影视库前端插件 - V29.1 (终极诊断+修复版：强制暴露 tid + 自动切换)
 * 关键：getCards() 打印 ext.tid + ext.id + 所有字段
 *       保留 home() 原结构，保证 Tab 显示
 *       0 回退，问题必暴露
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }

// ★★★ 强制红色 Toast 日志 ★★★
function log(msg) {
    const text = `[V29.1 诊断] ${msg}`;
    console.log(text);
    try { $utils.toastError(text, 8000); } catch (_) { try { $utils.toast(text, 8000); } catch (_) { alert?.(text); } }
}

function clean(str) { return String(str || '').replace(/[\u200B-\u200D\uFEFF\r\n\t ]/g, '').trim(); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

async function init(ext) { log(`init ext: ${JSON.stringify(ext)}`); return getConfig(); }
async function getConfig() { return jsonify({ ver: 29.1, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES }); }

// ★★★ home() 不变，保证 Tab 显示 ★★★
async function home() {
    log("home() 返回 class");
    return jsonify({ class: CATEGORIES, filters: {} });
}

// ★★★ getCards：强制诊断 ext.tid ★★★
async function getCards(ext) {
    ext = ext || {};
    log(`===== getCards() 诊断 START =====`);
    log(`ext 完整对象: ${JSON.stringify(ext)}`);
    log(`ext.tid: ${JSON.stringify(ext.tid)} (类型: ${typeof ext.tid})`);
    log(`ext.id: ${JSON.stringify(ext.id)} (类型: ${typeof ext.id})`);
    log(`ext.page: ${ext.page}`);

    let categoryId = null;

    // 1. 优先 ext.tid
    if (ext.tid !== undefined) {
        const cleaned = clean(ext.tid);
        categoryId = parseInt(cleaned, 10);
        if (!isNaN(categoryId)) {
            log(`[成功] 从 ext.tid 解析 → ID ${categoryId}`);
        } else {
            log(`[失败] ext.tid 转数字失败: "${ext.tid}" → "${cleaned}"`);
        }
    }
    // 2. 再 ext.id
    else if (ext.id !== undefined) {
        const cleaned = clean(ext.id);
        categoryId = parseInt(cleaned, 10);
        if (!isNaN(categoryId)) {
            log(`[成功] 从 ext.id 解析 → ID ${categoryId}`);
        } else {
            log(`[失败] ext.id 转数字失败: "${ext.id}" → "${cleaned}"`);
        }
    }

    // 3. 0 回退
    if (!categoryId || isNaN(categoryId)) {
        log(`[致命错误] 无法获取有效 ID！请求失败`);
        log(`===== getCards() END (失败) =====`);
        return jsonify({ list: [] });
    }

    const page = ext.page || 1;
    const url = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`[成功] 请求 URL: ${url}`);
    log(`===== getCards() END =====`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (!data?.items?.length) return jsonify({ list: [] });

        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date?.substring(0,4) || '')
        }));

        return jsonify({ list: cards, page, pagecount: data.total_page || 1, limit: cards.length, total: data.total_items || 0 });
    } catch (err) {
        log(`请求异常: ${err.message}`);
        return jsonify({ list: [] });
    }
}

async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
