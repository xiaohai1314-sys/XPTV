/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0 (前后端分离版)
 *
 * 版本历史:
 * v4.0: 【架构升级】改造为前后端分离模式。前端不再维护Cookie，而是通过API向一个独立的后端服务动态获取最新、有效的Cookie，彻底解决Cookie失效问题。
 * v3.0: 【终极修复】为搜索功能配备了完整的、从真实浏览器捕获的请求头，包括完整的Cookie和Referer，以绕过服务器的特殊校验。
 * v2.0: 修复了搜索URL格式和结果页解析逻辑，但因缺少完整请求头而失败。
 * v1.0: 修正了域名，修复了分类和详情页功能。
 *
 * 功能特性:
 * 1.  【专注核心】: 仅提取网盘资源。
 * 2.  【高级反制】: 通过后端服务实现Cookie的自动续期和验证，实现“永不掉线”。
 * 3.  【功能完整】: 分类、搜索、详情提取功能均已调通。
 * 4.  【智能命名】: 网盘链接以“影视标题 + 关键规格”命名。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ★★★【修改 1/4】新增：后端Cookie服务地址 ★★★
// 请确保您的后端服务正在此地址运行。
const COOKIE_SERVER_URL = 'http://192.168.1.7:3000/getCookie';

// ★★★【修改 2/4】移除：硬编码的Cookie常量已被后端服务取代 ★★★
// const FULL_COOKIE = '...'; // 此行已移除

const appConfig = {
    // 版本号更新以反映架构变化
    ver: 4.0,
    title: '七味网(纯盘 )',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================

function log(msg  ) { try { $log(`[七味网 v4.0] ${msg}`); } catch (_) { console.log(`[七味网 v4.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★【修改 3/4】新增：从后端获取最新Cookie的函数 ★★★
async function getLatestCookie() {
    try {
        log('正在从后端Cookie服务获取最新Cookie...');
        const { data } = await $fetch.get(COOKIE_SERVER_URL);
        if (data && data.status === 'success' && data.cookie) {
            log('✅ 成功获取到最新Cookie！');
            return data.cookie;
        }
        // 如果后端返回的不是成功状态，也视为错误
        const errorMsg = (data && data.message) ? data.message : '后端返回的Cookie无效或格式错误。';
        throw new Error(errorMsg);
    } catch (e) {
        log(`❌ 获取后端Cookie失败: ${e.message}`);
        // 返回null，让调用方知道获取失败
        return null;
    }
}

// ★★★【修改 4/4】改造：核心请求函数，使其动态获取Cookie ★★★
async function fetchWithCookie(url, customHeaders = {}) {
    // 第一步：动态获取最新Cookie
    const latestCookie = await getLatestCookie();

    // 第二步：检查Cookie是否获取成功
    if (!latestCookie) {
        // 如果获取Cookie失败，直接抛出异常，中断后续操作
        // App会捕获这个异常并提示用户检查网络或后端服务
        throw new Error('无法从后端服务获取有效Cookie，请求中止。');
    }

    // 第三步：使用从后端获取到的最新Cookie构建请求头
    const headers = {
        'User-Agent': UA,
        'Cookie': latestCookie, // 使用动态获取的Cookie
        ...customHeaders
    };
    log(`使用最新Cookie请求URL: ${url}`);
    return $fetch.get(url, { headers });
}


// ================== 核心实现 (此部分无需任何改动) ==================

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
        const searchHeaders = {
            'Referer': `${appConfig.site}/`,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };

        const { data: html } = await fetchWithCookie(url, searchHeaders);
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
