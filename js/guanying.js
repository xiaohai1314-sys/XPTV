/**
 * gying.org - 纯网盘提取脚本 - v5.0 (最终修正版 - 严格遵照指示)
 *
 * 版本历史:
 * v5.0 (最终修正版): 最终修正。采纳v19.0版本的核心成功策略（移动端UA + 极简请求头），
 *                  并适配新版数据结构。最重要的是，完整保留了v5.0所有原始逻辑，
 *                  特别是“从标题提取规格”的关键代码，未做任何不必要的删改。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
// 【最终修正】全面切换为iPhone的User-Agent
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

// 【最终修正】使用您提供的iPhone版Cookie
const FULL_COOKIE = 'BT_auth=87bbBu-juA8vvbbuLbC7jyCwGSzFXOpEk9euA3cfQAkCXo2lwg4ME6JX6L-iM9eyFn4FZb8kIBsVsRj2F5yVSijdIKWKy0dA8hO7Xs9rkx_GWBciNo2jCzIHB9AC7eJBTdNJ4vB_xM-QyWISygRu_crukIwHb4cTm-7libTqhqOnawlIvfduvQ;BT_cookietime=f068RKUxC5WC8J6ZvFzzk9JDAY2CPxJsM6rzmkXE2lUYxBe50lb1;browser_verified=b142dc23ed95f767248f452739a94198;';

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
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}/220.webp`,
                vod_remarks: inlistData.g[index] || '',
                ext: { url: detailApiUrl }, // 【结构完整性】此行代码被完整保留
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
    log(`[v5.0-final] 请求详情数据: ${ext.url}`);

    // 【最终修正】采用v19.0的极简请求头策略，以匹配移动端验证逻辑
    const headers = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        'Accept': '*/*',
        'Referer': ext.url.replace('/res/downurl', ''),
    };

    try {
        const { data } = await $fetch.get(ext.url, { headers });
        const respstr = JSON.parse(data);

        if (!respstr.panlist || !respstr.panlist.url) {
            log("❌ 数据结构中未找到 panlist 或 panlist.url。");
            return jsonify({ list: [] });
        }

        const panData = respstr.panlist;
        const panTypesMap = {};

        panData.url.forEach((linkUrl, index) => {
            const typeIndex = panData.type[index];
            const panTypeName = (panData.tname && panData.tname[typeIndex]) ? panData.tname[typeIndex] : '其他网盘';
            const originalTitle = panData.name[index] || '未知标题';
            let pwd = (panData.p && panData.p[index]) ? panData.p[index] : '';

            if (!pwd) {
                const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                if (pwdMatch) pwd = pwdMatch[1];
            }
            
            // 【【【【【 关键逻辑完整保留 】】】】】
            // 以下是从v5.0原始脚本中原封不动保留的、您最在意的部分
            let spec = '';
            const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
            if (specMatch) {
                spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
            }
            
            const vod_name = respstr.info.t || '资源';
            const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;
            // 【【【【【 关键逻辑完整保留结束 】】】】】

            const track = {
                name: trackName,
                pan: linkUrl,
                ext: { pwd: pwd }
            };

            if (!panTypesMap[panTypeName]) {
                panTypesMap[panTypeName] = [];
            }
            panTypesMap[panTypeName].push(track);
        });

        const tracks = Object.keys(panTypesMap).map(panTypeName => {
            return {
                title: panTypeName,
                tracks: panTypesMap[panTypeName]
            };
        });

        log(`[v5.0-final] 成功解析到 ${tracks.length} 个网盘分组`);
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
                vod_pic: `https://s.tutu.pm/img/${type}/${vodId}/220.webp`,
                vod_remarks: `豆瓣 ${searchData.pf.db.s[index] ? searchData.pf.db.s[index].toFixed(1  ) : '--'}`,
                ext: { url: detailApiUrl }, // 【结构完整性】此行代码被完整保留
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
