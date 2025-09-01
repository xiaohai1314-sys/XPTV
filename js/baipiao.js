/**
 * 七味网(qwmkv.com) - 网盘+在线播放提取脚本 - v11.1
 *
 * 基于 v11.0 (终极安全版) 修改：
 * - 保持所有配置、网盘逻辑完全不变
 * - 新增“在线播放”分组提取，app 将自动显示【在线】tab
 */

const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
// ★★★ 修改为您后端服务器的实际IP ★★★
const BACKEND_API_URL = 'http://192.168.10.111:8000/get-search-html';

const appConfig = {
    ver: 11.1,
    title: '七味网(网盘+在线)',
    site: 'https://www.qnmp4.com',
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 公共函数 ==================
function log(msg ) { try { $log(`[七味网 v11.1] ${msg}`); } catch (_) { console.log(`[七味网 v11.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
async function fetchOriginalSite(url) {
    const headers = { 'User-Agent': UA };
    log(`直连请求URL: ${url}`);
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
        return jsonify({ list: cards, page: page, pagecount: page + (cards.length > 0 ? 1 : 0) });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    try {
        const { data: html } = await fetchOriginalSite(url);
        const $ = cheerio.load(html);
        const vod_name = $('div.main-ui-meta h1').text().replace(/\(\d+\)$/, '').trim();
        const tracks = [];

        // =============== ① 先处理网盘下载 (原逻辑保持不动) ===============
        const panDownloadArea = $('h2:contains("网盘下载")').parent();
        if (panDownloadArea.length > 0) {
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
                    groupTracks.push({ name: trackName, pan: linkUrl, ext: { pwd: pwd, type: 'pan' } });
                });
                if (groupTracks.length > 0) tracks.push({ title: panType, tracks: groupTracks });
            });
        }

        // =============== ② 新增在线播放提取 ===============
        const onlineArea = $('h2:contains("在线播放")').parent();
        if (onlineArea.length > 0) {
            const groupTracks = [];
            onlineArea.find('ul.player li a').each((_, a) => {
                const $a = $(a);
                const name = $a.text().trim();   // 第01集
                const playUrl = $a.attr('href'); // /py/xxx.html
                if (name && playUrl) {
                    groupTracks.push({ name, pan: playUrl, ext: { type: 'play' } });
                }
            });
            if (groupTracks.length > 0) {
                tracks.push({ title: '在线播放', tracks: groupTracks });
            }
        }

        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);

    // ① 网盘逻辑 (保持不动)
    if (ext.type === 'pan') {
        const panLink = ext.pan;
        const password = ext.pwd;
        let finalUrl = panLink;
        if (password) finalUrl += `\n提取码: ${password}`;
        return jsonify({ urls: [finalUrl] });
    }

    // ② 播放逻辑 (新增)
    if (ext.type === 'play') {
        const playPageUrl = `${appConfig.site}${ext.pan}`;
        try {
            const { data: html } = await fetchOriginalSite(playPageUrl);
            const $ = cheerio.load(html);

            // 假设视频 iframe 或 <video> 标签在 .player-box 内
            let playUrl = $('iframe').attr('src') || $('video source').attr('src');
            if (!playUrl) playUrl = playPageUrl; // 兜底：返回原页链接

            return jsonify({ urls: [playUrl] });
        } catch (e) {
            log(`❌ 解析在线播放失败: ${e.message}`);
            return jsonify({ urls: [] });
        }
    }

    // 默认返回空
    return jsonify({ urls: [] });
}

// ================== 搜索逻辑 (保持不动) ==================
async function search(ext) {
    ext = argsify(ext);

    if (!ext.text || ext.text.trim() === '') {
        log("检测到无关键词的搜索调用，返回安全空列表。");
        return jsonify({ list: [], page: 1, pagecount: 1 });
    }

    const keyword = ext.text;
    const page = (ext.page && ext.page > 0) ? ext.page : 1;
    
    log(`开始搜索: "${keyword}", 请求页码: ${page}`);

    const encodedKeyword = encodeURIComponent(keyword);
    const targetSearchUrl = `${appConfig.site}/vs/${encodedKeyword}----------${page}---.html`;

    try {
        log(`正在通过后端服务请求URL: ${targetSearchUrl}`);
        const response = await $fetch.post(BACKEND_API_URL, 
            { search_url: targetSearchUrl, requested_page: page },
            { headers: { 'Content-Type': 'application/json' } }
        );

        let resultData;
        try { resultData = JSON.parse(response.data); }
        catch (parseError) {
            log(`JSON.parse 失败，直接使用 response.data: ${parseError.message}`);
            resultData = response.data;
        }

        if (!resultData || typeof resultData !== 'object' || !resultData.html || !resultData.paginationInfo) {
            if (resultData && resultData.error) throw new Error(`后端返回错误: ${resultData.error}`);
            throw new Error("前端收到的数据格式不正确或缺少关键字段。");
        }

        const html = resultData.html;
        const paginationInfo = resultData.paginationInfo;

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
        
        log(`成功解析到 ${cards.length} 条数据。后端报告: 当前页${paginationInfo.currentPage}, 总页数${paginationInfo.totalPages}`);

        const hasMore = paginationInfo.hasMore;
        return jsonify({
            list: cards,
            page: paginationInfo.currentPage,
            pagecount: paginationInfo.currentPage + (hasMore ? 1 : 0)
        });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $toast(`搜索失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}
