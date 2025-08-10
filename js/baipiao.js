/**
 * 观影网(七味网) - 纯网盘提取脚本 - v1.0
 *
 * 功能特性:
 * 1.  【专注核心】: 严格按照用户要求，仅提取网盘资源，代码简洁高效。
 * 2.  【Cookie策略】: 内置用户提供的有效Cookie，稳定绕过网站的人机验证。
 * 3.  【精准分类】: 支持电影、剧集、综艺、动漫四大分类。
 * 4.  【智能命名】: 提取的网盘链接以“影视标题 + 关键规格”命名，清晰明了。
 * 5.  【健壮解析】: 能够稳定解析详情页中的多种网盘类型及其提取码。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// 【Cookie策略】使用您提供的有效Cookie
const EFFECTIVE_COOKIE = '_ok4_=NAeXbe+DhTpafaoTAXzum2H1tNveMtSDEyUgv84Ve0zQEvP3UQ/cmuxfWZNvNO7rNzFvFnPQZJLHNGQbxg4I35L4vnukd1fJzZ0rusTqPuuu4874BjMPIIOxrSNXh3qB;';

const appConfig = {
    ver: 1.0,
    title: '七味网(纯盘)',
    site: 'https://www.qn63.com', // 基于HTML源码确定的域名
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================

function log(msg ) { try { $log(`[七味网] ${msg}`); } catch (_) { console.log(`[七味网] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

/**
 * 携带固定Cookie发起网络请求
 */
async function fetchWithCookie(url, options = {}) {
    const headers = {
        'User-Agent': UA,
        'Cookie': EFFECTIVE_COOKIE,
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
 */
async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}${ext.id.replace('.html', '')}-${page}.html`;

    try {
        const { data: html } = await fetchWithCookie(url);
        const $ = cheerio.load(html);
        const cards = [];

        $('ul.content-list > li').each((_, element) => {
            const $li = $(element);
            const vod_id = $li.find('a').first().attr('href');
            const vod_name = $li.find('h3 > a').attr('title');
            const vod_pic = $li.find('div.li-img img').attr('src');
            const vod_remarks = $li.find('span.bottom2').text().trim();

            if (vod_id && vod_name) {
                cards.push({
                    vod_id,
                    vod_name,
                    vod_pic,
                    vod_remarks,
                    ext: { url: vod_id },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取详情页的网盘轨道列表
 */
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;

    try {
        const { data: html } = await fetchWithCookie(url);
        const $ = cheerio.load(html);

        const vod_name = $('div.main-ui-meta h1').text().replace(/\(\d+\)$/, '').trim();
        const tracks = [];

        // 定位到网盘下载区域
        const panDownloadArea = $('h2:contains("网盘下载")').parent();
        if (panDownloadArea.length === 0) {
            log("未找到网盘下载区域");
            return jsonify({ list: [] });
        }

        const panTypes = [];
        panDownloadArea.find('.nav-tabs .title').each((_, el) => {
            panTypes.push($(el).text().trim());
        });

        panDownloadArea.find('.down-list.tab-content > ul.content').each((index, ul) => {
            const panType = panTypes[index] || '未知网盘';
            const groupTracks = [];

            $(ul).find('li.down-list2').each((_, li) => {
                const $a = $(li).find('p.down-list3 a');
                const linkUrl = $a.attr('href');
                const originalTitle = $a.attr('title') || $a.text();

                // 提取关键规格信息
                let spec = '';
                const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
                if (specMatch) {
                    // 去重并拼接
                    spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ');
                }
                
                const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 20)}...)`;

                // 提取提取码
                let pwd = '';
                const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/);
                if (pwdMatch) {
                    pwd = pwdMatch[1];
                }

                groupTracks.push({
                    name: trackName,
                    pan: linkUrl,
                    ext: { pwd: pwd }
                });
            });

            if (groupTracks.length > 0) {
                tracks.push({
                    title: panType,
                    tracks: groupTracks
                });
            }
        });

        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 执行搜索
 */
async function search(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const url = `${appConfig.site}/vs/${ext.text}----------${page}---.html`;

    try {
        const { data: html } = await fetchWithCookie(url);
        const $ = cheerio.load(html);
        const cards = [];

        $('ul.content-list > li').each((_, element) => {
            const $li = $(element);
            const vod_id = $li.find('a').first().attr('href');
            const vod_name = $li.find('h3 > a').attr('title');
            const vod_pic = $li.find('div.li-img img').attr('src');
            const vod_remarks = $li.find('span.bottom2').text().trim();

            if (vod_id && vod_name) {
                cards.push({
                    vod_id,
                    vod_name,
                    vod_pic,
                    vod_remarks,
                    ext: { url: vod_id },
                });
            }
        });

        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

/**
 * 获取播放链接 (在此脚本中，即网盘链接)
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    
    let finalUrl = panLink;
    if (password) {
        finalUrl += `\n提取码: ${password}`;
    }
    
    // 对于网盘链接，通常是直接返回链接供用户复制
    return jsonify({
        urls: [finalUrl]
    });
}
