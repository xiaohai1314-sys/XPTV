/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.0 (去 Cookie 实验版)
 *
 * 版本说明:
 * 这是一个实验性版本，旨在测试网站是否支持由 App 环境自动管理 Cookie。
 * 本版本移除了脚本中写死的 `FULL_COOKIE`，完全依赖 App 在 WebView 验证成功后，
 * 能自动为后续请求附加有效的 Cookie。
 *
 * 预期行为:
 * 1. 首次使用时，会触发 WebView 进行人机验证。
 * 2. 用户在 WebView 中验证成功后，返回 App 刷新或再次操作。
 * 3. 【关键】如果后续操作不再需要验证，则证明本方案成功。
 * 4. 如果后续操作仍然每次都需要验证，则证明网站服务器强制要求脚本提供显式的 Cookie，本方案失败。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【实验性移除】不再需要写死的 Cookie
// const FULL_COOKIE = '...'; 

const appConfig = {
    ver: 3.0,
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

function log(msg  ) { try { $log(`[七味网 v3.0 Exp] ${msg}`); } catch (_) { console.log(`[七味网 v3.0 Exp] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 【核心修改】此函数不再主动添加 Cookie，依赖 App 环境自动处理
async function fetchWithCookie(url, customHeaders = {}) {
    const headers = {
        'User-Agent': UA,
        // 'Cookie': FULL_COOKIE, // <-- 已移除此行
        ...customHeaders
    };
    log(`请求URL (无显式Cookie): ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 ==================

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// 【已修改】集成“点选文字”验证逻辑
async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const pagePath = page === 1 ? ext.id : ext.id.replace('.html', `-${page}.html`);
    const url = `${appConfig.site}${pagePath}`;

    try {
        const { data: html } = await fetchWithCookie(url);
        const $ = cheerio.load(html);

        if (html.includes('请依次点击：')) {
            log('🔍 检测到“点选文字”验证，准备调用 WebView...');
            $utils.openSafari(appConfig.site, UA); 
            return jsonify({ list: [] }); 
        }

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

        if (cards.length === 0 && !html.includes('没有找到相关影片')) {
            log('⚠️ 列表为空，可能需要验证，尝试触发 WebView');
            $utils.openSafari(appConfig.site, UA);
        }

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

// 【已修改】集成“输入数字”验证逻辑
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

        if (html.includes('请输入验证码：')) {
            log('🔍 检测到“输入数字”验证，准备调用 WebView...');
            $utils.openSafari(url, UA);
            return jsonify({ list: [] });
        }

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

        if (cards.length === 0 && !html.includes('没有找到相关影片')) {
            log('⚠️ 搜索结果为空，可能需要验证，尝试触发 WebView');
            $utils.openSafari(url, UA);
        }

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
