/**
 * gying.org - 纯网盘提取脚本 - v7.0 (最终置信版)
 *
 * 版本历史:
 * v7.0: 【最终置信版】在经历了所有探索后，回归到唯一被验证过的正确道路。坚定地使用 /res/downurl/ API，并为其注入高保真请求头以通过验证。同时集成了强大的错误处理机制。
 * v6.0: 错误的“环境兼容性”修正，方向错误。
 * v5.1: 错误的全局请求头修改，导致功能崩溃。
 * v5.0: 逻辑正确的版本，但错误处理不足。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【v7.0 提示】此Cookie是脚本运行的唯一命脉。如果脚本失效，请在浏览器中访问gying.org完成验证后，将新的Cookie完整替换到此处。
const FULL_COOKIE = 'BT_auth=8565kIRT4Z0yWre8pXbJCKu5q4XvlKyhoybL3LFRNOCcdoyRK7AqhD4GveutC_n2RdCpn7YxS8C-i4jeUzMKi2bDIk88vseRWPdA-L1nEYSVLWW027hH0iQU05dKXR_tLJnXdjZMfu82-5et4DzcXVce8kinyJMAcNJBHMAPWPEWZJZNgfTvgA; BT_cookietime=b308GxC0f8zp2aGCrk3hbqzfs_wAGNbfpW5gh4uPXNbLFQMqH8eS; browser_verified=df0d7e83481eaf13a2932eef544a21bc;';

const appConfig = {
    ver: 7.0,
    title: '观影网(gying)',
    site: 'https://www.gying.org',
    tabs: [
        { name: '电影', ext: { id: '/mv?page=' } },
        { name: '剧集', ext: { id: '/tv?page=' } },
        { name: '动漫', ext: { id: '/ac?page=' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v7.0] ${msg}`); } catch (_) { console.log(`[gying.org v7.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【v7.0 修正】为不同类型的请求构建不同的高保真请求头
function buildHtmlHeaders(referer) {
    const headers = {};
    headers['User-Agent'] = String(UA);
    headers['Cookie'] = String(FULL_COOKIE);
    headers['Referer'] = String(referer);
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
    return headers;
}

function buildApiHeaders(referer) {
    const headers = {};
    headers['User-Agent'] = String(UA);
    headers['Cookie'] = String(FULL_COOKIE);
    headers['Referer'] = String(referer);
    headers['Accept'] = '*/*'; // API请求的关键
    headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
    return headers;
}

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    const headers = buildHtmlHeaders(`${appConfig.site}/`);

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
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl },
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
    const detailPageUrl = ext.url.replace('/res/downurl', '');
    const headers = buildApiHeaders(detailPageUrl); // 使用专门为API设计的请求头

    try {
        const { data } = await $fetch.get(ext.url, { headers });
        const respstr = JSON.parse(data);
        
        if (respstr.hasOwnProperty('panlist') && respstr.panlist.url && respstr.panlist.url.length > 0) {
            const vod_name = respstr.info.t || '资源';
            const tracks = [];
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
            
            return jsonify({ list: tracks });

        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('Cookie失效，请前往主站完成验证后更新脚本', 5000);
            return jsonify({ list: [] });
        } else {
            $utils.toastError('没有找到可用的网盘资源', 4000);
            return jsonify({ list: [] });
        }

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`请求资源失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${encodeURIComponent(ext.text)}`;
    const headers = buildHtmlHeaders(`${appConfig.site}/`);

    try {
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
