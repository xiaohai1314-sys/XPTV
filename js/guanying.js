/**
 * 观影网脚本 - v20.0 (Puppeteer搜索逻辑融合版)
 *
 * --- 核心变更 ---
 * 1.  【搜索逻辑更新】: 完全采纳了用户提供的基于 Puppeteer 的搜索页面解析逻辑，并将其用 cheerio 实现，以确保搜索结果的准确性。
 * 2.  【搜索结果ID修正】: 根据新的解析逻辑，`vod_id` 现在直接使用从链接中提取的路径 (例如: 'mv/y9jJ')，使其更符合网站结构。
 * 3.  【代码健壮性】: 搜索函数中增加了更详细的错误捕获和日志，便于调试。
 * 4.  保留了 v19.0 版本中稳定的 Cookie 和海报URL修正。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// 【Cookie修正】直接使用您提供的有效Cookie
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 20.0, // 版本号更新
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V20.0] ${msg}`); } catch (_) { console.log(`[观影网 V20.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【业务逻辑函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    // ... (此函数与v19版本相同，保持不变)
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
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        } );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索 (已融合 Puppeteer 逻辑)
 */
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    // 注意：观影网的搜索URL结构是 /s/1---{页码}/{关键词}
    const url = `${appConfig.site}s/1---${page}/${encodeURIComponent(text)}`;
    log(`执行搜索 (新逻辑): ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];

        // 使用与 Puppeteer evaluate 中相同的选择器
        $('div.sr_lists div.v5d').each((_, element) => {
            const $item = $(element);
            const linkElement = $item.find('div.text b a');
            const imgElement = $item.find('div.img img');
            const scoreElement = $item.find('p:nth-of-type(1)');

            const href = linkElement.attr('href');
            // 确保链接有效且是站内相对路径
            if (href && href.startsWith('/')) {
                cards.push({
                    // vod_id 直接使用路径，去掉开头的'/'，例如 'mv/y9jJ'
                    vod_id: href.substring(1), 
                    vod_name: linkElement.text().trim(),
                    // 直接获取图片URL，优先 data-src
                    vod_pic: imgElement.attr('data-src') || imgElement.attr('src') || '',
                    // 提取评分作为备注
                    vod_remarks: scoreElement.text().replace('评分:', '').trim(),
                    // ext 中也保留原始路径，用于后续可能的拼接
                    ext: { path: href.substring(1) },
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
 * 获取播放轨道列表 (需要适配新的 vod_id 格式)
 */
async function getTracks(ext) {
    ext = argsify(ext);
    // 检查 ext.url 是否存在 (来自 getCards 的点击)
    // 如果不存在，则说明来自 search 的点击，需要使用 ext.path 拼接 URL
    let url = ext.url; 
    if (!url && ext.path) {
        // ext.path 的格式是 'mv/y9jJ'，需要分割
        const [type, id] = ext.path.split('/');
        url = `${appConfig.site}res/downurl/${type}/${id}`;
    } else if (!url) {
        log('❌ 获取详情失败: URL和路径都无效');
        return jsonify({ list: [] });
    }

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


async function getPlayinfo(ext) {
    // ... (此函数与v19版本相同，保持不变)
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
