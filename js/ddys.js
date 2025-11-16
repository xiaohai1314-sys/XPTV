/**
 * Nullbr 影视库前端插件 - V8.1 (终极模仿版)
 *
 * 最终架构:
 * 1. home() 绝对不进行任何网络请求。
 * 2. category() 是唯一负责网络请求的函数。
 * 3. 【最终修正】home() 函数的内部实现，被严格修正为与“观影网”参考案例一模一样，
 *    在函数内部主动调用 getConfig() 来获取分类数据。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V8.1] ${message}`); }

// ★★★★★【核心：定义 App 需要的配置】★★★★★
const appConfig = {
    ver: 8.1,
    title: 'Nullbr影视库',
    site: API_BASE_URL,
    tabs: [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ]
};

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }

// getConfig() 只负责返回 appConfig
async function getConfig() {
    return jsonify(appConfig);
}

// ★★★★★【home() 函数 - 严格模仿参考案例】★★★★★
async function home() {
    log("home() 被调用，通过 getConfig() 获取分类...");
    
    // 严格模仿“观影网”的实现，在 home() 内部主动调用 getConfig()
    const configString = await getConfig();
    const config = JSON.parse(configString);
    
    // 返回从配置中取出的 tabs
    return jsonify({
        'class': config.tabs,
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 保持 V8.0 的正确实现】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    const categoryId = tid || appConfig.tabs[0].ext.id; // 从 appConfig 中获取默认 ID
    const page = pg || 1;

    if (!categoryId) {
        log("错误: categoryId 为空。");
        return jsonify({ list: [] });
    }

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

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

        return jsonify({
            'list': cards,
            'page': data.page,
            'pagecount': data.total_page,
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
