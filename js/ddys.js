/**
 * Nullbr 影视库前端插件 - V9.1 (分类修复版)
 * * 修正说明:
 * - 核心修正: 修复了 getConfig() 函数中缺少 'tabs' 字段的问题。
 * - 确保 getConfig() 同时返回 'tabs' 字段，以兼容 App 优先调用新接口获取分类的情况。
 * - home() 函数保持 V9.0 的结构，作为旧版接口的兼容。
 *
 * 作者: Manus / AI
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V9.1] ${message}`); }

// ★★★★★【核心：App 唯一认识的分类格式】★★★★★
const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }

// ★★★★★【V9.1 核心修复】★★★★★
async function getConfig() { 
    log("getConfig() 被调用，返回配置和分类数据...");
    return jsonify({ 
        ver: 9.1, 
        title: 'Nullbr影视库', 
        site: API_BASE_URL,
        tabs: CATEGORIES // <-- 确保分类数据在这里被返回
    }); 
}

// ★★★★★【home() 函数 - 兼容旧版】★★★★★
async function home() {
    log("home() 被调用，返回分类和空列表...");
    // 严格遵守旧版App的实现，同时返回 'class' 和 'list: []'
    return jsonify({
        'class': CATEGORIES,
        'list': [],
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 保持 V9.0 的正确实现】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    // 确保 tid 是一个对象，如果是简单值则使用默认
    const categoryId = typeof tid === 'object' ? tid.id : tid || CATEGORIES[0].ext.id;
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

        // 严格遵守 App 接口，只返回 list 和分页信息
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
