/**
 * 夸父资源前端插件 - V5.6 (去重优化版)
 *
 * 版本说明:
 * - 【V5.5 核心优化】基于 V5.4 版本，针对 `getTracks` 函数进行关键性修正。
 * - 【链接去重】在提取网盘链接时，增加了一个 Set 来存储已添加的链接，彻底解决了因页面结构问题（如一个链接包含文本和图片）导致相同链接被重复添加的 Bug。现在，即使网站上只有一个链接，App 端也只会显示一个条目。
 * - 【保留所有胜利果实】V5.4 中已实现的 Cookie 更新、多网盘支持（阿里/天翼/夸克）以及之前版本的所有优秀功能（完美回帖、强大搜索等）均完整保留。
 * - 【新增优化】在 getTracks 中增加对 'alipan.com' 格式阿里云盘链接的支持。
 */

// --- 配置区 ---
const SITE_URL = "https://suenen.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://suenen.com/view/img/favicon.png";

// ★★★★★ 最新有效Cookie (用户提供 ) ★★★★★
const COOKIE = 'bbs_sid=mt21hvqotqu78cl7h33ug63p1r; Hm_lvt_0a637cceb4c7e7eb54ed5c54bfc52234=1761539216; HMACCOUNT=4046F7D926357D93; bbs_token=BybmHjg4nUBBHrI6h099qtroItZJTMF8ug0n9DppL9WaUuM4; Hm_lpvt_0a637cceb4c7e7eb54ed5c54bfc52234=1761540595';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) {
    try {
        $log(`[夸父资源 去重优化版] ${msg}`);
    } catch (_) {
        console.log(`[夸父资源 去重优化版] ${msg}`);
    }
}
function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}
function jsonify(data) { return JSON.stringify(data); }
function getRandomReply() {
    const replies = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！", "不错的帖子点赞！", "感谢楼主，下载来看看"];
    return replies[Math.floor(Math.random() * replies.length)];
}

// ★★★★★【V5.3 核心修正：最终完美回帖引擎】★★★★★
async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await $fetch.post(replyUrl, formData, {
            headers: {
                'User-Agent': UA,
                'Cookie': COOKIE,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': SITE_URL,
                'Referer': `${SITE_URL}/thread-${threadId}.htm`
            }
        });
        
        if (data && data.includes(message)) {
            log(`回帖成功, 内容: "${message}"`);
            return true;
        } else {
            log(`回帖失败: 服务器返回内容异常。`);
            $utils.toastError("回帖失败：服务器返回异常", 3000);
            return false;
        }

    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        return false;
    }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (V5.5 去重优化版 - 增强阿里盘)");
    const CUSTOM_CATEGORIES = [
        { name: '电影区', ext: { id: 'forum-7.htm' } },
        { name: '剧集区', ext: { id: 'forum-10.htm' } },
        { name: '阿里', ext: { id: 'forum-3.htm' } },
        { name: '天翼', ext: { id: 'forum-1.htm' } },
        { name: '纪录片', ext: { id: 'forum-14.htm' } },
        { name: '音频区', ext: { id: 'forum-13.htm' } }
    ];
    return jsonify({
        ver: 1,
        title: '夸父资源',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http'  )) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${SITE_URL}/${id.replace('.htm', '')}-${page}.htm`;
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        const $ = cheerio.load(data);
        const cards = [];
        $("li.media.thread").each((_, item) => {
            const linkElement = $(item).find('.style3_subject a');
            cards.push({
                vod_id: linkElement.attr('href') || "",
                vod_name: linkElement.text().trim() || "",
                vod_pic: getCorrectPicUrl($(item).find("img.avatar-3").attr("src")),
                vod_remarks: $(item).find(".date.text-grey.hidden-sm").text().trim() || "",
                ext: { url: linkElement.attr('href') || "" }
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`获取分类列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V5.5 核心优化：增加链接去重逻辑 & 增强阿里盘支持】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);

    try {
        const { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        let $ = cheerio.load(data);

        const isContentHidden = $('.message[isfirst="1"]').text().includes("回复");
        if (isContentHidden) {
            log("内容被隐藏，启动回帖流程...");
            const threadId = url.match(/thread-(\d+)/)[1];
            await performReply(threadId);
        }

        const mainMessage = $('.message[isfirst="1"]');
        const tracks = [];
        const addedLinks = new Set(); // 用于存储已添加的链接，防止重复

        // 核心修改：在选择器中增加了 a[href*="alipan.com"]
        mainMessage.find('a[href*="pan.quark.cn"], a[href*="cloud.189.cn"], a[href*="aliyundrive.com"], a[href*="alipan.com"]').each((_, element) => {
            const link = $(element).attr('href');

            // 如果链接已经添加过，则跳过
            if (!link || addedLinks.has(link)) {
                return;
            }
            addedLinks.add(link); // 将新链接添加到Set中

            let panName = '未知网盘';
            if (link.includes('quark.cn')) {
                panName = '夸克网盘';
            } else if (link.includes('cloud.189.cn')) {
                panName = '天翼云盘';
            } else if (link.includes('aliyundrive.com') || link.includes('alipan.com')) { // 核心修改：在判断逻辑中增加了 alipan.com
                panName = '阿里云盘';
            }
            
            tracks.push({
                name: `${panName} ${tracks.filter(t => t.name.startsWith(panName)).length + 1}`,
                pan: link,
                ext: {},
            });
        });

        if (tracks.length === 0) {
            log("未找到有效资源链接。");
            if (isContentHidden) {
                tracks.push({ name: "内容已隐藏，后台自动回帖，请稍后刷新本页", pan: '', ext: {} });
            } else {
                tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
            }
        }

        return jsonify({ list: [{ title: '云盘', tracks }] });
    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ★★★★★【V5.1/V5.2 胜利果实：最强搜索逻辑】★★★★★
let searchCache = {
    keyword: '',
    page: 0,
    results: [],
    total: Infinity,
    pagecount: Infinity
};

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) return jsonify({ list: [] });

    if (text !== searchCache.keyword) {
        log(`新搜索关键词: "${text}", 重置缓存。`);
        searchCache = {
            keyword: text,
            page: 0,
            results: [],
            total: Infinity,
            pagecount: Infinity
        };
    }

    if (page > searchCache.pagecount) {
        log(`请求页码 ${page} 超出总页数 ${searchCache.pagecount}，搜索终止。`);
        return jsonify({ list: [] });
    }

    if (page <= searchCache.page) {
        log(`请求页码 ${page} 已在缓存中，直接返回。`);
        const pageSize = 20; // 假设每页20条
        return jsonify({ list: searchCache.results.slice((page - 1) * pageSize, page * pageSize) });
    }

    log(`正在搜索: "${text}", 请求第 ${page} 页...`);

    const encodedKeyword = encodeURIComponent(text);
    let url;
    if (page === 1) {
        url = `${SITE_URL}/search-${encodedKeyword}-1.htm`;
    } else {
        url = `${SITE_URL}/search-${encodedKeyword}-1-${page}.htm`;
    }
    log(`构建的请求URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        const $ = cheerio.load(data);

        if (searchCache.pagecount === Infinity) {
            let maxPage = 1;
            $('ul.pagination a.page-link').each((_, elem) => {
                const pageNum = parseInt($(elem).text().trim());
                if (!isNaN(pageNum) && pageNum > maxPage) {
                    maxPage = pageNum;
                }
            });
            searchCache.pagecount = maxPage;
            log(`侦察到总页数: ${searchCache.pagecount}`);
        }

        const cards = [];
        $("li.media.thread").each((_, item) => {
            const linkElement = $(item).find('.style3_subject a');
            cards.push({
                vod_id: linkElement.attr('href') || "",
                vod_name: linkElement.text().trim() || "",
                vod_pic: getCorrectPicUrl($(item).find("img.avatar-3").attr("src")),
                vod_remarks: $(item).find(".date.text-grey.hidden-sm").text().trim() || "",
                ext: { url: linkElement.attr('href') || "" }
            });
        });

        if (cards.length === 0 && page > 1) {
            log(`第 ${page} 页没有返回结果，强制设置总页数为 ${page - 1}`);
            searchCache.pagecount = page - 1;
            return jsonify({ list: [] });
        }

        searchCache.results = searchCache.results.concat(cards);
        searchCache.page = page;
        searchCache.total = searchCache.results.length;

        log(`第 ${page} 页搜索成功，新增 ${cards.length} 条，当前缓存总数 ${searchCache.total}`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id: id, page: pg });
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('夸父资源插件加载完成 (V5.5 去重优化版 - 增强阿里盘)');
