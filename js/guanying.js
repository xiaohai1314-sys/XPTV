/**
 * gying.org - 纯网盘提取脚本 - v8.0 (返璞归真·终极版)
 *
 * 版本历史:
 * v8.0: 【返璞归真·终极版】彻底重写getTracks，回归到最正确的HTML解析方案，并根据用户要求精准筛选网盘类型。
 * v7.0: 错误的API请求导致功能崩溃。
 * v5.1: 错误的全局请求头修改，导致功能崩溃。
 * v5.0: 逻辑正确的版本，但getTracks方向错误。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【v8.0 提示】此Cookie是脚本运行的唯一命脉。如果脚本失效，请在浏览器中访问gying.org完成验证后，将新的Cookie完整替换到此处。
const FULL_COOKIE = 'BT_auth=8565kIRT4Z0yWre8pXbJCKu5q4XvlKyhoybL3LFRNOCcdoyRK7AqhD4GveutC_n2RdCpn7YxS8C-i4jeUzMKi2bDIk88vseRWPdA-L1nEYSVLWW027hH0iQU05dKXR_tLJnXdjZMfu82-5et4DzcXVce8kinyJMAcNJBHMAPWPEWZJZNgfTvgA; BT_cookietime=b308GxC0f8zp2aGCrk3hbqzfs_wAGNbfpW5gh4uPXNbLFQMqH8eS; browser_verified=df0d7e83481eaf13a2932eef544a21bc;';

const appConfig = {
    ver: 8.0,
    title: '观影网(gying)',
    site: 'https://www.gying.org',
    tabs: [
        { name: '电影', ext: { id: '/mv?page=' } },
        { name: '剧集', ext: { id: '/tv?page=' } },
        { name: '动漫', ext: { id: '/ac?page=' } },
    ],
};

// 【v8.0 新增】您指定的网盘类型
const ALLOWED_PAN_TYPES = {
    '夸克网盘': /quark/i,
    'UC网盘': /uc/i,
    '天翼网盘': /189/i,
    '阿里网盘': /ali/i,
    '115网盘': /115/i,
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[gying.org v8.0] ${msg}`); } catch (_) { console.log(`[gying.org v8.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

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
        const { data: html } = await $fetch.get(url, { headers });
        const inlistMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("未能匹配到 _obj.inlist 数据");
        const inlistData = JSON.parse(inlistMatch[1]);
        if (!inlistData || !inlistData.i) return jsonify({ list: [] });

        const cards = inlistData.i.map((item, index) => {
            // 【v8.0 修正】vod_id直接使用详情页路径
            const detailPageUrl = `/${inlistData.ty}/${item}`;
            return {
                vod_id: detailPageUrl,
                vod_name: inlistData.t[index],
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailPageUrl }, // ext.url也使用详情页路径
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
    const detailPageUrl = `${appConfig.site}${ext.url}`;
    const headers = buildHeaders(detailPageUrl);

    try {
        log(`请求详情页HTML: ${detailPageUrl}`);
        const { data: html } = await $fetch.get(detailPageUrl, { headers });
        const $ = cheerio.load(html);

        const panListContainer = $('div.pt-list');
        if (panListContainer.length === 0) {
            $utils.toastError('未找到网盘列表容器 (div.pt-list)', 4000);
            return jsonify({ list: [] });
        }

        const tracksByGroup = {};

        panListContainer.find('li').each((_, element) => {
            const linkElement = $(element).find('a');
            if (linkElement.length === 0) return;

            const href = linkElement.attr('href');
            const title = linkElement.text();

            if (!href || href === 'javascript:;') return;

            let matchedType = null;
            for (const typeName in ALLOWED_PAN_TYPES) {
                if (ALLOWED_PAN_TYPES[typeName].test(href)) {
                    matchedType = typeName;
                    break;
                }
            }

            if (matchedType) {
                if (!tracksByGroup[matchedType]) {
                    tracksByGroup[matchedType] = [];
                }
                
                let pwd = '';
                const pwdMatch = title.match(/(?:提取码|访问码|密码)[：: ]?\s*(\w+)/i);
                if (pwdMatch) {
                    pwd = pwdMatch[1];
                }

                tracksByGroup[matchedType].push({
                    name: title,
                    pan: href,
                    ext: { pwd: pwd }
                });
            }
        });

        const finalList = Object.keys(tracksByGroup).map(groupName => ({
            title: groupName,
            tracks: tracksByGroup[groupName]
        }));

        if (finalList.length === 0) {
            $utils.toastError('在页面中未找到您指定的网盘类型链接', 4000);
        }

        return jsonify({ list: finalList });

    } catch (e) {
        log(`❌ 解析详情页异常: ${e.message}`);
        $utils.toastError(`解析资源失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${encodeURIComponent(ext.text)}`;
    const headers = buildHeaders(`${appConfig.site}/`);

    try {
        const { data: html } = await $fetch.get(url, { headers });
        const dataMatch = html.match(/_obj\.search\s*=\s*({.*?});/);
        if (!dataMatch || !dataMatch[1]) throw new Error("未在搜索结果页匹配到 _obj.search 数据");
        const searchData = JSON.parse(dataMatch[1]).l;
        if (!searchData || !searchData.i) return jsonify({ list: [] });

        const cards = searchData.i.map((_, index) => {
            const type = searchData.d[index];
            const vodId = searchData.i[index];
            // 【v8.0 修正】vod_id直接使用详情页路径
            const detailPageUrl = `/${type}/${vodId}`;
            const vodName = `${searchData.title[index]} ${searchData.name[index]} (${searchData.year[index]})`;
            return {
                vod_id: detailPageUrl,
                vod_name: vodName,
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`,
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1 ) : '--'}`,
                ext: { url: detailPageUrl },
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
