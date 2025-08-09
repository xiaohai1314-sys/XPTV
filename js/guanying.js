/**
 * 观影网脚本 - v24.0 (失败回退最终版)
 *
 * --- 核心修正 ---
 * 1.  【深刻反省，回归正途】: 经用户反复点拨，终于理解“方佬”代码的精髓在于“尝试-失败-回退”机制。本版本将此机制作为核心逻辑。
 * 2.  【列表页回退机制】: `getCards` 尝试用Cookie请求数据。如果失败（无法找到数据块），则提示用户并调用 `openSafari` 打开网站首页，让用户手动验证以刷新Cookie。
 * 3.  【搜索页回退机制】: `search` 尝试用“游客模式”（不带Cookie）请求数据。如果失败（找不到结果元素），则提示用户并调用 `openSafari` 直接打开该搜索URL，确保用户总能看到结果。
 * 4.  【保留有效逻辑】: 保留了 v19.0 的Cookie配置、v20.0 的正确HTML解析逻辑，并将其整合进新的回退框架中。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 24.0, // 版本号更新为失败回退最终版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V24.0] ${msg}`); } catch (_) { console.log(`[观影网 V24.0] ${msg}`); } }
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
 * 获取分类页面的卡片列表 (增加失败回退机制)
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
            log("列表页请求失败，未找到数据块，启动回退机制。");
            $utils.toastError("加载失败, 请在浏览器中验证后重试", 4000);
            $utils.openSafari(appConfig.site, UA); // 打开首页让用户验证
            return jsonify({ list: [] });
        }

        const inlistData = JSON.parse(inlistMatch[1]);
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
 * 获取播放轨道列表 (保持不变)
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
 * 执行搜索 (增加失败回退机制)
 */
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索 (游客模式): ${url}`);
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Referer': appConfig.site } });
        const $ = cheerio.load(data);

        if ($('.v5d').length === 0) {
            log("搜索请求失败，未找到结果，启动回退机制。");
            $utils.toastError("搜索失败, 将在浏览器中打开结果", 4000);
            $utils.openSafari(url, UA); // 直接打开搜索结果页
            return jsonify({ list: [] });
        }

        let cards = [];
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const titleAnchor = $element.find('.text b a');
            const name = titleAnchor.text().trim();
            const path = titleAnchor.attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            const imgUrl = $element.find('img').attr('data-src');
            let finalImgUrl = imgUrl || '';
            if (finalImgUrl.endsWith('.webp')) {
                finalImgUrl = finalImgUrl.replace('.webp', '/220.webp');
            } else if (finalImgUrl.endsWith('.avif')) {
                finalImgUrl = finalImgUrl.replace('.avif', '/220.avif');
            }
            const additionalInfo = $element.find('.text p').first().text().trim();
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: finalImgUrl,
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放链接 (保持不变)
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
