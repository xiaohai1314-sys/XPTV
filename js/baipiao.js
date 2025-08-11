/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.7 (加载安全版)
 *
 * 修复说明:
 * 彻底修正了 V3.3 脚本在加载阶段就会因网络请求而崩溃的致命缺陷。
 * 确保了 `getConfig` 总能被成功调用，让分类按钮永远存在。
 * 列表内容的获取逻辑与 V3.3 保持一致。
 */

// ================== 配置区 (与V3.3完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const COOKIE_SERVER_URL = 'http://192.168.1.7:3000/getCookie';

const appConfig = {
    ver: 3.7,
    title: '七味网(加载安全版 )',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (与V3.3完全一致 ) ==================
function log(msg ) { try { $log(`[七味网 v3.7] ${msg}`); } catch (_) { console.log(`[七味网 v3.7] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★【核心修正】: 将网络请求逻辑安全地封装起来 ★★★
let cachedCookie = null;

// 1. 先定义一个安全的、不联网的函数，用于获取动态Cookie
async function getDynamicCookie() {
    try {
        log('正在从后端获取最新Cookie...');
        const response = await $fetch.get(COOKIE_SERVER_URL);
        if (response && response.cookie) {
            cachedCookie = response.cookie;
            log('✅ 成功获取并缓存了Cookie！');
            return true;
        }
        throw new Error('后端未返回有效的Cookie');
    } catch (e) {
        log(`❌ 获取Cookie失败: ${e.message}`);
        // 失败时不再抛出致命错误，而是返回 false
        return false;
    }
}

// 2. 然后定义 fetchWithCookie，它本身在加载时是安全的
async function fetchWithCookie(url, customHeaders = {}) {
    // 强制刷新Cookie的逻辑移到这里
    cachedCookie = null; 
    
    // 在这里，当函数被【调用】时，才真正执行网络请求
    const success = await getDynamicCookie();

    // 如果获取动态Cookie失败，则直接返回一个失败的Promise，让上层捕获
    if (!success) {
        return Promise.reject(new Error("无法从后端获取Cookie，请求中断"));
    }

    const headers = {
        'User-Agent': UA,
        'Cookie': cachedCookie,
        ...customHeaders
    };
    log(`请求URL: ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 (与V3.3完全一致) ==================
// init, getConfig, getCards, getTracks, search, getPlayinfo 保持原样

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
// ... 其他函数保持原样 ...
