/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.3 (绝对忠于原版)
 *
 * 版本说明:
 * 100% 基于用户提供的、可成功运转的 v3.0 脚本进行修改。
 * 唯一的改动是将写死的 Cookie 替换为从后端动态获取。
 * 所有核心函数 (getCards, getTracks, search 等) 的逻辑与原版一字不差。
 */

// ================== 配置区 (来自您的 v3.0) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ★★★【唯一修改点 1/2】: 后端服务器地址 ★★★
const COOKIE_SERVER_URL = 'http://192.168.1.7:3000/getCookie';

const appConfig = {
    ver: 3.3, // 版本号更新以区分
    title: '七味网(纯盘 )',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (来自您的 v3.0 ) ==================
function log(msg ) { try { $log(`[七味网 v3.3] ${msg}`); } catch (_) { console.log(`[七味网 v3.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★【唯一修改点 2/2】: 实现动态获取Cookie的 fetchWithCookie 函数 ★★★
let cachedCookie = null;
async function fetchWithCookie(url, customHeaders = {}) {
    // 为了确保每次操作都能通过验证，强制刷新Cookie
    cachedCookie = null; 
    
    if (!cachedCookie) {
        try {
            log('正在从后端获取最新Cookie...');
            const response = await $fetch.get(COOKIE_SERVER_URL);
            if (response.status === 'success' && response.cookie) {
                cachedCookie = response.cookie;
                log('✅ 成功获取并缓存了Cookie！');
            } else {
                throw new Error('后端未返回有效的Cookie');
            }
        } catch (e) {
            log(`❌ 获取Cookie失败: ${e.message}`);
            throw new Error(`无法从后端获取Cookie: ${e.message}`);
        }
    }

    const headers = {
        'User-Agent': UA,
        'Cookie': cachedCookie, // 使用从后端获取的动态Cookie
        ...customHeaders
    };
    log(`请求URL: ${url}`);
    return $fetch.get(url, { headers });
}


// ================== 核心实现 (100% 复制于您的 v3.0 脚本) ==================

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
