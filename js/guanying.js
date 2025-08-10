/**
 * gying.org - 纯网盘提取脚本 - v6.0 (环境兼容·终极版)
 *
 * 版本历史:
 * v6.0: 【环境兼容·终极版】在v5.0的正确逻辑基础上，对请求头的构建方式进行强化，以最大可能兼容APP环境中的JS引擎差异，确保所有请求头参数被正确发送。
 * v5.0: 【回归初心】回归到原脚本正确的getTracks逻辑，并为所有请求注入捕获到的高保真请求头。
 * v4.0: 基于错误情报，尝试追踪s.json，方向错误。
 * v3.0: 基于七味网脚本修复，但未完全适配。
 * v1.0: 初始版本。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【v6.0 修正】使用您提供的最新、最完整的Cookie
const FULL_COOKIE = 'BT_auth=8565kIRT4Z0yWre8pXbJCKu5q4XvlKyhoybL3LFRNOCcdoyRK7AqhD4GveutC_n2RdCpn7YxS8C-i4jeUzMKi2bDIk88vseRWPdA-L1nEYSVLWW027hH0iQU05dKXR_tLJnXdjZMfu82-5et4DzcXVce8kinyJMAcNJBHMAPWPEWZJZNgfTvgA; BT_cookietime=b308GxC0f8zp2aGCrk3hbqzfs_wAGNbfpW5gh4uPXNbLFQMqH8eS; browser_verified=df0d7e83481eaf13a2932eef544a21bc;';

const appConfig = {
    ver: 6.0,
    title: '观影网(gying)',
    site: 'https://www.gying.org',
    tabs: [
        { name: '电影', ext: { id: '/mv?page=' } },
        { name: '剧集', ext: { id: '/tv?page=' } },
        { name: '动漫', ext: { id: '/ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v6.0] ${msg}`); } catch (_) { console.log(`[gying.org v6.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【v6.0 新增】高保真请求头构建函数
function buildHeaders(referer) {
    const headers = {};
    headers['User-Agent'] = String(UA);
    headers['Cookie'] = String(FULL_COOKIE);
    headers['Referer'] = String(referer);
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
    return headers;
}

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    const headers = buildHeaders(`${appConfig.site}/`);

    try {
        log(`请求分类页: ${url}`);
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
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
            };
        } );
        log(`成功解析到 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const detailPageUrl = ext.url.replace('/res/downurl', '');
    const headers = buildHeaders(detailPageUrl); // Referer是详情页的URL
    headers['Accept'] = '*/*'; // API请求通常接受任何类型

    try {
        log(`请求详情API: ${ext.url}`);
        const { data } = await $fetch.get(ext.url, { headers });
        const respstr = JSON.parse(data);
        log("成功获取并解析API响应JSON");

        const vod_name = respstr.info.t || '资源';
        const tracks = [];

        if (respstr.hasOwnProperty('panlist') && respstr.panlist.url && respstr.panlist.url.length > 0) {
            log(`发现 panlist，包含 ${respstr.panlist.url.length} 个链接`);
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
        } else {
            log("API响应中未找到有效的 panlist 数据");
        }
        
        log(`处理完成，共找到 ${tracks.length} 个分组`);
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
    const headers = buildHeaders(`${appConfig.site}/`);

    try {
        log(`请求搜索页: ${url}`);
        const { data: html } = await $fetch.get(url, { headers });
        const dataMatch = html.match(/_obj\.search\s*=\s*({.*?});/);
        if (!dataMatch || !dataMatch[1]) throw new Error("未在搜索结果页匹配到 _obj.search 数据");
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
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`,
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1 ) : '--'}`,
                ext: { url: detailApiUrl },
            };
        });
        log(`成功解析到 ${cards.length} 个搜索结果`);
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
