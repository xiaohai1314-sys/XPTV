/**
 * Nullbr 影视库前端插件 - V3.2 (终极答案版)
 *
 * 核心:
 * - 严格遵循 V3.0 的正确架构：home() 必须同时返回 class 和 list。
 * - 修正了 home() 函数中 class 数组的构造错误，使其结构与 App 要求完全一致。
 * - 这是基于你所有反馈的最终修正，解决了“有Tab但列表为空”和“有列表但Tab为空”的所有矛盾。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003'; // 【重要】请再次确认此 IP
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V3.2] ${message}`); }

// --- 分类定义 (V1.0 的原始格式) ---
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function getConfig() {
    log("初始化插件配置 (V3.2)...");
    return jsonify({ ver: 3.2, title: 'Nullbr影视库', site: API_BASE_URL, tabs: CATEGORIES });
}

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

        return jsonify({ list: cards, page: data.page, pagecount: data.total_page });
    } catch (e) {
        log(`请求分类 ${categoryId} 失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function init(ext) { return getConfig(); }

// ★★★★★【最终修正的 home() 函数】★★★★★
async function home() {
    log("home() 被调用，获取分类和默认列表...");
    
    // 1. 准备分类数据 (使用 App 需要的正确结构)
    // 直接使用 CATEGORIES 常量，它的结构就是 App 需要的 `[{ name: ..., ext: { id: ... } }]`
    const classData = CATEGORIES;

    // 2. 获取默认列表数据
    const defaultCategory = CATEGORIES[0].ext; // { id: 2142788 }
    const listResponse = await getCards(defaultCategory);
    const listData = JSON.parse(listResponse);

    // 3. 组合正确的 class 和 list 返回
    return jsonify({
        'class': classData,
        'list': listData.list,
        'page': listData.page,
        'pagecount': listData.pagecount,
        'filters': {}
    });
}

// ★★★★★【最终修正的 category() 函数】★★★★★
async function category(tid, pg, filter, ext) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    // 在 V1.0 中，tid 是从 ext 对象里来的，所以这里我们保持最兼容的写法
    const categoryId = (typeof ext === 'object' && ext.id) ? ext.id : tid;
    return getCards({ id: categoryId, page: pg || 1 });
}

// --- 未实现的功能 ---
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }
