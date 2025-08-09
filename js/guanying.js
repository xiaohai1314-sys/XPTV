/**
 * 观影网脚本 - v20.2 (最终修正版)
 *
 * --- 核心修正 ---
 * 1.  【海报逻辑恢复】: 严格遵照用户指示，撤销对搜索结果中海报URL的任何修改。`search` 函数现在会直接使用从页面上获取的原始 `data-src` 或 `src` 属性，与用户提供的 puppeteer 逻辑完全一致。
 * 2.  【保留关键修正】: 保留了对 `getTracks` 函数的兼容性修正，确保无论是从分类页还是搜索页，都能正确加载影片详情和播放列表。
 * 3.  【代码稳定】: 这是一个结合了用户精确反馈和之前版本稳定性的最终版本。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 20.2, // 版本号更新
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================
function log(msg ) { try { $log(`[观影网 V20.2] ${msg}`); } catch (_) { console.log(`[观影网 V20.2] ${msg}`); } }
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

async function getCards(ext) {
    // 分类页逻辑保持不变，这里的海报URL是正确的
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data: htmlText } = await fetchWithCookie(url);
        const inlistMatch = htmlText.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能匹配到 '_obj.inlist' 数据。");
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) return jsonify({ list: [] });
        const cards = inlistData.i.map((item, index) => ({
            vod_id: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
            vod_name: inlistData.t[index],
            vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
            vod_remarks: inlistData.g[index] || '',
            ext: { url: `${appConfig.site}res/downurl/${inlistData.ty}/${item}` },
        } ));
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索 (海报逻辑已恢复为原始版本)
 */
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    const url = `${appConfig.site}s/1---${page}/${encodeURIComponent(text)}`;
    log(`执行搜索 (原始海报逻辑): ${url}`);

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
                    // 【海报逻辑恢复】直接使用页面上的原始URL，不做任何修改
                    vod_pic: imgElement.attr('data-src') || imgElement.attr('src') || '',
                    vod_remarks: scoreElement.text().replace('评分:', '').trim(),
                    ext: { path: path },
                });
            }
        });

        if (cards.length === 0) {
            log(`搜索 "${text}" 未在页面中解析到任何结果。`);
        } else {
            log(`搜索 "${text}" 找到 ${cards.length} 条结果`);
        }
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放轨道列表 (已修正，兼容两种来源)
 */
async function getTracks(ext) {
    ext = argsify(ext);
    let detailApiUrl = '';

    if (ext.url) {
        detailApiUrl = ext.url;
    } else if (ext.path || ext.vod_id) {
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
