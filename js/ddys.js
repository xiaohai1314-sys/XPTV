/**
 * Nullbr 影视库前端插件 - V1.1 (修正分类ID传递问题)
 *
 * 变更日志:
 * - 修正了 category 函数，确保能正确接收和处理 App 传递的分类 ID (tid)。
 * - 增强了 getCards 函数的健壮性，使其能处理多种参数来源。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请确保此地址正确
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 (无变化) ---
function jsonify(data) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件] ${message}`); }

// --- App 插件入口函数 ---

// getConfig 函数 (无变化)
async function getConfig() {
    log("初始化插件配置 (V1.1)...");
    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];
    return jsonify({
        ver: 1.1,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories,
    });
}

// ★★★★★【核心修正】★★★★★
/**
 * App 在用户点击分类 Tab 或翻页时调用此函数。
 * 这是插件的核心数据获取函数，现在能处理来自 category 或直接调用的参数。
 * @param {object} params - 包含 id 和 page 的对象, 例如 { id: 2142788, page: 1 }。
 */
async function getCards(params) {
    // 从参数中安全地获取 id 和 page
    const categoryId = params.id;
    const page = params.page || 1;

    // 如果 categoryId 不存在，立即停止并报错，防止向后端发送无效请求
    if (!categoryId) {
        log("错误：getCards 函数收到的分类 ID (id) 为空！");
        return jsonify({ list: [] });
    }

    const requestUrl = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`正在请求分类数据: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("返回的数据格式不正确，缺少 items 数组。");
        }

        const cards = data.items.map(item => {
            const vod_id = `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`;
            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}`,
                vod_remarks: item.vote_average > 0
                    ? `⭐ ${item.vote_average.toFixed(1)}`
                    : (item.release_date ? item.release_date.substring(0, 4) : '未知'),
            };
        });

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
            limit: cards.length,
            total: data.total_items,
        });

    } catch (e) {
        log(`请求分类 <LaTex>${categoryId} 失败: $</LaTex>{e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口和未实现的功能 ---

async function init(ext) { return getConfig(); }

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({ class: config.tabs, filters: {} });
}

// ★★★★★【核心修正】★★★★★
/**
 * App 点击分类时主要调用的函数。
 * @param {string|object} tid - 分类ID，可能是字符串或对象。
 * @param {string} pg - 页码。
 */
async function category(tid, pg, filter, ext) {
    log(`category 函数被调用: tid=<LaTex>${JSON.stringify(tid)}, pg=$</LaTex>{pg}`);
    // 兼容不同的 App 环境，有些 tid 是字符串，有些是 ext 对象里的 id
    const categoryId = (typeof tid === 'object' && tid.id) ? tid.id : tid;
    // 调用我们统一的数据获取函数
    return getCards({ id: categoryId, page: pg || 1 });
}

// 以下功能待实现
async function detail(id) {
    log(`[待实现] 请求详情页: ${id}`);
    return jsonify({ list: [] });
}
async function play(flag, id, flags) {
    log(`[待实现] 请求播放: ${id}`);
    return jsonify({ url: '' });
}
async function search(wd, quick) {
    log(`[待实现] 搜索: ${wd}`);
    return jsonify({ list: [] });
}
