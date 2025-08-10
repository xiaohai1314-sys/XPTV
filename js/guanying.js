/**
 * gying.org - 纯网盘提取脚本 - v5.0 (修复版)
 *
 * 版本历史:
 * v5.0 (修复版): 基于原始v5.0版本，仅重写 getTracks 函数的核心解析逻辑，以适配网站后端API返回的全新数据结构。其余所有功能和逻辑保持不变。
 * v5.0: 【最终版】回归到原脚本正确的getTracks逻辑，并为所有请求注入捕获到的高保真请求头，彻底解决所有功能问题。
 * v4.0: 基于错误情报，尝试追踪s.json，方向错误。
 * v3.0: 基于七味网脚本修复，但未完全适配。
 * v2.x: 多个修复版本，解决了部分问题但引入了其他逻辑冲突。
 * v1.0: 初始版本。
 *
 * 功能特性:
 * 1.  【逻辑回归】: getTracks函数回归到正确的 /res/downurl/... API 请求逻辑。
 * 2.  【精准模拟】: 每个核心函数都使用独立的、从真实场景捕获的请求头，实现完美伪装。
 * 3.  【海报修正】: 所有海报URL均已按照 /220.webp 规则修正。
 * 4.  【功能完整】: 分类、搜索、详情、网盘提取功能均已调通并经过最终优化。
 * 5.  【网盘提取修正】: getTracks 函数已更新，以解析新的API数据格式。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

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
// 【【【【【【【【【【【【【【【【【 此函数已被替换为修正版 】】】】】】】】】】】】】】】】】
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
async function getTracks(ext) {
    ext = argsify(ext);
    log(`[v5.0-fix] 开始请求详情数据: ${ext.url}`);

    // 请求头部分保持不变，确保请求能成功发出
    const headers = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Accept': '*/*',
        'Referer': ext.url.replace('/res/downurl', ''), 
    };

    try {
        const { data } = await $fetch.get(ext.url, { headers });
        const respstr = JSON.parse(data);

        // 核心逻辑修正：适配新的数据结构
        if (!respstr.panlist || !respstr.panlist.url) {
            log("❌ 新版数据结构中未找到 panlist 或 panlist.url");
            return jsonify({ list: [] });
        }

        const panData = respstr.panlist;
        const panTypesMap = {}; // 用于按网盘类型分组，例如: { "夸克网盘": [], "百度网盘": [] }

        // 遍历每一个网盘链接
        panData.url.forEach((linkUrl, index) => {
            // 1. 获取网盘类型名称
            const typeIndex = panData.type[index]; // 获取类型数字，如 0, 1, 2
            const panTypeName = (panData.tname && panData.tname[typeIndex]) ? panData.tname[typeIndex] : '其他网盘'; // 根据数字找到网盘名

            // 2. 获取原始标题和提取码
            const originalTitle = panData.name[index] || '未知标题';
            let pwd = (panData.p && panData.p[index]) ? panData.p[index] : ''; // 新结构中提取码在 'p' 数组里

            // 如果 'p' 数组中没有，尝试从标题或链接中再次匹配 (兼容旧逻辑)
            if (!pwd) {
                const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                if (pwdMatch) pwd = pwdMatch[1];
            }
            
            // 3. 构造符合APP识别的单个 track 对象
            //    v5.0的APP似乎需要从标题中提取规格，我们保留这个逻辑
            let spec = '';
            const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
            if (specMatch) spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
            const trackName = spec ? `${respstr.info.t} (${spec})` : originalTitle;

            const track = {
                name: trackName, // 使用和旧版v5.0相似的标题生成逻辑
                pan: linkUrl,
                ext: { pwd: pwd }
            };

            // 4. 按网盘类型进行分组
            if (!panTypesMap[panTypeName]) {
                panTypesMap[panTypeName] = [];
            }
            panTypesMap[panTypeName].push(track);
        });

        // 5. 将分组后的数据转换为APP要求的最终格式
        const tracks = Object.keys(panTypesMap).map(panTypeName => {
            return {
                title: panTypeName, // 分组标题，如 "夸克网盘"
                tracks: panTypesMap[panTypeName] // 该分组下的所有链接
            };
        });

        log(`[v5.0-fix] 成功解析到 ${tracks.length} 个网盘分组`);
        return jsonify({ list: tracks });

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// 【【【【【【【【【【【【【【【【【 以上函数已被替换为修正版 】】】】】】】】】】】】】】】】】
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
