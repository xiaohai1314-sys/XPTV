/**
 * gying.org - 纯网盘提取脚本 - v4.0 (最终重构完美版)
 *
 * 版本历史:
 * v4.0: 【最终重构】基于稳定的脚本框架，并填充了针对观影网所有场景捕获的、包含完整请求头的精确请求逻辑，并修正了海报URL，确保所有功能稳定可靠。
 * v3.0: 基于七味网脚本修复，但未完全适配。
 * v2.x: 多个修复版本，解决了部分问题但引入了其他逻辑冲突。
 * v1.0: 初始版本。
 *
 * 功能特性:
 * 1.  【稳定框架】: 采用经过验证的稳定脚本框架，杜绝玄学问题。
 * 2.  【精准模拟】: 每个核心函数都使用独立的、从真实场景捕获的请求头，实现完美伪装。
 * 3.  【海报修正】: 所有海报URL均已按照 /220.webp 规则修正。
 * 4.  【功能完整】: 分类、搜索、详情、网盘提取功能均已调通并经过最终优化。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【v4.0 修正】使用您提供的最新、最完整的Cookie
const FULL_COOKIE = 'BT_auth=8565kIRT4Z0yWre8pXbJCKu5q4XvlKyhoybL3LFRNOCcdoyRK7AqhD4GveutC_n2RdCpn7YxS8C-i4jeUzMKi2bDIk88vseRWPdA-L1nEYSVLWW027hH0iQU05dKXR_tLJnXdjZMfu82-5et4DzcXVce8kinyJMAcNJBHMAPWPEWZJZNgfTvgA; BT_cookietime=b308GxC0f8zp2aGCrk3hbqzfs_wAGNbfpW5gh4uPXNbLFQMqH8eS; browser_verified=df0d7e83481eaf13a2932eef544a21bc;';

const appConfig = {
    ver: 4.0,
    title: '观影网(gying)',
    site: 'https://www.gying.org',
    tabs: [
        { name: '电影', ext: { id: '/mv?page=' } },
        { name: '剧集', ext: { id: '/tv?page=' } },
        { name: '动漫', ext: { id: '/ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v4.0] ${msg}`); } catch (_) { console.log(`[gying.org v4.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    
    const headers = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Referer': `${appConfig.site}/`,
    };

    try {
        const { data: html } = await $fetch.get(url, { headers });
        const inlistMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能匹配到 _obj.inlist 数据");
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) return jsonify({ list: [] });

        const cards = inlistData.i.map((item, index) => {
            const detailPageUrl = `${appConfig.site}/${inlistData.ty}/${item}`;
            return {
                vod_id: detailPageUrl, // vod_id现在是详情页的URL
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`, // 【海报修正】
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailPageUrl, id: item }, // 传递id给getTracks
            };
        } );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    
    // 第一步：请求详情页，获取加密参数v和标题
    let v_param = '';
    let vod_name = '';
    try {
        const detailHeaders = {
            'User-Agent': UA,
            'Cookie': FULL_COOKIE,
            'Referer': appConfig.site,
        };
        const { data: detailHtml } = await $fetch.get(ext.url, { headers: detailHeaders });
        const vMatch = detailHtml.match(/s\.json\?s=9305&v=([A-Za-z0-9%+/=]+)/);
        if (!vMatch || !vMatch[1]) throw new Error("未能从详情页HTML中匹配到v参数");
        v_param = vMatch[1];
        
        const titleMatch = detailHtml.match(/_obj\.d={"title":"([^"]+)"/);
        if (titleMatch) vod_name = titleMatch[1];

    } catch (e) {
        log(`❌ 获取详情页v参数异常: ${e.message}`);
        return jsonify({ list: [] });
    }

    // 第二步：使用v参数请求网盘API
    const apiUrl = `https://p.51gowan.com/s.json?s=9305&v=${v_param}`;
    const apiHeaders = {
        'User-Agent': UA,
        'Accept': '*/*',
        'Origin': appConfig.site,
        'Referer': `${ext.url}/`, // Referer是详情页的URL
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
    };

    try {
        const { data } = await $fetch.get(apiUrl, { headers: apiHeaders } );
        const respstr = JSON.parse(data);
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
                        if (specMatch) spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
                        const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;
                        let pwd = '';
                        const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                        if (pwdMatch) pwd = pwdMatch[1];
                        groupTracks.push({ name: trackName, pan: linkUrl, ext: { pwd: pwd } });
                    }
                });
                if (groupTracks.length > 0) tracks.push({ title: panType, tracks: groupTracks });
            });
        }
        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取网盘API异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${encodeURIComponent(ext.text)}`;
    
    const headers = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Referer': `${appConfig.site}/`,
    };

    try {
        const { data: html } = await $fetch.get(url, { headers });
        const dataMatch = html.match(/_obj\.search\s*=\s*({.*?});/);
        if (!dataMatch || !dataMatch[1]) {
            log("未在搜索结果页匹配到 _obj.search 数据");
            return jsonify({ list: [] });
        }
        const searchData = JSON.parse(dataMatch[1]).l;
        if (!searchData || !searchData.i) return jsonify({ list: [] });

        const cards = searchData.i.map((_, index) => {
            const type = searchData.d[index];
            const vodId = searchData.i[index];
            const detailPageUrl = `${appConfig.site}/${type}/${vodId}`;
            const vodName = `${searchData.title[index]} ${searchData.name[index]} (${searchData.year[index]})`;
            return {
                vod_id: detailPageUrl,
                vod_name: vodName,
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`, // 【海报修正】
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1 ) : '--'}`,
                ext: { url: detailPageUrl, id: vodId },
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
