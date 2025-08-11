// app.js - 【【【 v3.7 - UI/网络隔离最终版 】】】
// 策略：在所有网络请求函数外层增加最强健的try...catch，确保任何网络失败都不会影响UI渲染。

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 后端服务器地址
const COOKIE_SERVER_URL = 'http://192.168.1.7:3000/getCookie';

const appConfig = {
    ver: 3.7,
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
function log(msg ) { try { $log(`[七味网 v3.7] ${msg}`); } catch (_) { console.log(`[七味网 v3.7] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 核心网络函数 (与后端交互) ==================
let cachedCookie = null;
async function fetchWithCookie(url, customHeaders = {}) {
    // 每次都强制刷新Cookie，确保拿到最新的
    try {
        log('正在从后端获取最新Cookie...');
        const response = await $fetch.get(COOKIE_SERVER_URL, { timeout: 5000 }); // 增加5秒超时
        if (response.status === 'success' && response.cookie) {
            cachedCookie = response.cookie;
            log('✅ 成功获取并缓存了Cookie！');
        } else {
            throw new Error('后端未返回有效的Cookie');
        }
    } catch (e) {
        log(`❌ 获取Cookie失败: ${e.message}`);
        // ★★★ 关键：即使获取失败，也不让整个App崩溃，而是抛出一个可被捕获的错误
        throw new Error(`无法从后端获取Cookie: ${e.message}`);
    }

    const headers = { 'User-Agent': UA, 'Cookie': cachedCookie, ...customHeaders };
    log(`请求URL: ${url}`);
    // 这里如果请求失败，错误会自然抛出，由调用方(getCards等)的try...catch处理
    return $fetch.get(url, { headers });
}

// ================== 核心实现 (增加终极防崩溃保护) ==================

// UI渲染函数，保持绝对纯净
async function getConfig() {
    return jsonify(appConfig);
}

// 初始化函数，同样保持纯净
async function init(ext) {
    return jsonify({});
}

// --- 所有与网络相关的函数，都用try...catch包裹 ---

async function getCards(ext) {
    // ★★★ 终极防崩溃保护 ★★★
    try {
        ext = argsify(ext);
        const page = ext.page || 1;
        const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
        const url = `${appConfig.site}${pagePath}`;

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
        // ★★★ 关键：即使彻底失败，也只返回空列表，绝不让App崩溃
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    // ★★★ 终极防崩溃保护 ★★★
    try {
        ext = argsify(ext);
        const url = `${appConfig.site}${ext.url}`;
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
    // ★★★ 终极防崩溃保护 ★★★
    try {
        ext = argsify(ext);
        const encodedText = encodeURIComponent(ext.text);
        const url = `${appConfig.site}/vs/-------------.html?wd=${encodedText}`;
        const { data: html } = await fetchWithCookie(url, { 'Referer': `${app.site}/` });
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
