/**
 * gying.org - 纯网盘提取脚本 - v5.0 (最终修复版)
 *
 * 版本历史:
 * v5.0 (最终修复版): 基于cURL分析，为getTracks函数补全了所有必要的sec-系列请求头，
 *                  并重写解析逻辑，以通过服务器的深度验证并解析新版数据结构。
 *                  同时确保了原版“从标题提取规格”的逻辑被完整保留。
 * v5.0: 初始版本，因数据结构和请求头验证过时而失效。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

// 【v5.0 修正】使用您提供的最新、最完整的Cookie
const FULL_COOKIE = 'BT_auth=8565kIRT4Z0yWre8pXbJCKu5q4XvlKyhoybL3LFRNOCcdoyRK7AqhD4GveutC_n2RdCpn7YxS8C-i4jeUzMKi2bDIk88vseRWPdA-L1nEYSVLWW027hH0iQU05dKXR_tLJnXdjZMfu82-5et4DzcXVce8kinyJMAcNJBHMAPWPEWZJZNgfTvgA; BT_cookietime=b308GxC0f8zp2aGCrk3hbqzfs_wAGNbfpW5gh4uPXNbLFQMqH8eS; browser_verified=df0d7e83481eaf13a2932eef544a21bc;';

const appConfig = {
    ver: 5.0,
    title: '观影网(gying)',
    site: 'https://www.gying.org',
    tabs: [
        { name: '电影', ext: { id: '/mv?page=' } },
        { name: '剧集', ext: { id: '/tv?page=' } },
        { name: '动漫', ext: { id: '/ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg  ) { try { $log(`[gying.org v5.0] ${msg}`); } catch (_) { console.log(`[gying.org v5.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    
    // 【v5.0 修正】使用针对分类页捕获的完整请求头
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
            const detailApiUrl = `${appConfig.site}/res/downurl/${inlistData.ty}/${item}`;
            return {
                vod_id: detailApiUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`, // 【海报修正】
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        }  );
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 【【【【【【【【【【【【【【【【【 此函数已被替换为最终修正版 】】】】】】】】】】】】】】】】】
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
async function getTracks(ext) {
    ext = argsify(ext);
    log(`[v5.0-final-fix] 开始请求详情数据: ${ext.url}`);

    // 【最终修正】补全所有在cURL中发现的、由真实浏览器生成的请求头
    const headers = {
        'accept': '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'Cookie': FULL_COOKIE,
        'priority': 'u=1, i',
        'referer': ext.url.replace('/res/downurl', ''), // v5.0原始的Referer构造方式经确认为正确，予以保留
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    };

    try {
        const { data } = await $fetch.get(ext.url, { headers });
        const respstr = JSON.parse(data);

        // 【最终修正】使用新的解析逻辑
        if (!respstr.panlist || !respstr.panlist.url) {
            log("❌ 数据结构中未找到 panlist 或 panlist.url，请求可能被服务器验证拦截。");
            return jsonify({ list: [] });
        }

        const panData = respstr.panlist;
        const panTypesMap = {}; // 用于按网盘类型分组

        // 遍历每一个网盘链接
        panData.url.forEach((linkUrl, index) => {
            // 1. 获取网盘类型名称
            const typeIndex = panData.type[index];
            const panTypeName = (panData.tname && panData.tname[typeIndex]) ? panData.tname[typeIndex] : '其他网盘';

            // 2. 获取原始标题和提取码
            const originalTitle = panData.name[index] || '未知标题';
            let pwd = (panData.p && panData.p[index]) ? panData.p[index] : '';

            if (!pwd) {
                const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                if (pwdMatch) pwd = pwdMatch[1];
            }
            
            // 3. 【关键保留】恢复并应用您指定的“从标题提取规格”的逻辑
            let spec = '';
            // 使用与v5.0原始脚本完全相同的正则表达式
            const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
            if (specMatch) {
                spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
            }
            
            // 使用与v5.0原始脚本完全相同的标题构造方式
            const vod_name = respstr.info.t || '资源';
            const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;

            // 4. 构造最终的track对象
            const track = {
                name: trackName,
                pan: linkUrl,
                ext: { pwd: pwd }
            };

            // 5. 按网盘类型进行分组
            if (!panTypesMap[panTypeName]) {
                panTypesMap[panTypeName] = [];
            }
            panTypesMap[panTypeName].push(track);
        });

        // 6. 将分组后的数据转换为APP要求的最终格式
        const tracks = Object.keys(panTypesMap).map(panTypeName => {
            return {
                title: panTypeName,
                tracks: panTypesMap[panTypeName]
            };
        });

        log(`[v5.0-final-fix] 成功解析到 ${tracks.length} 个网盘分组`);
        return jsonify({ list: tracks });

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// 【【【【【【【【【【【【【【【【【 以上函数已被替换为最终修正版 】】】】】】】】】】】】】】】】】
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


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
            const detailApiUrl = `${appConfig.site}/res/downurl/${type}/${vodId}`;
            const vodName = `${searchData.title[index]} ${searchData.name[index]} (${searchData.year[index]})`;
            return {
                vod_id: detailApiUrl,
                vod_name: vodName,
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`, // 【海报修正】
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1  ) : '--'}`,
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
