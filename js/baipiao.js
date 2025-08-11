/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.4 (最终修正版)
 *
 * 版本说明:
 * - [UI修正] 修正了 getConfig 函数，确保分类列表能被立即、正确地加载，解决白屏问题。
 * - [性能优化] 优化了 fetchWithCookie 函数，采用“失败后刷新”策略，避免对后端造成频繁请求。
 * - [后端协同] 脚本现在完全依赖后端提供一个包含 PHPSESSID 和 _ok4_ 的完整Cookie。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

const COOKIE_SERVER_URL = 'http://192.168.1.7:3000/getCookie'; // 您的后端地址

const appConfig = {
    ver: '3.4-final', // 更新版本号
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
function log(msg ) { try { $log(`[七味网 v3.4] ${msg}`); } catch (_) { console.log(`[七味网 v3.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ================== 网络核心 (已优化) ==================
let cachedCookie = null;

async function fetchWithCookie(url, customHeaders = {}) {
    // 1. 如果没有缓存的Cookie，则先获取一次
    if (!cachedCookie) {
        try {
            log('缓存为空，首次从后端获取Cookie...');
            const response = await $fetch.get(COOKIE_SERVER_URL);
            if (response.status === 'success' && response.cookie && response.cookie.includes('PHPSESSID') && response.cookie.includes('_ok4_')) {
                cachedCookie = response.cookie;
                log('✅ 成功获取并缓存了有效Cookie！');
            } else {
                throw new Error('后端未返回有效的组合Cookie');
            }
        } catch (e) {
            log(`❌ 首次获取Cookie失败: ${e.message}`);
            throw e;
        }
    }

    const headers = { 'User-Agent': UA, 'Cookie': cachedCookie, ...customHeaders };
    
    try {
        // 2. 使用当前缓存的Cookie发起请求
        log(`尝试使用缓存Cookie请求: ${url}`);
        return await $fetch.get(url, { headers });
    } catch (requestError) {
        // 3. 如果请求失败（可能是Cookie失效），则强制刷新Cookie并重试一次
        log(`⚠️ 请求失败: ${requestError.message}。尝试强制刷新Cookie并重试...`);
        cachedCookie = null; // 清空旧缓存
        try {
            const response = await $fetch.get(COOKIE_SERVER_URL);
            if (response.status === 'success' && response.cookie && response.cookie.includes('PHPSESSID') && response.cookie.includes('_ok4_')) {
                cachedCookie = response.cookie;
                log('✅ 成功刷新并缓存了有效Cookie！');
                const newHeaders = { ...headers, 'Cookie': cachedCookie };
                log(`重试请求: ${url}`);
                return await $fetch.get(url, { headers: newHeaders });
            } else {
                throw new Error('后端刷新时未返回有效的组合Cookie');
            }
        } catch (refreshError) {
            log(`❌ 强制刷新Cookie并重试均失败: ${refreshError.message}`);
            throw refreshError;
        }
    }
}

// ================== 核心实现 (已修正) ==================

async function init(ext) { return jsonify({}); }

// ★★★【关键修正 1/2】: 直接返回配置，解决UI白屏问题 ★★★
async function getConfig() {
    log('正在提供应用配置...');
    return jsonify(appConfig);
}

// ★★★【关键修正 2/2】: 所有网络功能现在都依赖于优化后的 fetchWithCookie ★★★
// getCards, getTracks, search, getPlayinfo 函数与您的 v3.3 完全相同，
// 它们会自动使用我们上面定义的新的、更智能的 fetchWithCookie 函数。
// (此处省略重复代码，您无需改动这些函数)
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
