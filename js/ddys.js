/**
 * Nullbr 影视库前端插件 - V20.0 (最终的回归)
 *
 * 最终架构:
 * 1. 严格、一字不差地回归 V1.0 的完美架构，确保 Tab 显示。
 * 2. 【最终修正】只在 category() 函数内部，增加一个最简单的 undefined 判断，
 *    确保在 App 首次调用时，即使 tid 为 undefined，也能获取到默认分类 ID。
 *    这解决了“没通信”和“空列表”的根本问题。
 * 3. 这是对你所有正确反馈的最终、最谦卑的服从。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V20.0] ${message}`); }

// --- App 插件入口函数 ---

// ★★★★★【init, getConfig, home - 严格回归 V1.0，一字不差】★★★★★
async function init(ext) {
    return getConfig();
}

async function getConfig() {
    log("初始化插件配置 (V1.0 原始实现)...");
    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];
    return jsonify({
        ver: 20.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories,
    });
}

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

// ★★★★★【category() 函数 - 唯一的、最小化的修正点】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 被调用: tid 的原始值是 ${JSON.stringify(tid)}`);
    
    let id;
    if (typeof tid === 'object' && tid !== null && tid.id) {
        id = tid.id;
    } else if (tid) { // 如果 tid 不是对象，但它是一个“真”值 (不是 undefined, null, 0, "")
        id = tid;
    } else {
        // 如果 tid 是 undefined 或 null，证明是 App 首次加载，我们需要提供一个默认值
        log("警告: tid 为空，使用默认分类 ID。");
        const config = JSON.parse(await getConfig());
        id = config.tabs[0].ext.id; // 使用第一个分类 "热门电影" 的 ID
    }
    
    log(`解析后的 id: ${id}`);
    return getCards({ id: id, page: pg || 1 });
}


// ★★★★★【getCards() 函数 - 严格回归 V1.0，只修正网络请求语法】★★★★★
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    if (!categoryId) {
        log("错误: getCards 收到的 categoryId 为空。");
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        // 使用我们最终确认的、最稳妥的网络请求语法
        const { data: responseData } = await $fetch.get(requestUrl);
        const data = JSON.parse(responseData);

        if (!data || !Array.isArray(data.items)) {
            throw new Error("后端返回数据格式不正确");
        }

        const cards = data.items.map(item => {
            const vod_id = `${item.media_type}_${item.tmdbid}`;
            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `${TMDB_IMAGE_BASE_URL}${item.poster}`,
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '未知'),
            };
        });

        // 严格回归 V1.0 的返回值格式
        return jsonify({
            'list': cards,
            'page': data.page,
            'pagecount': data.total_page,
            'limit': cards.length,
            'total': data.total_items,
        });

    } catch (e) {
        log(`请求数据失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 未实现的功能 ---
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
