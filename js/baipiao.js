/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v3.0 (最终修复版)
 *
 * 版本历史:
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// 【v3.0 修正】使用您提供的、在搜索时捕获的完整Cookie字符串
const FULL_COOKIE = 'PHPSESSID=98sro02gntq5qqis734ik8hi07; _ok4_=Kx0heu4m9F05IybrnY0Su5Z/+8XD070kFSNNc3U60CbfDnwycM43lOWI53CID8HrUOTbfs6rVPpr9Ci4din5LbRuo71yd0W3vDWdqke6DiMGdVql+SH+NRXbsNuEFThm; beitouviews_5838=KX9OmCyAYuTWNn4uQ6ANjK8Ce5oqXXfdJv39G1aCFkEVfokPEar8iT%252BYb%252FXVqMhcoweHKTc1d3GfGMwcl3Bb20WdH%252BAbiNkWGuCP6uSyD8aXTerq%252FkCJrzOl2a%252BtaLp7Qei9n2CVUmn2h05gnPG3fLQe7VN4VqFdLvL94VQULPYJ9DQFB%252BLPCWNFk%252FbovqSDuKAFGSMqFcVEz%252B3US9vlTdHoY9SVGvD44KoHt9MdhZixDtltrq89XMBWJ%252F7zo0OlIGqRguGnxsrs%252BPcMwG4CF7OHrmEY6jLDGQBMOsyrFLmjNMVv5HCIA5FYzggeUgXbA4Oym5UEqlG3Mzzp%252FKX5TA%253D%253D; richviews_5839=BmcIxW4naNjRymCJYBQYN0Ghx8wFCcEInp8uCmSDRs2CN3NGVYl78JaG9aBsqYBXDg8bpCsD6P6E38lTcqYNoqpaomm5j4Hn%252BTjYsoX%252FuJcyhWEzD5qow4%252FDljjWTB7d5LmF3bvdmNrdBeS6zu2ULvyZKVpnUYBDFkBRP%252BcT%252Fi59jNaKP8vOGYmgKkqO1u2gIo6313AcXvR6YgQBkaN294r%252Bl83pOhnbLjVg6Wp7hZHtNRE2kzyFVC7zJI0bdlrEbl78A7XbrR9oD2Lff45d8%252Fr25nuJZ1yJ6bxQ5Qxq4gpLnIcVtNwsEs%252FgGZfG6fJ72oML%252BV79W3FbK1k%252FbHGSuQ%253D%253D;';

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

function log(msg ) { try { $log(`[七味网 v3.0] ${msg}`); } catch (_) { console.log(`[七味网 v3.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function fetchWithCookie(url, customHeaders = {}) {
    const headers = {
        'User-Agent': UA,
        'Cookie': FULL_COOKIE,
        ...customHeaders
    };
    log(`请求URL: ${url}`);
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
        // 【v3.0 修正】构造完整的、高仿真度的请求头
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
