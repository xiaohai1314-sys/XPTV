/**
 * gying.org - 纯网盘提取脚本 - v2.2 (终极稳定版)
 *
 * 版本历史:
 * v2.2: 【逻辑修正】修复了v2.1中因修改ext对象导致程序崩溃的问题。getTracks函数改为从详情API直接获取标题，增强了健壮性。
 * v2.1: 恢复了网盘提取逻辑，但引入了新的bug。
 * v2.0: 修复了搜索功能。
 * v1.0: 初始版本。
 *
 * 功能特性:
 * 1.  【稳定可靠】: 核心逻辑回归原脚本的稳定实现，杜绝程序崩溃。
 * 2.  【功能完整】: 分类、搜索、详情、网盘提取功能均正常工作。
 * 3.  【智能命名】: 网盘链接命名逻辑优化，数据来源更可靠。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const Gying_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 2.2,
    title: '观影网(gying)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v2.2] ${msg}`); } catch (_) { console.log(`[gying.org v2.2] ${msg}`); } }
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

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    try {
        const { data: html } = await fetchWithCookie(url);
        const inlistMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能匹配到 _obj.inlist 数据");
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) return jsonify({ list: [] });
        
        const cards = inlistData.i.map((item, index) => {
            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                // 【v2.2 修正】保持ext对象纯粹 ，避免程序崩溃
                ext: { url: detailApiUrl },
            };
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    try {
        const { data } = await fetchWithCookie(ext.url);
        const respstr = JSON.parse(data);
        
        // 【v2.2 修正】从详情API的响应中直接获取标题
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
                // 【v2.2 修正】保持ext对象纯粹
                ext: { url: detailApiUrl },
            };
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

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
