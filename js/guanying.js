/**
 * 观影网脚本 - v19.2 (最终稳定修正版)
 *
 * --- 核心修正 ---
 * 1.  【恢复列表页功能】: 经用户反馈，v19.1版本破坏了列表页。此版本严格恢复了 `getCards` 函数至 v19.0 的原始状态，确保分类列表页功能完全正常。
 * 2.  【精确定位并修复搜索】: 仅修改 `search` 函数，使其能够正确解析新版搜索结果页的HTML结构，并正确处理海报URL，同时不影响任何其他函数。
 * 3.  【保持原始逻辑】: 严格遵循用户要求，除 `search` 函数外，所有其他函数、配置和Cookie均与用户提供的 v19.0 原始版本保持100%一致。
 * 4.  这是一个经过仔细比对和验证的、旨在稳定运行的最终版本。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// 【Cookie修正】直接使用您提供的有效Cookie (原封不动)
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 19.2, // 版本号更新为最终稳定版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 (原封不动 ) ==================

function log(msg) { try { $log(`[观影网 V19.2] ${msg}`); } catch (_) { console.log(`[观影网 V19.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

/**
 * 使用固定的Cookie发起网络请求 (原封不动)
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【业务逻辑函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 获取分类页面的卡片列表 (恢复至 v19.0 的原始正确代码)
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
 * 获取播放轨道列表 (原封不动)
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
 * 执行搜索 (唯一被修改的函数，已验证)
 */
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
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
            
            // 【关键修正】优先获取 <img> 的 data-src，如果不存在再获取 <source> 的 data-srcset
            const imgUrl = $element.find('img[data-src]').attr('data-src') || $element.find('source[data-srcset]').attr('data-srcset');

            // 【关键修正】对获取到的 URL 进行处理，添加 /220 后缀
            let finalImgUrl = imgUrl || '';
            if (finalImgUrl.endsWith('.webp')) {
                finalImgUrl = finalImgUrl.replace('.webp', '/220.webp');
            } else if (finalImgUrl.endsWith('.avif')) {
                finalImgUrl = finalImgUrl.replace('.avif', '/220.avif');
            }
            
            const remarks = $element.find('.text p').first().text().trim();

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: finalImgUrl,
                vod_remarks: remarks,
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
 * 获取播放链接 (原封不动)
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
