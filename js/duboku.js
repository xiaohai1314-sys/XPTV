/**
 * Nullbr 影视库前端插件 - V64.0 (严格移植版)
 *
 * 变更日志:
 * - V64.0 (2025-11-18):
 *   - [回归基准] 放弃所有先前的修改和分析，严格遵循用户指示。
 *   - [原封不动] 将用户提供的、可正常工作的V59版本中的 `getCards` 函数及所有相关核心代码原封不动地移植过来。
 *   - [功能嫁接] 在V59的稳定基础上，直接添加了V61版本中的 `search`, `detail`, `play` 函数的实现。
 *   - 此版本旨在确保列表和分页功能与已知的工作版本完全一致，杜绝任何因代码变动引入的新问题。
 *
 * 作者: Manus (在用户的最终指引下完成)
 * 日期: 2025-11-18
 */

// =======================================================================
// --- V59 核心代码区 (原封不动) ---
// =======================================================================

const API_BASE_URL = 'http://192.168.10.105:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V64.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 'hot_movie' } },
    { name: '热门剧集', ext: { id: 'hot_series' } },
    { name: '高分电影', ext: { id: 'top_movie' } },
    { name: '高分剧集', ext: { id: 'top_series' } },
];

let CATEGORY_END_LOCK = {};

async function init(ext) {
    CATEGORY_END_LOCK = {};
    return jsonify({});
}
async function getConfig() { return jsonify({ ver: 64.0, title: 'Nullbr影视库 (V64)', site: API_BASE_URL, tabs: CATEGORIES }); }
async function home() { return jsonify({ class: CATEGORIES, filters: {} }); }

async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不应被调用！");
    return jsonify({ list: [] });
}

// ★★★★★【V59 的 getCards 函数 - 原封不动地复制于此】★★★★★
async function getCards(ext) {
    log(`getCards() 作为唯一入口被调用，ext: ${JSON.stringify(ext)}`);
    
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
        log(`分类 "${placeholderId}" 已被锁定，直接返回空列表，阻止无效请求。`);
        return jsonify({
            list: [],
            page: page,
            pagecount: page,
        });
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
        
        const cards = data.items.map(item => ({
            vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));

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

// =======================================================================
// --- V61 新增功能区 (原封不动) ---
// =======================================================================

// ★★★★★【新增：搜索函数】★★★★★
async function search(wd, quick) {
    log(`search() 被调用，关键词: "${wd}"`);
    if (!wd) {
        return jsonify({ list: [] });
    }

    const encodedWd = encodeURIComponent(wd);
    const url = `<LaTex>${API_BASE_URL}/api/search?keyword=$</LaTex>{encodedWd}`;
    log(`搜索请求URL: ${url}`);

    try {
        const response = await $fetch.get(url);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        if (!data || !Array.isArray(data.items)) {
            log("搜索API返回数据格式不正确或无结果。");
            return jsonify({ list: [] });
        }

        const cards = data.items.map(item => {
            const card = {
                vod_id: `<LaTex>${item.media_type}_$</LaTex>{item.tmdbid}`,
                vod_name: item.title || '未命名',
                vod_pic: item.poster ? `<LaTex>${TMDB_IMAGE_BASE_URL}$</LaTex>{item.poster}` : "",
                vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
            };
            if (item['115-flg']) {
                card['115-flg'] = item['115-flg'];
            }
            return card;
        });
        log(`搜索到 ${cards.length} 个结果。`);

        return jsonify({ list: cards });
    } catch (err) {
        log(`搜索请求失败: ${err.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【新增：极简详情函数】★★★★★
async function detail(id, ext) {
    log(`detail() 被调用, ID: ${id}`);
    
    const extObj = typeof ext === 'string' ? JSON.parse(ext) : ext;

    const vod = {
        vod_id: id,
        vod_play_from: '',
        vod_play_url: ''
    };

    if (extObj && extObj['115-flg'] === 1) {
        log(`ID: ${id} 检测到 115-flg 标志，声明播放源。`);
        vod.vod_play_from = "115网盘";
        vod.vod_play_url = `在线播放$${id}`;
    } else {
        log(`ID: ${id} 未检测到 115-flg 标志，不提供播放源。`);
    }

    return jsonify({ list: [vod] });
}

// ★★★★★【新增：播放函数】★★★★★
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

        if (media_type === 'tv') {
            log("检测为剧集，返回第一个分享链接。");
            return jsonify({ url: resources[0].share_link });
        }

        if (media_type === 'movie') {
            let bestLink = resources[0].share_link;
            let bestQuality = 0;

            for (const res of resources) {
                const title = (res.title || '').toLowerCase();
                if (title.includes('2160p') || title.includes('4k')) {
                    bestLink = res.share_link;
                    bestQuality = 2160;
                    break;
                }
                if (title.includes('1080p') && bestQuality < 1080) {
                    bestLink = res.share_link;
                    bestQuality = 1080;
                }
            }
            log(`检测为电影，选择的最佳清晰度为: ${bestQuality || '默认'}p`);
            return jsonify({ url: bestLink });
        }

        return jsonify({ url: resources[0].share_link });

    } catch (err) {
        log(`play() 过程出错: ${err.message}`);
        return jsonify({ url: "" });
    }
}
