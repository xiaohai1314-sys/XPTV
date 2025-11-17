/**
 * Nullbr 影视库前端插件 - V37.0 (终极ID识别版)
 *
 * 变更日志:
 * - V37.0 (2025-11-17):
 *   - [最终修正] 接受用户指正，问题的根源在于前端未能从传入的参数中正确识别ID。
 *   - [强化getCards] 重写 getCards 函数的ID提取逻辑，使其能够应对多种可能的参数格式：
 *     1. 直接传入 { id: ... }
 *     2. 传入完整的分类对象 { name: '...', ext: { id: ... } }
 *     3. 传入一个包含 ext 属性的对象 { ..., ext: { id: ... } }
 *   - 这是针对“前端没有真正识别到id”这一核心问题的最终解决方案。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

// ★ 指向你自己的后端服务器
const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V37.0] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }

// --- 数据定义 ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口函数 (保持V36的简洁架构) ----------------

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 37.0, title: 'Nullbr影视库 (V37)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) { return getCards(ext); }


// ★★★★★【终极修正的核心】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    log(`getCards() 收到参数: ${JSON.stringify(ext)}`);

    let id = null;
    let page = 1;

    // 1. 尝试从顶层直接获取 id 和 page (最理想情况)
    if (ext.id) {
        id = ext.id;
        log(`ID识别策略1: 从顶层 ext.id 获取成功 -> ${id}`);
    }

    // 2. 如果顶层没有，尝试从 ext.ext.id 获取 (兼容传入完整分类对象的情况)
    if (!id && ext.ext?.id) {
        id = ext.ext.id;
        log(`ID识别策略2: 从深层 ext.ext.id 获取成功 -> ${id}`);
    }
    
    // 3. 获取页码
    if (ext.page) {
        page = ext.page;
    } else if (ext.pg) { // 兼容某些App用 pg 传递页码
        page = ext.pg;
    }

    // 4. 最终检查
    if (!id) {
        log("所有ID识别策略均失败！无法继续。");
        // 为了调试，我们返回一个包含错误信息的列表项
        return jsonify({
            list: [{
                vod_name: '前端错误：无法识别分类ID',
                vod_remarks: `收到的参数: ${JSON.stringify(ext)}`,
                vod_id: 'error_id'
            }]
        });
    }

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{id}&page=${page}`;
    log(`准备请求后端: ${url}`);

    try {
        const data = await $fetch.get(url);
        if (!data || !Array.isArray(data.items)) {
            return jsonify({ list: [] });
        }
        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        return jsonify({ list: cards, page: data.page, pagecount: data.total_page, limit: cards.length, total: data.total_items });
    } catch (err) {
        log(`请求后端失败: ${err.message}`);
        return jsonify({ list: [{ vod_name: '后端请求失败', vod_remarks: err.message, vod_id: 'error_backend' }] });
    }
}

// ----------------- 其他函数 -----------------
async function detail(id) { return jsonify({ list: [] }); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
