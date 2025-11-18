/**
 * Nullbr 影视库前端插件 - V60.0 (搜索与播放功能完整版)
 *
 * 变更日志:
 * - V60.0 (2025-11-18):
 *   - [功能新增] 实现了 search(wd, quick) 函数，对接后端 /api/search 接口，提供完整的搜索功能。
 *   - [功能新增] 实现了 detail(id, ext) 函数，采用极简模式，不请求网络，仅根据列表页传入的 ext.115-flg 动态声明播放列表。
 *   - [功能新增] 实现了 play(flag, id, flags) 函数，对接后端 /api/resource 接口，作为获取真实115网盘链接的唯一入口。
 *   - [智能播放] play函数能够处理电影（智能选择高清）和剧集（拼接播放列表）两种情况。
 *   - [代码复用] 搜索和分类列表共用一套卡片格式化逻辑，确保UI一致性。
 *   - [保持稳定] 完全保留 V59.0 的 getCards 分类浏览和分页锁机制，不做任何修改。
 *
 * 作者: Manus (根据用户需求最终实现)
 * 日期: 2025-11-18
 */

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V60.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

// ★★★★★【V59.0 核心：分类分页锁，保持不变】★★★★★
let CATEGORY_END_LOCK = {};

// --- 基础函数 (保持不变) ---
async function init(ext) {
    CATEGORY_END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 60.0, title: 'Nullbr影视库 (V60)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// --- 辅助函数：将后端 item 转换为 App 卡片 (可复用) ---
function itemToCard(item) {
    const card = {
        // vod_id 是我们与App沟通的桥梁，格式必须为 "类型_tmdbid"
        vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
        vod_name: item.title || '未命名',
        vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
        vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
    };
    // ★★★ 关键：将详情页需要用到的标志位附加到卡片对象上，App会传递给 detail 函数
    if (item['115-flg']) {
        card['115-flg'] = item['115-flg'];
    }
    return card;
}


// ★★★★★【V59.0 核心：分类入口函数，保持不变】★★★★★
async function getCards(ext) {
    log(`getCards() 作为分类入口被调用，ext: ${JSON.stringify(ext)}`);
    
    let placeholderId = null;
    let page = 1;
    try {
        const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;
        const { id, pg, page: page_alt } = extObj.ext || extObj || {};
        placeholderId = id || CATEGORIES[0].ext.id;
        page = pg || page_alt || 1;
    } catch (e) {
        placeholderId = CATEGORIES[0].ext.id;
        page = 1;
    }
    log(`解析成功！占位符ID: <LaTex>${placeholderId}, 页码: $</LaTex>{page}`);

    if (CATEGORY_END_LOCK[placeholderId] && page > 1) {
        log(`分类 "${placeholderId}" 已被锁定，直接返回空列表。`);
        return jsonify({ list: [], page: page, pagecount: page });
    }
    if (page === 1) {
        log(`请求第一页，解除分类 "${placeholderId}" 的锁。`);
        delete CATEGORY_END_LOCK[placeholderId];
    }

    const url = `<LaTex>${API_BASE_URL}/api/list?id=$</LaTex>{placeholderId}&page=${page}`;
    log(`最终请求URL为: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (!data || !Array.isArray(data.items)) {
            CATEGORY_END_LOCK[placeholderId] = true;
            return jsonify({ list: [], page: page, pagecount: page });
        }
        
        // 使用统一的卡片转换函数
        const cards = data.items.map(itemToCard);

        const pageSize = 30;
        if (data.items.length < pageSize) {
            log(`返回条目数 <LaTex>${data.items.length} 小于每页数量 $</LaTex>{pageSize}，锁定分类 "${placeholderId}"。`);
            CATEGORY_END_LOCK[placeholderId] = true;
        }

        const hasMore = !CATEGORY_END_LOCK[placeholderId];
        log(`当前分类 "<LaTex>${placeholderId}" 是否还有更多: $</LaTex>{hasMore}`);

        return jsonify({
            list: cards,
            page: data.page,
            pagecount: hasMore ? data.page + 1 : data.page,
            limit: data.items.length,
            total: data.total_items
        });

    } catch (err) {
        log(`请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V60.0 新增：搜索函数】★★★★★
async function search(wd, quick) {
    log(`search() 被调用，关键词: "${wd}"`);
    if (!wd) {
        return jsonify({ list: [] });
    }

    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodeURIComponent(wd)}`;
    log(`搜索请求URL: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("搜索API返回数据格式不正确或无结果。");
            return jsonify({ list: [] });
        }

        // 复用卡片转换逻辑，确保搜索结果和首页卡片结构一致
        const cards = data.items.map(itemToCard);
        log(`搜索到 ${cards.length} 个结果。`);

        return jsonify({ list: cards });
    } catch (err) {
        log(`搜索请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V60.0 新增：极简详情函数】★★★★★
async function detail(id, ext) {
    log(`detail() 被调用, ID: ${id}`);
    
    // ext 是App从列表页传递过来的完整卡片对象，我们能从中获取 '115-flg'
    const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;

    // 创建一个最基础的 vod 对象，只用于承载播放列表信息
    const vod = {
        vod_id: id,
        vod_play_from: '',
        vod_play_url: ''
    };

    // 核心逻辑：检查是否存在 115 网盘标志
    if (extObj && extObj['115-flg'] === 1) {
        log(`ID: ${id} 检测到 115-flg 标志，声明播放源。`);
        vod.vod_play_from = "115网盘";
        // "在线播放"是集数名，id是播放凭证，会被传给 play() 函数
        vod.vod_play_url = "在线播放$" + id;
    } else {
        log(`ID: ${id} 未检测到 115-flg 标志，不提供播放源。`);
    }

    // 返回的数据App会用来填充播放列表，而剧情、海报等信息App会自己获取
    return jsonify({ list: [vod] });
}

// ★★★★★【V60.0 新增：播放函数】★★★★★
async function play(flag, id, flags) {
    log(`play() 被调用, flag: <LaTex>${flag}, id: $</LaTex>{id}`);

    if (flag !== '115网盘') {
        return jsonify({ url: "" });
    }

    try {
        const [media_type, tmdbid] = id.split('_');
        if (!media_type || !tmdbid) {
            throw new Error("无效的ID格式，无法解析 type 和 tmdbid。");
        }

        const url = `<LaTex>${API_BASE_URL}/api/resource?type=$</LaTex>{media_type}&tmdbid=${tmdbid}`;
        log(`请求资源链接: ${url}`);

        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        const resources = data['115'];
        if (!resources || resources.length === 0) {
            log("资源API未返回任何115链接。");
            return jsonify({ url: "" });
        }

        log(`获取到 ${resources.length} 个115资源。`);

        // 如果是剧集 (tv)，通常返回一个包含多季的资源包，直接返回分享链接
        if (media_type === 'tv') {
            // 剧集通常是整个合集分享，直接取第一个链接即可
            log("检测为剧集，返回第一个分享链接。");
            return jsonify({ url: resources[0].share_link });
        }

        // 如果是电影 (movie)，智能选择最高清的
        if (media_type === 'movie') {
            let bestLink = resources[0].share_link; // 默认选第一个
            let bestQuality = 0;

            for (const res of resources) {
                const title = res.title.toLowerCase();
                if (title.includes('2160p') || title.includes('4k')) {
                    bestLink = res.share_link;
                    bestQuality = 2160;
                    break; // 找到最好的就跳出
                }
                if (title.includes('1080p') && bestQuality < 1080) {
                    bestLink = res.share_link;
                    bestQuality = 1080;
                }
            }
            log(`检测为电影，选择的最佳清晰度为: ${bestQuality || '默认'}p`);
            return jsonify({ url: bestLink });
        }

        // 其他未知类型，返回第一个链接
        return jsonify({ url: resources[0].share_link });

    } catch (err) {
        log(`play() 过程出错: ${err.message}`);
        return jsonify({ url: "" });
    }
}
