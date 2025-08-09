/**
 * 观影网脚本 - v20.0 (最终修正版)
 *
 * --- 核心修正 ---
 * 1.  【恢复列表页功能】: 深刻反思后，此版本确保 `getCards` 函数与用户 v19.0 原始版本100%一致，列表页功能必须恢复正常。
 * 2.  【正确修复搜索功能】: 仅修改 `search` 函数，根据用户提供的HTML源码，精确地：
 *     a. 从 `<img>` 标签的 `data-src` 属性提取原始图片URL。
 *     b. 保留并应用用户指出的关键海报URL替换逻辑 (添加 /220 后缀)。
 *     c. 从正确的标签中提取标题、链接和描述。
 * 3.  【绝对的稳定性】: 除 `search` 函数外，其他所有代码、配置、Cookie均保持用户原始版本状态，杜绝任何额外改动。
 * 4.  这是在多次失败后，经过深刻反省和仔细比对后得出的最终解决方案。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// 【Cookie修正】直接使用您提供的有效Cookie (原封不动)
const HARDCODED_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 20.0, // 版本号更新为最终修正版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 核心函数 (原封不动 ) ==================

function log(msg) { try { $log(`[观影网 V20.0] ${msg}`); } catch (_) { console.log(`[观影网 V20.0] ${msg}`); } }
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
 * 获取分类页面的卡片列表 (与v19.0完全一致，确保列表功能正常)
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
 * 获取播放轨道列表 (与v19.0完全一致)
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
 * 执行搜索 (唯一被修改的函数，已根据HTML源码和用户要求重写)
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
            
            // 从 .text 内部的 a 标签获取标题和链接
            const titleAnchor = $element.find('.text b a');
            const name = titleAnchor.text().trim();
            const path = titleAnchor.attr('href');

            if (!path) return;

            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;

            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            
            // 从 <img> 的 'data-src' 提取原始图片链接
            const imgUrl = $element.find('img').attr('data-src');

            // 应用用户指出的关键修正：添加 /220 后缀
            let finalImgUrl = imgUrl || '';
            if (finalImgUrl.endsWith('.webp')) {
                finalImgUrl = finalImgUrl.replace('.webp', '/220.webp');
            } else if (finalImgUrl.endsWith('.avif')) {
                finalImgUrl = finalImgUrl.replace('.avif', '/220.avif');
            }
            
            // 提取附加信息，使用第一个 <p> 标签
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
 * 获取播放链接 (与v19.0完全一致)
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
