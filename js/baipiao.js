/**
 * 七味网(qwmkv.com) - 纯网盘提取脚本 - v6.2 (最终稳定版)
 *
 * 版本历史:
 * v6.2: 【最终修正】增加JSON.parse()，正确处理后端返回的JSON字符串。
 * v6.1: (废弃)
 * v6.0: 【精准控制】适配后端分页预判API。
 * v5.0: 【智能分页】实现前端分页逻辑。
 * v4.0: 【架构升级】引入后端服务处理验证码，前端只负责请求和解析。
 */

// ================== 🔴 配置区 🔴 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
// ★★★ 请务必将这里的IP地址修改为您后端服务器的实际IP地址 ★★★
// 例如：如果您后端运行在IP为 192.168.1.100 的机器上，这里就写 'http://192.168.1.100:8000/get-search-html'
const BACKEND_API_URL = 'http://192.168.1.7:8000/get-search-html'; 

const appConfig = {
    ver: 6.2, // 版本号更新
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
// 用于App内部日志输出 ，如果App环境不支持$log，会降级到console.log
function log(msg) { try { $log(`[七味网 v${appConfig.ver}] ${msg}`); } catch (_) { console.log(`[七味网 v${appConfig.ver}] ${msg}`); } }
// 解析扩展参数，确保ext始终是对象
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
// 将数据转换为JSON字符串
function jsonify(data) { return JSON.stringify(data); }

// 直连请求原始网站的函数（用于分类页和详情页，不经过后端代理）
async function fetchOriginalSite(url) {
    const headers = { 'User-Agent': UA };
    log(`直连请求URL: ${url}`);
    return $fetch.get(url, { headers });
}

// ================== 核心实现 ==================
// App初始化函数
async function init(ext) { return jsonify({}); }
// 获取App配置（如分类tab）
async function getConfig() { return jsonify(appConfig); }

// 获取分类卡片列表（例如电影、剧集等）
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
        // 返回列表和分页信息，pagecount用于App判断是否还有下一页
        return jsonify({ list: cards, page: page, pagecount: page + (cards.length > 0 ? 1 : 0) });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 获取影片详情和网盘链接
async function getTracks(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}${ext.url}`;
    try {
        const { data: html } = await fetchOriginalSite(url);
        const $ = cheerio.load(html);
        const vod_name = $('div.main-ui-meta h1').text().replace(/\(\d+\)$/, '').trim();
        const tracks = [];
        const panDownloadArea = $('h2:contains("网盘下载")').parent();
        if (panDownloadArea.length === 0) return jsonify({ list: [] }); // 如果没有网盘下载区，直接返回空列表
        
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
                // 提取清晰度、格式等信息
                const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|[\d\.]+G[B]?)/ig);
                if (specMatch) {
                    spec = [...new Set(specMatch.map(s => s.toUpperCase()))].join(' ').replace(/\s+/g, ' ');
                }
                const trackName = spec ? `${vod_name} (${spec})` : `${vod_name} (${originalTitle.substring(0, 25)}...)`;
                let pwd = '';
                // 提取提取码
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

// 获取播放信息（实际是返回网盘链接和提取码）
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
// ★ 核心搜索函数: 通过后端代理进行搜索，并处理验证码和分页
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text;
    // 确保页码从1开始，如果App没有提供或提供0，则默认为1
    const page = (ext.page && ext.page > 0) ? ext.page : 1;
    
    // ★ 关于“返回重新搜索”问题的说明 ★
    // 这个问题需要App层面的状态管理来解决。
    // 当用户从详情页返回搜索列表页时，App不应该重新初始化搜索，
    // 而应该使用之前保存的搜索关键词和当前页码，重新调用此 `search` 函数。
    // 例如，App可以在页面跳转前保存 { keyword: "xxx", page: N }，
    // 返回时，如果检测到这些状态存在，就用它们来调用 search( { text: "xxx", page: N } )。
    
    log(`开始搜索: "${keyword}", 请求页码: ${page}`);

    // 构造目标搜索URL
    const encodedKeyword = encodeURIComponent(keyword);
    const targetSearchUrl = `${appConfig.site}/vs/${encodedKeyword}----------${page}---.html`;

    try {
        log(`正在通过后端服务请求URL: ${targetSearchUrl}`);
        
        // 调用我们自己的后端服务，后端会处理Puppeteer和验证码
        const response = await $fetch.post(BACKEND_API_URL, 
            { search_url: targetSearchUrl },
            { headers: { 'Content-Type': 'application/json' } } // 明确告知后端我们发送的是JSON
        );

        // ★ 关键修正点：解析后端返回的JSON字符串
        // 假设 response.data 是一个JSON字符串，需要手动解析
        let resultData;
        try {
            resultData = JSON.parse(response.data);
        } catch (parseError) {
            // 如果解析失败，可能是 response.data 本身就是对象了，或者格式不对
            log(`JSON.parse 失败，尝试直接使用 response.data: ${parseError.message}`);
            resultData = response.data; // 尝试直接使用，兼容某些App环境自动解析JSON的情况
        }

        // 检查后端返回的数据结构是否正确
        if (!resultData || typeof resultData !== 'object' || !resultData.html || !resultData.paginationInfo) {
            throw new Error("后端返回的数据格式不正确或缺少关键字段 (html/paginationInfo)。");
        }

        const html = resultData.html;
        const paginationInfo = resultData.paginationInfo;

        // 使用cheerio解析HTML，提取搜索结果卡片
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

        // 根据后端提供的分页信息，决定是否还有更多数据
        let hasMore = paginationInfo ? paginationInfo.hasMore : false;
        
        // 返回给App的数据结构，pagecount用于App判断是否可以继续加载下一页
        return jsonify({
            list: cards,
            page: paginationInfo.currentPage,
            // 如果后端明确告知没有更多了 (hasMore: false)，则将 pagecount 设为当前页，
            // 这样App就不会再请求下一页了，实现了“精准控制”。
            // 否则，pagecount 设为当前页+1，表示还有下一页。
            pagecount: paginationInfo.currentPage + (hasMore ? 1 : 0)
        });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        // 尝试从错误响应中提取更详细的信息
        const errorMessage = e.response && e.response.data && (e.response.data.error || JSON.stringify(e.response.data)) ? 
                             (e.response.data.error || JSON.stringify(e.response.data)) : e.message;
        $toast(`搜索失败: ${errorMessage}`); // 在App界面显示错误提示
        return jsonify({ list: [] }); // 返回空列表
    }
}
