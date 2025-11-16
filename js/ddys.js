/**
 * Nullbr 影视库前端插件 - V28.0 (逻辑修正版)
 *
 * 变更日志:
 * - V28.0 (2025-11-17):
 *   - [核心修复] 重构 category() 函数的ID解析逻辑。
 *   - 优先处理 App 传入的分类对象 (tid.ext.id)，这是导致分类内容不变的根本原因。
 *   - 保留对字符串和数字格式的兼容处理作为备用路径。
 *   - 优化了日志，使其更清晰地反映ID解析过程。
 * - V27.0 (由用户提供):
 *   - 引入防御性 .trim() 清理。
 *   - 修正 getCards() 中的模板字符串语法错误。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V28.0] ${msg}`); }

// --- 数据定义 ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// ---------------- 入口：init / getConfig / home ----------------

async function init(ext) {
    log("插件初始化...");
    return getConfig();
}

async function getConfig() {
    return jsonify({
        ver: 28.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES // 定义底部导航栏的Tab
    });
}

async function home() {
    log("加载首页...");
    return jsonify({
        class: CATEGORIES, // 定义分类列表
        filters: {}
    });
}

// -------------------- category (已修复逻辑) --------------------

async function category(tid, pg, filter, ext) {
    log(`category() 调用，接收到原始 tid: ${JSON.stringify(tid)}`);
    let id = null;

    // 1. 【主要路径】优先处理对象格式的 tid。
    // 当用户点击分类时，App通常会传递在 home() 中定义的完整分类对象。
    if (typeof tid === "object" && tid !== null) {
        // 尝试从 tid.ext.id (标准结构) 或 tid.id (兼容其他可能) 获取
        id = tid.ext?.id || tid.id;
        if (id) {
            log(`通过对象解析成功，获取 ID: ${id}`);
        }
    }
    
    // 2. 【备用路径】如果对象解析失败，再尝试处理字符串。
    // 这可以兼容手动测试或某些特殊App环境。
    if (!id && typeof tid === "string") {
        log("对象解析失败，尝试作为字符串处理...");
        const trimmedTid = tid.trim(); // 防御性清理
        const n = parseInt(trimmedTid);

        if (!isNaN(n)) {
            id = n; // tid 是 "2142788" 这样的纯数字字符串
            log(`通过数字字符串解析成功，获取 ID: ${id}`);
        } else {
            // tid 是 "高分电影" 这样的分类名称
            const foundCategory = CATEGORIES.find(cat => cat.name === trimmedTid);
            if (foundCategory) {
                id = foundCategory.ext.id;
                log(`通过分类名称查找成功，获取 ID: ${id}`);
            }
        }
    }

    // 3. 【最终回退】如果所有方法都失败，才使用默认值。
    if (!id) {
        log("所有解析路径均失败，回退到第一个默认分类 ID");
        id = CATEGORIES[0].ext.id;
    }

    log(`最终用于请求的分类 ID: ${id}`);
    return getCards({ id, page: pg || 1 });
}

// -------------------- getCards (语法正确) --------------------

async function getCards(ext) {
    log(`getCards() 调用，接收到 ext: ${JSON.stringify(ext)}`);
    
    // 防御性检查，确保 ext.id 有效
    let categoryId = ext?.id;
    
    if (!categoryId) {
        log("getCards()：ext.id 无效，强制使用默认分类 ID");
        categoryId = CATEGORIES[0].ext.id;
    }

    const page = ext?.page || 1;

    // 使用正确的模板字符串反引号 (`)
    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`getCards() 最终请求后端 URL: ${url}`);

    try {
        const response = await $fetch.get(url);
        // 健壮性处理：后端可能返回字符串或对象
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("后端返回的数据格式不正确或 items 数组为空");
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
        log(`请求后端 API 失败: ${err.message}`);
        return jsonify({ list: [] }); // 出错时返回空列表，避免App崩溃
    }
}

// ----------------- 占位函数 (待实现) -----------------

async function detail(id) {
    log(`detail() 未实现，ID: ${id}`);
    // 这里未来需要根据 id 从后端获取详细信息
    return jsonify({ list: [] });
}

async function play(flag, id, flags) {
    log(`play() 未实现，ID: <LaTex>${id}, Flag: $</LaTex>{flag}`);
    // 这里未来需要根据 id 和 flag 获取播放地址
    return jsonify({ url: "" });
}

async function search(wd, quick) {
    log(`search() 未实现，关键词: ${wd}`);
    // 这里未来需要根据关键词 wd 调用搜索接口
    return jsonify({ list: [] });
}
