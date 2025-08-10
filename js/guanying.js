/**
 * gying.org - 纯网盘提取脚本 - v2.1 (网盘功能恢复版)
 *
 * 版本历史:
 * v2.1: 【功能恢复】恢复了被遗漏的、完整的网盘链接提取和格式化逻辑，确保核心功能完整。
 * v2.0: 修复了搜索功能，但错误地简化了网盘提取逻辑。
 * v1.0: 初始版本，分类和详情功能正常，搜索功能待修复。
 *
 * 功能特性:
 * 1.  【专注核心】: 仅提取网盘资源，并能处理多种网盘类型及提取码。
 * 2.  【Cookie策略】: 内置有效Cookie，稳定访问。
 * 3.  【全功能修复】: 分类、搜索、详情提取功能均已调通。
 * 4.  【高效解析】: 搜索功能直取数据核心，精准且高效。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// gying.org 的有效Cookie
const Gying_COOKIE = 'BT_auth=14c1jE0Dre6jn9SM1nuV6fiGDyrt-kTogiBFgNq8EJVKWC7uewDzoTun981wua_5-fSwVbsXlQxEc7VR5emDJ3mC9d6xQv2n5g2NxEetQJxmYadFe3M3Rv7G-yYMFqUcBezHLOTuQD6_WpS93rg4jQIa8jatA1Z5ZgbCbdUj_5hrN94dXeatvA;BT_cookietime=9005krUNeXOWwSmnEPTL02XixYeVHBuMSSPiA4x4oSfTUXODkJJ3;browser_verified=b142dc23ed95f767248f452739a94198;';

const appConfig = {
    ver: 2.1,
    title: '观影网(gying)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org] ${msg}`); } catch (_) { console.log(`[gying.org] ${msg}`); } }
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
        const cards = inlistData.i.map((item, index) => ({
            vod_id: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
            vod_name: inlistData.t[index],
            vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
            vod_remarks: inlistData.g[index] || '',
            ext: { 
                url: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
                vod_name: inlistData.t[index] // 将主标题传递给详情页
            },
        } ));
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
        
        // 从 ext 中获取主标题，如果不存在则设为默认值
        const vod_name = ext.vod_name || '资源';
        const tracks = [];

        if (respstr.hasOwnProperty('panlist')) {
            const panData = respstr.panlist;
            const panTypes = [...new Set(panData.t)]; // 获取所有不重复的网盘类型

            panTypes.forEach(panType => {
                const groupTracks = [];
                panData.t.forEach((type, index) => {
                    if (type === panType) {
                        const linkUrl = panData.url[index];
                        const originalTitle = panData.name[index];

                        // 提取关键规格信息
                        let spec = '';
                        const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
                        if (specMatch) {
                            spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
                        }
                        
                        const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;

                        // 提取提取码
                        let pwd = '';
                        const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                        if (pwdMatch) {
                            pwd = pwdMatch[1];
                        }

                        groupTracks.push({
                            name: trackName,
                            pan: linkUrl,
                            ext: { pwd: pwd }
                        });
                    }
                });

                if (groupTracks.length > 0) {
                    tracks.push({
                        title: panType,
                        tracks: groupTracks
                    });
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
                ext: { 
                    url: detailApiUrl,
                    vod_name: vodName // 将主标题传递给详情页
                },
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
