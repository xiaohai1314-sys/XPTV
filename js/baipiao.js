/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v4.0 (后端验证版)
 *
 * 版本历史:
 * v4.0: 【架构升级】引入后端服务处理验证码，前端只负责请求和解析。
 * v3.0: 【终极修复】为搜索功能配备了完整的、从真实浏览器捕获的请求头。
 */

// ================== 🔴 配置区 (请根据您的实际情况修改) 🔴 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ★ 改造点: 定义您的后端服务地址
const BACKEND_API_URL = 'http://192.168.1.7:8000/get-search-html'; // ★ 请将 localhost 替换为您后端服务器的IP地址

// --- appConfig 保持与 v3.0 100% 一致 ---
const appConfig = {
    ver: 4.0, // ★ 改造点: 更新版本号
    title: '七味网(纯盘 )',
    site: 'https://www.qwmkv.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (大部分保持不变 ) ==================

function log(msg) { try { $log(`[七味网 v4.0] ${msg}`); } catch (_) { console.log(`[七味网 v4.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★ 改造点: 原始的 fetchWithCookie 不再需要，因为Cookie管理已移至后端
// 我们保留一个简单的 fetch 函数用于分类页，它不经过后端
async function fetchOriginalSite(url) {
    const headers = { 'User-Agent': UA };
    log(`直连请求URL: ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 (getCards保持原样, search被改造) ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// getCards 函数保持原样，因为它访问的页面通常不需要验证
async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
    const url = `${appConfig.site}${pagePath}`;

    try {
        // ★ 改造点: 使用新的直连函数
        const { data: html } = await fetchOriginalSite(url);
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

// getTracks 和 getPlayinfo 函数保持 100% 不变
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    try {
        const { data: html } = await fetchOriginalSite(url); // ★ 改造点: 使用新的直连函数
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


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★ 改造重点: search 函数
// ★ 它不再直接请求目标网站，而是请求我们的后端服务来获取HTML
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function search(ext) {
    ext = argsify(ext);
    const encodedText = encodeURIComponent(ext.text);
    const targetSearchUrl = `${appConfig.site}/vs/-------------.html?wd=${encodedText}`;

    try {
        log(`正在通过后端服务请求URL: ${targetSearchUrl}`);
        
        // 1. 调用我们自己的后端服务
        const response = await $fetch.post(BACKEND_API_URL, {
            search_url: targetSearchUrl // 将目标URL作为参数发给后端
        });

        // 2. 后端直接返回了最终的HTML字符串
        const html = response.data;

        // 3. 【无缝衔接】后续的解析逻辑与 v3.0 完全一样！
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
        // ★ 改造点: 可以向用户显示更友好的后端错误信息
        const errorMessage = e.response ? e.response.data : e.message;
        $toast(`搜索失败: ${errorMessage}`);
        return jsonify({ list: [] });
    }
}
