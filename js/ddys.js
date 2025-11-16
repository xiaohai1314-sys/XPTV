/**
 * Nullbr 影视库前端插件 - V1.1
 *
 * 功能:
 * 1. 实现分类 Tab 展示 (热门/高分电影、热门/高分剧集)。
 * 2. 实现从后端加载并展示对应分类的影视列表。
 *
 * 作者: Manus
 * 日期: 2025-11-16
 */

// --- 核心配置区 ---
const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// --- 辅助函数 ---
function jsonify(data) {
    return JSON.stringify(data);
}

function log(message) {
    console.log(`[Nullbr插件] ${message}`);
}

// --- App 插件入口函数 ---
async function getConfig() {
    log("初始化插件配置 (V1.0)...");

    const categories = [
        { name: '热门电影', ext: { id: 2142788 } },
        { name: '热门剧集', ext: { id: 2143362 } },
        { name: '高分电影', ext: { id: 2142753 } },
        { name: '高分剧集', ext: { id: 2143363 } },
    ];

    return jsonify({
        ver: 1.0,
        title: 'Nullbr影视库',
        site: API_BASE_URL,
        tabs: categories,
    });
}

async function getCards(ext) {
    const categoryId = ext.id;
    const page = ext.page || 1;

    const requestUrl = `${API_BASE_URL}/api/list?id=${categoryId}&page=${page}`;
    log(`正在请求分类数据: ${requestUrl}`);

    try {
        const response = await $fetch.get(requestUrl);
        const data = (typeof response.data === 'string') ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            throw new Error("返回的数据格式不正确，缺少 items 数组。");
        }

        const cards = data.items.map(item => {
            const vod_id = `${item.media_type}_${item.tmdbid}`;

            return {
                vod_id: vod_id,
                vod_name: item.title,
                vod_pic: `${TMDB_IMAGE_BASE_URL}${item.poster}`,
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
        log(`请求分类 ${categoryId} 失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口和未实现的功能 ---
async function init(ext) {
    return getConfig();
}

async function home() {
    const config = JSON.parse(await getConfig());
    return jsonify({
        class: config.tabs,
        filters: {}
    });
}

async function category(tid, pg, filter, ext) {
    const id = (typeof tid === 'object') ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

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
