/**
 * gying.org - 纯网盘提取脚本 - v2.3 (完美融合版)
 *
 * 版本历史:
 * v2.3: 【完美融合】getCards函数完全恢复至v19.0原脚本的稳定实现，杜绝崩溃；同时整合已修复的、功能更强的search和getTracks函数。
 * v2.2: 修复了v2.1的逻辑错误，但getCards实现仍有瑕疵。
 * v2.1: 恢复了网盘提取逻辑，但引入了新的bug。
 * v2.0: 修复了搜索功能。
 * v1.0: 初始版本。
 *
 * 功能特性:
 * 1.  【稳定为王】: 分类列表加载逻辑100%采用原脚本，确保程序入口稳定。
 * 2.  【功能完整】: 分类、搜索、详情、网盘提取功能均正常工作。
 * 3.  【智能强大】: 保留了先进的搜索解析逻辑和网盘处理能力。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

const Gying_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 2.3,
    title: '观影网(gying)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v2.3] ${msg}`); } catch (_) { console.log(`[gying.org v2.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function fetchWithCookie(url, options = {}) {
    const headers = {
        'User-Agent': UA,
        'Cookie': Gying_COOKIE,
        'Referer': appConfig.site,
        ...options.headers
    };
    log(`请求URL: ${url}`);
    return $fetch.get(url, { ...options, headers });
}

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

/**
 * 获取分类页面的卡片列表
 * 【v2.3 修正】: 完全恢复至v19.0原脚本的稳定实现
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
        // 在APP环境中，toast可能不可用，但保留以备调试
        try { $utils.toastError(`加载失败: ${e.message}`, 4000); } catch(_) {}
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放轨道列表
 * 【v2.3 修正】: 采用从详情API获取标题的健壮版本
 */
async function getTracks(ext) {
    ext = argsify(ext);
    try {
        const { data } = await fetchWithCookie(ext.url);
        const respstr = JSON.parse(data);
        
        const vod_name = respstr.info.t || '资源';
        const tracks = [];

        if (respstr.hasOwnProperty('panlist')) {
            const panData = respstr.panlist;
            const panTypes = [...new Set(panData.t)];

            panTypes.forEach(panType => {
                const groupTracks = [];
                panData.t.forEach((type, index) => {
                    if (type === panType) {
                        const linkUrl = panData.url[index];
                        const originalTitle = panData.name[index];
                        let spec = '';
                        const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
                        if (specMatch) {
                            spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
                        }
                        const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;
                        let pwd = '';
                        const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                        if (pwdMatch) pwd = pwdMatch[1];
                        groupTracks.push({ name: trackName, pan: linkUrl, ext: { pwd: pwd } });
                    }
                });
                if (groupTracks.length > 0) {
                    tracks.push({ title: panType, tracks: groupTracks });
                }
            });
        }
        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索
 * 【v2.3 修正】: 采用已验证成功的正则提取方案
 */
async function search(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${encodeURIComponent(ext.text)}`;
    try {
        const { data: html } = await fetchWithCookie(url);
        const dataMatch = html.match(/_fun\.setlist\s*\(\s*({.*?})\s*,\s*{/);
        if (!dataMatch || !dataMatch[1]) {
            log("未在搜索结果页匹配到 _fun.setlist 数据");
            return jsonify({ list: [] });
        }
        const searchData = JSON.parse(dataMatch[1]);
        if (!searchData || !searchData.i) return jsonify({ list: [] });

        const cards = searchData.i.map((_, index) => {
            const type = searchData.d[index];
            const vodId = searchData.i[index];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            const vodName = `${searchData.title[index]} ${searchData.name[index]} (${searchData.year[index]})`;
            
            return {
                vod_id: detailApiUrl,
                vod_name: vodName,
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`,
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1 ) : '--'}`,
                ext: { url: detailApiUrl },
            };
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放链接
 * 【v2.3 修正】: 恢复了提取码拼接功能
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    return jsonify({ urls: [finalUrl] });
}
