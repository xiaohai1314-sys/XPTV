/**
 * Nullbr 影视库前端插件 - V3.0 (回归初心版)
 *
 * 核心思路:
 * - 严格基于被验证能显示 Tab 的 V1.0 版本进行修正。
 * - home() 函数的结构保持不变，但实现更稳定，并负责加载首页默认列表。
 * - category() 函数修正了对 tid 的处理。
 * - 这是对 V1.0 的直接升级，确保了最大的兼容性。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V3.0] ${message}`); }

// --- 分类定义 (从 V1.0 逻辑中提取) ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

// getConfig (保持 V1.0 逻辑)
async function getConfig() {
    log("初始化插件配置 (V3.0)...");
    return jsonify({
        ver: 3.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: CATEGORIES,
    });
}

// getCards (保持 V1.0 逻辑，但确保 categoryId 有效)
async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    if (!categoryId) {
        log("错误：getCards 收到的分类 ID 为空！");
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求分类数据: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("返回的数据格式不正确");
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

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: data.total_page,
        });

    } catch (e) {
        log(`请求分类 ${categoryId} 失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 (在 V1.0 基础上修正) ---

// init (保持 V1.0 逻辑)
async function init(ext) {
    return getConfig();
}

// ★★★★★【核心修正 1: home() 负责一切】★★★★★
async function home() {
    log("home() 被调用，获取分类和默认列表...");
    
    // 1. 准备分类数据 (直接使用常量，比 V1.0 更稳定)
    const classData = CATEGORIES.map(c => ({
        "cate_id": c.ext.id.toString(),
        "cate_name": c.name
    }));

    // 2. 获取默认列表数据 (调用 getCards)
    const defaultCategory = CATEGORIES[0].ext; // 使用第一个分类作为默认
    const listResponse = await getCards(defaultCategory);
    const listData = JSON.parse(listResponse);

    // 3. 组合 class 和 list 返回
    return jsonify({
        'class': classData,
        'list': listData.list,
        'page': listData.page,
        'pagecount': listData.pagecount,
        'filters': {}
    });
}

// ★★★★★【核心修正 2: category() 只负责列表】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    // 直接调用 getCards，不再需要复杂的判断
    return getCards({ id: tid, page: pg || 1 });
}

// --- 未实现的功能 (保持 V1.0 逻辑) ---
async function detail(id) { log(`[待实现] 请求详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 请求播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
