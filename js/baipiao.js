/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v11.4 (最终修复版)
 *
 * 版本历史:
 * v11.4: 【最终修复版】重大失误修复！恢复了被意外删除的 appConfig.tabs 配置，解决了首页分类丢失的根本问题。
 * v11.3: 【分类Tab修复版】重大修复！恢复 'pan' 字段为分类Tab专用，为网盘链接创建新字段 'pan_url'，彻底解决分类丢失问题。
 * v11.2: 【稳定修复版】修复因处理在线播放逻辑时，意外破坏网盘解析逻辑导致分类丢失的严重BUG。
 * v11.1: 【在线播放增强版】增加在线播放线路的提取，并重构getPlayinfo以兼容两种链接类型。
 * v11.0: 【终极安全版】以v5.0为基石，仅替换search函数，与v11.0后端完美配合。
 */

// ================== 🔴 配置区 (已恢复tabs配置) 🔴 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
// ★★★ 请务必将这里的IP地址修改为您后端服务器的实际IP地址 ★★★
const BACKEND_API_URL = 'http://192.168.10.111:8000/get-search-html'; // ★ 请修改为您的后端IP

const appConfig = {
    ver: 11.4, // 版本号更新
    title: '七味网(纯盘 )',
    site: 'https://www.qnmp4.com',
    // ★★★ 关键修复：恢复被意外删除的 tabs 数组 ★★★
    tabs: [
        { name: '电影', ext: { id: '/vt/1.html' } },
        { name: '剧集', ext: { id: '/vt/2.html' } },
        { name: '综艺', ext: { id: '/vt/3.html' } },
        { name: '动漫', ext: { id: '/vt/4.html' } },
    ],
};

// ================== 辅助函数 (与v5.0完全一致  ，神圣不可侵犯) ==================
function log(msg ) { try { $log(`[七味网 v11.4] ${msg}`); } catch (_) { console.log(`[七味网 v11.4] ${msg}`); } }
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

        // 1. 提取在线播放线路
        const onlinePlayArea = $('#url');
        if (onlinePlayArea.length > 0) {
            const playSources = [];
            onlinePlayArea.find('.py-tabs li').each((_, el) => {
                playSources.push($(el).clone().find('div').remove().end().text().trim());
            });

            onlinePlayArea.find('.bd > ul.player').each((index, ul) => {
                const sourceName = playSources[index] || `在线线路${index + 1}`;
                const groupTracks = [];
                $(ul).find('li a').each((_, a) => {
                    const trackName = $(a).text().trim();
                    const trackUrl = $(a).attr('href');
                    if (trackName && trackUrl) {
                        groupTracks.push({ 
                            name: trackName, 
                            ext: { online_play_url: trackUrl } 
                        });
                    }
                });
                if (groupTracks.length > 0) {
                    tracks.push({ title: sourceName, tracks: groupTracks });
                }
            });
        }

        // 2. 提取网盘下载链接 (使用原始脚本的健壮逻辑)
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
                    
                    // 您的原始逻辑：使用 pan 和 ext.pwd
                    groupTracks.push({ name: trackName, pan: linkUrl, ext: { pwd: pwd } });
                });
                if (groupTracks.length > 0) {
                    tracks.push({ title: panType, tracks: groupTracks });
                }
            });
        }

        return jsonify({ list: tracks });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);

    // 1. 处理在线播放链接
    if (ext.online_play_url) {
        log(`处理在线播放链接: ${ext.online_play_url}`);
        const finalUrl = `${appConfig.site}${ext.online_play_url}`;
        return jsonify({ urls: [finalUrl] });
    }
    
    // 2. 处理网盘链接 (恢复使用 pan 和 ext.pwd)
    if (ext.pan) {
        log(`处理网盘链接: ${ext.pan}`);
        const panLink = ext.pan;
        const password = ext.pwd;
        let finalUrl = panLink;
        if (password) {
            finalUrl += `\n提取码: ${password}`;
        }
        return jsonify({ urls: [finalUrl] });
    }

    log("❌ getPlayinfo调用错误: ext中未找到 'online_play_url' 或 'pan' 字段");
    return jsonify({ urls: [] });
}

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
            { 
                search_url: targetSearchUrl,
                requested_page: page 
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        let resultData;
        try {
            resultData = JSON.parse(response.data);
        } catch (parseError) {
            log(`JSON.parse 失败，尝试直接使用 response.data: ${parseError.message}`);
            resultData = response.data;
        }

        if (!resultData || typeof resultData !== 'object' || !resultData.html || !resultData.paginationInfo) {
            if (resultData && resultData.error) {
                 throw new Error(`后端返回错误: ${resultData.error}`);
            }
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
        const errorMessage = e.response && e.response.data && (e.response.data.error || JSON.stringify(e.response.data)) ? 
                             (e.response.data.error || JSON.stringify(e.response.data)) : e.message;
        $toast(`搜索失败: ${errorMessage}`);
        return jsonify({ list: [] });
    }
}
