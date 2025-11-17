/**
 * Nullbr 影视库前端插件 - V39.0 (终极健壮版)
 *
 * 变更日志:
 * - V39.0 (2025-11-17):
 *   - [最终解决方案] 基于对V27“带病运行”的深刻理解，提出最终修复方案。
 *   - [重写category] 彻底重写 category 函数，采用多层防御策略，不惜一切代价从传入的 tid 中解析出ID，这是本次修复的核心。
 *   - [简化getCards] getCards 不再进行任何ID检查和回退，完全信任 category 传来的ID。
 *   - [保留有效逻辑] 保留并优化了V27中被证明可行的 getCards 数据请求和解析部分。
 *   - 此版本旨在彻底解决“只有一个分类内容”的问题。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V39.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口函数 (保持不变) ----------------

async function init(ext) { return getConfig(); }

async function getConfig() {
    return jsonify({
        ver: 39.0,
        title: 'Nullbr影视库 (V39)',
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

async function home() {
    return jsonify({
        class: CATEGORIES, 
        filters: {}
    });
}

// ★★★★★【这是本次修复的绝对核心：一个无懈可击的 category 函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 收到原始 tid: ${JSON.stringify(tid)}`);
    let id = null;
    const page = pg || 1;

    // --- 防御层 1: 检查 ext 参数 (某些App会把分类信息放在ext里) ---
    if (ext) {
        try {
            const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
            if (extObj?.id) id = extObj.id;
            else if (extObj?.ext?.id) id = extObj.ext.id;
        } catch (e) {}
        if (id) log(`ID识别策略1: 从 ext 参数中获取成功 -> ${id}`);
    }

    // --- 防御层 2: 检查 tid 参数 (标准路径) ---
    if (!id && tid) {
        // 2a: tid 是对象 { id: ... } 或 { ext: { id: ... } }
        if (typeof tid === 'object') {
            if (tid.id) id = tid.id;
            else if (tid.ext?.id) id = tid.ext.id;
            if (id) log(`ID识别策略2a: 从 tid 对象中获取成功 -> ${id}`);
        }
        // 2b: tid 是数字
        else if (typeof tid === 'number') {
            id = tid;
            log(`ID识别策略2b: 从 tid 数字中获取成功 -> ${id}`);
        }
        // 2c: tid 是字符串
        else if (typeof tid === 'string') {
            const trimmedTid = tid.trim();
            const n = parseInt(trimmedTid);
            if (!isNaN(n)) { // 字符串是纯数字
                id = n;
                log(`ID识别策略2c-1: 从 tid 数字字符串中获取成功 -> ${id}`);
            } else { // 字符串是分类名
                const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
                if (foundCategory) {
                    id = foundCategory.ext.id;
                    log(`ID识别策略2c-2: 从 tid 分类名中获取成功 -> ${id}`);
                }
            }
        }
    }

    // --- 防御层 3: 最终回退 ---
    if (!id) {
        log("警告: 所有ID识别策略均失败！回退到第一个分类。");
        id = CATEGORIES[0].ext.id;
    }

    log(`最终解析出的分类ID为: ${id}`);
    return getCards({ id: id, page: page });
}


// ★★★★★【这是配合修复的、被简化的 getCards 函数】★★★★★
async function getCards(ext) {
    // getCards 不再做任何逻辑判断，完全信任 category
    const categoryId = ext.id;
    const page = ext.page;

    log(`getCards() 收到清晰的指令: id=<LaTex>${categoryId}, page=$</LaTex>{page}`);

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`getCards() 最终请求后端：${url}`);

    try {
        // 保留V27被证明可行的请求和解析逻辑
        const response = await $fetch.get(url);
        
        // 增加对 response 本身的健壮性判断
        if (!response) {
            throw new Error("请求返回为空 (null or undefined)");
        }

        // 尝试多种方式解析数据，以应对不同环境
        let data;
        if (typeof response === 'object' && response.data) { // 优先使用 .data
            data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        } else if (typeof response === 'string') { // 如果返回的是纯字符串
            data = JSON.parse(response);
        } else if (typeof response === 'object') { // 如果返回的是纯对象
            data = response;
        } else {
            throw new Error("无法识别的响应格式");
        }

        if (!data || !Array.isArray(data.items)) {
            log("后端返回的数据中没有 items 数组");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => {
            return {
                vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
        });
        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items
        });
    } catch (err) {
        log(`getCards() 请求或解析失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------- 占位函数 (保持不变) -----------------
async function detail(id) { log(`detail 未实现: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`play 未实现: ${id}`); return jsonify({ url: "" }); }
async function search(wd, quick) { log(`search 未实现: ${wd}`); return jsonify({ list: [] }); }
