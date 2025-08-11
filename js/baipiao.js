/**
 * 七味网(qwmkv.com) - 黄金Cookie协同最终版 - v3.6
 * 策略：所有浏览功能使用内置的黄金Cookie，仅搜索功能调用专用后端。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ★★★ 后端服务器地址 ★★★
const SEARCH_BACKEND_URL = 'http://localhost:3000/search';

// ★★★ 黄金Cookie ★★★
// 这个Cookie在正常网络环境下 ，足以完成所有浏览操作。
const GOLDEN_COOKIE = 'PHPSESSID=98sro02gntq5qqis734ik8hi07;_ok4_=S+QRLrRVriPoSXvR5iQrtTRzlpWmtdEn9ZqGlYwlya/Cid74Avtf4A/rNbLYdOMo1rNf4WCt1x4hqsB0q3RuXtnqHzESYg+yGls6XcU46TwB9QMB3tttVwGKbSJ1Gsx';

const appConfig = {
    ver: '3.6-最终版',
    title: '七味网(最终版)',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================
function log(msg ) { try { $log(`[七味网 v3.6] ${msg}`); } catch (_) { console.log(`[七味网 v3.6] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 网络核心 (双轨制) ==================
async function fetchForBrowse(url, customHeaders = {}) {
    const headers = { 'User-Agent': UA, 'Cookie': GOLDEN_COOKIE, ...customHeaders };
    log(`(浏览模式) 请求URL: ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 ==================
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
    const url = `${appConfig.site}${pagePath}`;
    try {
        const { data: html } = await fetchForBrowse(url);
        const $ = cheerio.load(html);
        const cards = [];
        $('ul.content-list > li').each((_, element) => {
            const $li = $(element);
            const vod_id = $li.find('a').first().attr('href');
            const vod_name = $li.find('h3 > a').attr('title');
            const vod_pic = $li.find('div.li-img img').attr('src');
            const vod_remarks = $li.find('span.bottom2').text().trim();
            if (vod_id && vod_name) cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
        });
        return jsonify({ list: cards });
    } catch (e) { log(`❌ 获取卡片列表异常: ${e.message}`); return jsonify({ list: [] }); }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    try {
        const { data: html } = await fetchForBrowse(url, { 'Referer': appConfig.site });
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
                if (specMatch) spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
                const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;
                let pwd = '';
                const pwdMatch = linkUrl.match(/pwd=(\w+)/) || originalTitle.match(/(?:提取码|访问码)[：: ]\s*(\w+)/i);
                if (pwdMatch) pwd = pwdMatch[1];
                groupTracks.push({ name: trackName, pan: linkUrl, ext: { pwd: pwd } });
            });
            if (groupTracks.length > 0) tracks.push({ title: panType, tracks: groupTracks });
        });
        return jsonify({ list: tracks });
    } catch (e) { log(`❌ 获取详情数据异常: ${e.message}`); return jsonify({ list: [] }); }
}

async function search(ext) {
    ext = argsify(ext);
    const encodedText = encodeURIComponent(ext.text);
    const backendUrl = `${SEARCH_BACKEND_URL}?keyword=${encodedText}`;
    log(`正在调用后端进行搜索: ${backendUrl}`);
    try {
        const { data: html } = await $fetch.get(backendUrl);
        const $ = cheerio.load(html);
        const cards = [];
        $('div.sr_lists dl').each((_, element) => {
            const $dl = $(element);
            const vod_id = $dl.find('dt a').attr('href');
            const vod_name = $dl.find('dd p strong a').text();
            const vod_pic = $dl.find('dt a img').attr('src');
            const vod_remarks = $dl.find('dd p span.ss1').text().trim();
            if (vod_id && vod_name) cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
        });
        return jsonify({ list: cards });
    } catch (e) { log(`❌ 调用后端搜索异常: ${e.message}`); return jsonify({ list: [] }); }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    const password = ext.pwd;
    let finalUrl = panLink;
    if (password) finalUrl += `\n提取码: ${password}`;
    return jsonify({ urls: [finalUrl] });
}
