/**
 * Nullbr 影视库前端插件 - V9.2 (终极兼容版)
 * 
 * 版本说明:
 * - 目标: 解决在特定 App 环境下分类标签不显示的顽固问题。
 * - 策略 1 (三路并进): 同时在 init(), getConfig() 和 home() 中提供分类数据，
 *   以应对 App 可能存在的不同加载逻辑。无论 App 调用哪个函数，都能获取到分类。
 * - 策略 2 (格式洁癖修复): 将分类 ID 从数字类型改为字符串类型，防止部分 App 解析失败。
 * - 策略 3 (日志增强): 在所有入口函数添加明确日志，便于问题追踪。
 *
 * 作者: Manus / AI
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V9.2] ${message}`); }

// ★★★★★【核心：分类数据 - ID 已字符串化】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: "2142788" } },
    { name: '热门剧集', ext: { id: "2143362" } },
    { name: '高分电影', ext: { id: "2142753" } },
    { name: '高分剧集', ext: { id: "2143363" } },
];

// --- App 插件入口函数 ---

// ★★★★★【V9.2 增强 - 策略 1: 强化 init()】★★★★★
async function init(ext) {
    log("init() 被调用，尝试提前返回完整配置...");
    // 无论如何，先在初始化时就把所有配置和分类给 App
    return jsonify({ 
        ver: 9.2, 
        title: 'Nullbr影视库', 
        site: API_BASE_URL,
        tabs: CATEGORIES
    });
}

// ★★★★★【V9.2 增强 - 策略 1: 标准 getConfig()】★★★★★
async function getConfig() { 
    log("getConfig() 被调用，返回标准配置和分类...");
    return jsonify({ 
        ver: 9.2, 
        title: 'Nullbr影视库', 
        site: API_BASE_URL,
        tabs: CATEGORIES // <-- 兼容新版 App
    }); 
}

// ★★★★★【V9.2 增强 - 策略 1: 兼容 home()】★★★★★
async function home() {
    log("home() 被调用，返回旧版分类格式...");
    // 严格遵守旧版 App 的实现，同时返回 'class' 和 'list: []'
    return jsonify({
        'class': CATEGORIES, // <-- 兼容旧版 App
        'list': [],
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 保持稳定】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid=<LaTex>${tid}, pg=$</LaTex>{pg}`);
    
    // 确保 tid 是一个对象，如果是简单值则使用默认
    const categoryId = typeof tid === 'object' ? tid.id : tid || CATEGORIES[0].ext.id;
    const page = pg || 1;

    if (!categoryId) {
        log("错误: categoryId 为空。");
        return jsonify({ list: [] });
    }

    const requestUrl = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{categoryId}&page=${page}`;
    log(`正在请求后端: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("后端返回数据格式不正确");
        }

        const cards = data.items.map(item => {
            const vod_id = `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`;
            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}`,
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

// --- 未实现的功能 (保持不变) ---
async function detail(id) { log(`[待实现] 详情页: ${id}`); return jsonify({ list: [] }); }
async function play(flag, id, flags) { log(`[待实现] 播放: ${id}`); return jsonify({ url: '' }); }
async function search(wd, quick) { log(`[待实现] 搜索: ${wd}`); return jsonify({ list: [] }); }

log("Nullbr 插件 V9.2 (终极兼容版) 加载完成。
