/**
 * 观影网脚本 - v19.1 (搜索修正版)
 *
 * --- 核心修正 ---
 * 1.  【Cookie修正】: 严格按照用户要求，硬编码了指定的有效Cookie，移除了所有动态登录逻辑，确保身份验证的稳定性。
 * 2.  【海报URL修正】: 严格按照用户指出的新规则，在 `getCards` 和 `search` 函数中，为所有海报URL路径增加了 `/220` 后缀，以获取正确的图片。
 * 3.  【搜索功能修正】: 重写 `search` 函数，使其能够解析新版搜索页面返回的 JavaScript 数据对象 (`_obj.search`)，而不是依赖于旧的 HTML 元素解析，从根本上解决了搜索功能失效的问题。
 * 4.  保留了之前版本中对数据解析的稳定逻辑。
 * 5.  这是一个为当前网站规则和用户需求深度定制的稳定版本。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// 【Cookie修正】直接使用您提供的有效Cookie
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 19.1, // 版本号更新为搜索修正版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 (简化登录逻辑  ) ==================

function log(msg) { try { $log(`[观影网 V19.1] ${msg}`); } catch (_) { console.log(`[观影网 V19.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

/**
 * 使用固定的Cookie发起网络请求
 */
async function fetchWithCookie(url, options = {}) {
    const headers = { 
        'User-Agent': UA, 
        'Cookie': HARDCODED_COOKIE, 
        'Referer': appConfig.site, 
        ...options.headers 
    };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【业务逻辑函数 - 已修正】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 获取分类页面的卡片列表
 */
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data: htmlText } = await fetchWithCookie(url);
        const inlistMatch = htmlText.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            throw new Error("未能从HTML响应中匹配到 '_obj.inlist' 数据块。");
        }
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) {
            return jsonify({ list: [] });
        }
        const cards = inlistData.i.map((item, index) => {
            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                // 【海报URL修正】正确拼接海报地址，增加 /220 后缀
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        }  );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放轨道列表
 */
async function getTracks(ext) {
    ext = argsify(ext);
    let url = ext.url; 
    log(`请求详情数据: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const respstr = JSON.parse(data);
        let tracks = [];
        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) name = `${name}${matches[0]}`;
                }
                tracks.push({ name: name || respstr.panlist.name[index], pan: item, ext: { url: '' } });
            });
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索 (已修正)
 */
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    try {
        const { data: htmlText } = await fetchWithCookie(url);

        // 使用正则表达式从返回的HTML中匹配并提取 _obj.search 数据块
        const match = htmlText.match(/_obj\.search\s*=\s*({.*?});/);
        if (!match || !match[1]) {
            throw new Error("未能从HTML响应中匹配到 '_obj.search' 数据。");
        }

        // 将匹配到的字符串解析为JSON对象
        const searchData = JSON.parse(match[1]);
        if (!searchData || !searchData.i || searchData.i.length === 0) {
            log("搜索结果为空或数据格式不正确。");
            return jsonify({ list: [] });
        }

        // 遍历解析后的数据，重组成卡片列表
        const cards = searchData.i.map((id, index) => {
            const type = searchData.d[index]; // 获取类型 (mv, tv, etc.)
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${id}`;
            
            return {
                vod_id: detailApiUrl,
                vod_name: searchData.title[index], // 从 title 数组获取标题
                // 【海报URL修正】根据新规则拼接海报地址
                vod_pic: `https://s.tutu.pm/img/${type}/${id}/220.webp`,
                vod_remarks: searchData.info[index] || '', // 从 info 数组获取简介
                ext: { url: detailApiUrl },
            };
        } );

        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`搜索失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}


/**
 * 获取播放链接
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
