/**
 * 观影网脚本 - v21.0 (全面恢复与稳定版)
 *
 * --- 核心修正 ---
 * 1.  【致命错误修复】: 彻底修复了导致分类列表 (电影、剧集、动漫) 无法加载的严重问题。getCards 函数已完全恢复到 v19.0 的稳定状态。
 * 2.  【搜索逻辑确认】: 沿用 v20.2 中最终确定的 search 函数逻辑，该逻辑最符合用户提供的 puppeteer 原始意图，特别是海报URL部分，不做任何画蛇添足的修改。
 * 3.  【完全兼容】: getTracks 函数保持了其强大的兼容性，确保无论是从分类页点击，还是从搜索结果点击，都能正确加载播放列表。
 * 4.  此版本旨在成为一个功能完整、稳定可靠的最终版本。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 21.0, // 版本号更新
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================
function log(msg ) { try { $log(`[观影网 V21.0] ${msg}`); } catch (_) { console.log(`[观影网 V21.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function fetchWithCookie(url, options = {}) {
    const headers = { 'User-Agent': UA, 'Cookie': HARDCODED_COOKIE, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【业务逻辑函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 获取分类页面的卡片列表 (已恢复到 v19.0 的正确逻辑)
 */
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data: htmlText } = await fetchWithCookie(url);
        const inlistMatch = htmlText.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能从HTML响应中匹配到 '_obj.inlist' 数据块。");
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) return jsonify({ list: [] });
        
        const cards = inlistData.i.map((item, index) => {
            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl, // 正确的 vod_id 格式
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl }, // 正确的 ext 格式
            };
        } );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索 (使用 v20.2 最终确认的稳定逻辑)
 */
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    const url = `${appConfig.site}s/1---${page}/${encodeURIComponent(text)}`;
    log(`执行搜索 (稳定版): ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];
        $('div.sr_lists div.v5d').each((_, element) => {
            const $item = $(element);
            const linkElement = $item.find('div.text b a');
            const href = linkElement.attr('href');
            if (href && href.startsWith('/')) {
                const path = href.substring(1);
                const imgElement = $item.find('div.img img');
                const scoreElement = $item.find('p:nth-of-type(1)');
                cards.push({
                    vod_id: path,
                    vod_name: linkElement.text().trim(),
                    vod_pic: imgElement.attr('data-src') || imgElement.attr('src') || '',
                    vod_remarks: scoreElement.text().replace('评分:', '').trim(),
                    ext: { path: path },
                });
            }
        });
        log(`搜索 "${text}" 找到 ${cards.length} 条结果`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放轨道列表 (保持兼容性)
 */
async function getTracks(ext) {
    ext = argsify(ext);
    let detailApiUrl = '';

    // 来源: 分类页 (getCards)。ext.url 是完整 API URL，vod_id 也是。
    if (ext.url) {
        detailApiUrl = ext.url;
    } 
    // 兼容旧版或意外情况，如果 url 不在 ext 里，但在 vod_id 里
    else if (ext.vod_id && ext.vod_id.startsWith('http' )) {
        detailApiUrl = ext.vod_id;
    }
    // 来源: 搜索页 (search)。ext.path 或 vod_id 是路径 'type/id'
    else if (ext.path || ext.vod_id) {
        const path = ext.path || ext.vod_id;
        const [type, id] = path.split('/');
        if (type && id) {
            detailApiUrl = `${appConfig.site}res/downurl/${type}/${id}`;
        }
    }

    if (!detailApiUrl) {
        log('❌ 获取详情失败: 无法确定有效的API URL。');
        return jsonify({ list: [] });
    }

    log(`请求详情数据: ${detailApiUrl}`);
    try {
        const { data } = await fetchWithCookie(detailApiUrl);
        const respstr = JSON.parse(data);
        let tracks = [];
        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                const originalName = respstr.panlist.name[index] || '';
                for (const keyword in regex) {
                    const matches = originalName.match(regex[keyword]);
                    if (matches) name = `${name}${matches[0]}`;
                }
                tracks.push({ name: name || originalName, pan: item, ext: {} });
            });
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    return jsonify({ urls: [ext.pan] });
}
