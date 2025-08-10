/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.1 (最终修复版)
 *
 * 版本历史:
 * v3.1: 【终极校准】使用了用户提供的、通过完整验证后捕获的最新Cookie，确保身份凭证的绝对有效性。
 * v3.0: 【终极修复】为搜索功能配备了完整的、从真实浏览器捕获的请求头，包括完整的Cookie和Referer，以绕过服务器的特殊校验。
 * v2.0: 修复了搜索URL格式和结果页解析逻辑，但因缺少完整请求头而失败。
 * v1.0: 修正了域名，修复了分类和详情页功能。
 *
 * 功能特性:
 * 1.  【专注核心】: 仅提取网盘资源。
 * 2.  【高级反制】: 内置完整的Cookie和请求头，高度模拟真实用户行为。
 * 3.  【功能完整】: 分类、搜索、详情提取功能均已调通。
 * 4.  【智能命名】: 网盘链接以“影视标题 + 关键规格”命名。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();

// 【已更新】使用您从手机模拟模式下捕获的、所有可见的请求头信息
const FULL_HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/json",
    "Origin": "https://www.qwmkv.com",
    "Referer": "https://www.qwmkv.com/",
    "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"iOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X ) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1"
};

// 【已更新】使用您提供的最新Cookie截图进行组合。这是脚本的灵魂！
const FULL_COOKIE = 'PHPSESSID=1jjsgbis8gm2iar67halbk2o4o; _ok4_=tmk9Ntw6NgxfO2eRI3t5QD0tjjEail+TisiV+momDYdOyg5Nf6yZRYsZd9AOYFe2vvGwQvFAVYdczVoES2NfX7nYMаVklh17zJO6WhjfF0/tJiCPPTbj2wn+yNx90Dr3';


const appConfig = {
    ver: 3.1, // 版本号也更新一下
    title: '七味网(纯盘)',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================

function log(msg  ) { try { $log(`[七味网 v3.1] ${msg}`); } catch (_) { console.log(`[七味网 v3.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【已校准】这个函数现在会使用上面定义好的完整的请求头和最新的Cookie
async function fetchWithCookie(url, customHeaders = {}) {
    const headers = {
        ...FULL_HEADERS,
        'Cookie': FULL_COOKIE, // 确保使用最新的Cookie
        ...customHeaders
    };
    log(`请求URL: ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 ==================
// (以下代码保持不变)
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
    const url = `${appConfig.site}${pagePath}`;

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
                cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
            }
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    try {
        const { data: html } = await fetchWithCookie(url, { 'Referer': appConfig.site });
        const $ = cheerio.load(html);
        const vod_name = $('div.main-ui-meta h1').text().replace(/\(\d+\)$/, '').trim();
        const tracks = [];
        const panDownloadArea = $('h2:contains("网盘下载")').parent();
        if (panDownloadArea.length === 0) return jsonify({ list: [] });

        const panTypes = [];
        panDownloadArea.find('.nav-tabs .title').each((_, el) => panTypes.push($(el).text().trim()));

        panDownloadArea.find('.down-list.tab-content > ul.content').each((index, ul) => {
            const panType = panTypes[index] || '未知网盘';
            const groupTracks = [];
            $(ul).find('li.down-list2').each((_, li) => {
                const $a = $(li).find('p.down-list3 a');
                const linkUrl = $a.attr('href');
                const originalTitle = $a.attr('title') || $a.text();
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
            });
            if (groupTracks.length > 0) {
                tracks.push({ title: panType, tracks: groupTracks });
            }
        });
        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const encodedText = encodeURIComponent(ext.text);
    const url = `${appConfig.site}/vs/-------------.html?wd=${encodedText}`;

    try {
        const { data: html } = await fetchWithCookie(url);
        const $ = cheerio.load(html);
        const cards = [];
        $('div.sr_lists dl').each((_, element) => {
            const $dl = $(element);
            const vod_id = $dl.find('dt a').attr('href');
            const vod_name = $dl.find('dd p strong a').text();
            const vod_pic = $dl.find('dt a img').attr('src');
            const vod_remarks = $dl.find('dd p span.ss1').text().trim();
            if (vod_id && vod_name) {
                cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
            }
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
