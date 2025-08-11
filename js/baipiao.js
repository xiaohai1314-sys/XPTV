/**
 * 七味网(qwmkv.com) - 前后端分离脚本 - v4.2 (懒加载注入版)
 *
 * 设计原则:
 * 1.  【UI优先】: getConfig同步返回，保证分类列表永远优先显示，绝不卡顿或白板。
 * 2.  【懒加载】: 只在用户第一次发起需要Cookie的请求时，才从后端获取Cookie。
 * 3.  【全局缓存】: Cookie一次获取，全局共享，避免重复请求。
 * 4.  【优雅降级】: 即使后端服务异常，也只影响数据加载，不影响App框架。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ★ 指向您的后端服务器地址和端口
const BACKEND_URL = 'http://192.168.1.7:3000'; 

// ★ 全局变量 ，用于缓存从后端获取的、唯一的Cookie
let GLOBAL_COOKIE = null; // 初始为null，表示尚未获取

const appConfig = {
    ver: 4.2,
    title: '七味网(后端版)',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 ==================

function log(msg  ) { try { $log(`[七味网 v4.2] ${msg}`); } catch (_) { console.log(`[七味网 v4.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

/**
 * ★ 核心辅助函数：获取并缓存Cookie
 * 这是整个“懒加载”模式的核心。
 */
async function ensureCookie() {
    // 如果已经获取过Cookie，直接返回缓存的
    if (GLOBAL_COOKIE !== null) {
        log('使用已缓存的Cookie');
        return GLOBAL_COOKIE;
    }

    // 如果是第一次调用，则从后端获取
    log('首次请求，正在从后端获取Cookie...');
    try {
        const response = await $fetch.get(`${BACKEND_URL}/getCookie`);
        const data = JSON.parse(response.data);
        if (data.status === 'success' && data.cookie) {
            GLOBAL_COOKIE = data.cookie; // 成功获取后，存入全局变量
            log('✅ 成功从后端获取并缓存了Cookie。');
            return GLOBAL_COOKIE;
        } else {
            throw new Error('后端未返回有效的Cookie。');
        }
    } catch (e) {
        log(`❌ 获取Cookie失败: ${e.message}`);
        GLOBAL_COOKIE = ''; // 设置为空字符串，避免下次重复请求
        return ''; // 返回空字符串，本次请求会失败，但不会阻塞程序
    }
}

// ================== 核心实现 ==================

// --- init 和 getConfig 保持最简，确保UI稳定 ---
async function init(ext) { 
    // 清空缓存，以便每次重启App都能重新获取最新的Cookie
    GLOBAL_COOKIE = null;
    return jsonify({}); 
}

async function getConfig() {
    // 直接、同步返回配置，保证分类列表100%显示
    return jsonify(appConfig); 
}


// --- getCards, getTracks, search 函数改造 ---
// 它们现在都需要在请求前，调用 ensureCookie() 来确保身份已就绪

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
    const url = `${appConfig.site}${pagePath}`;

    try {
        const cookie = await ensureCookie(); // ★ 在发起请求前，确保Cookie已就绪
        if (!cookie) throw new Error("无法获取有效Cookie，请求中止。");

        const { data: html } = await $fetch.get(url, { 
            headers: { 'User-Agent': UA, 'Cookie': cookie } 
        });

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
        const cookie = await ensureCookie(); // ★ 在发起请求前，确保Cookie已就绪
        if (!cookie) throw new Error("无法获取有效Cookie，请求中止。");

        const { data: html } = await $fetch.get(url, { 
            headers: { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site } 
        });
        
        // ...后续的解析逻辑与v3.0完全一致，此处省略以保持简洁...
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
        const cookie = await ensureCookie(); // ★ 在发起请求前，确保Cookie已就绪
        if (!cookie) throw new Error("无法获取有效Cookie，请求中止。");

        const searchHeaders = {
            'User-Agent': UA,
            'Cookie': cookie,
            'Referer': `${appConfig.site}/`,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        };

        const { data: html } = await $fetch.get(url, { headers: searchHeaders });
        
        // ...后续的解析逻辑与v3.0完全一致，此处省略以保持简洁...
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

// --- getPlayinfo 保持不变 ---
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
