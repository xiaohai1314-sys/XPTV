/**
 * Nullbr 影视库前端插件 - V9.2 (最终修复分类 Tab 版)
 *
 * 修复说明:
 * 1. 根本原因：App 插件加载器在加载时，会查找一个名为 'class' 的全局变量作为分类 Tab 的数据源。
 * 2. 解决方案：将分类数组重命名为全局变量 'class'。
 * 3. 移除 home() 函数返回值中的 'class' 字段，避免冗余和潜在冲突。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data  ) { return JSON.stringify(data); }
function log(message) { console.log(`[Nullbr插件 V9.2] ${message}`); }

// ★★★★★【核心：将分类数组重命名为全局变量 'class'】★★★★★
const class = [ // <--- 关键修改点：重命名为 'class'
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- App 插件入口函数 ---

async function init(ext) { return jsonify({}); }

// ★★★★★【getConfig() 函数 - 保持简洁】★★★★★
async function getConfig() {
    // App 会自动读取全局的 'class' 变量，无需在 getConfig 中重复定义 tabs
    return jsonify({ 
        ver: 9.2, 
        title: 'Nullbr影视库', 
        site: API_BASE_URL,
    });
}

// ★★★★★【home() 函数 - 移除冗余的 'class' 字段】★★★★★
async function home() {
    log("home() 被调用，返回空列表...");
    // 移除 'class' 字段，App 会自动使用全局的 'class' 变量
    return jsonify({
        'list': [],
        'filters': {}
    });
}

// ★★★★★【category() 函数 - 使用全局 'class' 变量】★★★★★
async function category(tid, pg) {
    log(`category() 被调用: tid=${tid}, pg=${pg}`);
    
    // 使用全局 'class' 变量
    const categoryId = tid || class[0].ext.id; // <--- 使用全局 'class'
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

        // 严格遵守“观影网”的实现，只返回 list 和分页信息
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
