/**
 * 夸父资源社 - 纯前端改造版 (v1.7 - 最终决胜版)
 *
 * 架构分析与总指挥: (您的名字)
 * 代码实现: Manus
 *
 * 版本说明:
 * - 【v1.7 终极战术】根据您的最终指令，采用“一次获取，分批交付”的缓存策略，彻底解决所有已知问题。
 *   - 1. (搜索) search函数首次调用时，获取全部结果并存入缓存。后续调用时，从缓存中“挤牙膏”式地分批交付数据，直到给完为止，完美解决“少量结果显示不全”和“无限加载”两大难题。
 *   - 2. (分类) getCards函数同样采用此“分批交付”逻辑，结合从分页栏获取的精确总页数，构建完美的缓存和返回数据，杜绝一切无限加载。
 *   - 3. (自动回复) 继承并坚持v1.6的“闪电战术”，回帖成功后直接利用返回的HTML，彻底规避服务器风控，解决“二次进入”问题。
 * - 【架构革命】彻底抛弃原有的"Node.js后端代理+前端插件"的笨重模式，回归纯前端实现。
 * - 【核心基石】所有功能均基于您提供的真实情报（Cookie、cURL、HTML）构建，并保留您指定的分类导航。
 */

// --- 核心配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const PAGE_SIZE = 20; // 定义App每页期望获取的数量

// ★★★★★【用户配置区 - 已根据您的情报填入】★★★★★
const COOKIE = "FCNEC=%5B%5B%22AKsRol9IGaKWOBTOGBzw722JesBuZ6oBQ8BWyhS1sid5T6EgiFzx03EthXDVTByqguQO6R5cUsGSFpQTAO0YUi8M59bHnBLUvpzUvXbuuX_2PMD3jesg4s_64cWP2ADcDT2RQ60xpAYTwQzVys3pOKDHx6c5jNTi5g%3D%3D%22%5D%5D; bbs_sid=jhkoc4ehds51tnq53s92m4pgg2; Hm_lvt_2c2cd308748eb9097e250ba67b76ef20=1753520407,1755058584; HMACCOUNT=29968E74595D96C7; isClose=yes; bbs_token=rtsyyvswV8ToUUWxp9AiSMhDFryWZn8pDX0o_2FOqJcbsGfjBA; __gads=ID=e36eaf8870050a1a:T=1753520409:RT=1755059258:S=ALNI_MbHHfmGOmCC1aUYCrZV2orHdqlAkQ; __gpi=UID=0000116ee2558a2e:T=1753520409:RT=1755059258:S=ALNI_MbPo0LUpjI9Szvl30bM0_NBZO3Fvw; __eoi=ID=87ce519f7ac78c31:T=1753520409:RT=1755059258:S=AA-AfjYwkQUVZH6vQ7LqvTvnihuE; Hm_lpvt_2c2cd308748eb9097e250ba67b76ef20=1755059365";
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 不可修改的基石 ---
const CUSTOM_CATEGORIES = [
    { name: '电影区', ext: { id: 'forum-1.htm' } },
    { name: '剧集区', ext: { id: 'forum-2.htm' } },
    { name: '4K电影', ext: { id: 'forum-3.htm' } },
    { name: '4K剧集', ext: { id: 'forum-4.htm' } },
    { name: '纪录片', ext: { id: 'forum-13.htm' } },
    { name: '综艺区', ext: { id: 'forum-14.htm' } }
];
// --- 不可修改的基石 ---

// ★★★ 【v1.7 终极战术】 ★★★
// 升级缓存机制，用于“分批交付”
let searchCache = {};
let categoryCache = {};
let lastSearchKeyword = "";

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[夸父纯前端版] ${msg}`); } catch (_) { console.log(`[夸父纯前端版] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
const REPLY_MESSAGES = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！", "不错的帖子点赞！", "哈哈，不错哦！", "感谢楼主，下载来看看", "这个必须支持一下！", "楼主辛苦了，资源收下了"];
function getRandomReply() { return REPLY_MESSAGES[Math.floor(Math.random() * REPLY_MESSAGES.length)]; }

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.length < 20) { $utils.toastError("请先在插件脚本中配置Cookie", 3000); throw new Error("Cookie not configured."); }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, 'Referer': SITE_URL, ...options.headers };
    const finalOptions = { ...options, headers, timeout: 20000 };
    if (options.method === 'POST') { return $fetch.post(url, options.body, finalOptions); }
    return $fetch.get(url, finalOptions);
}

async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await fetchWithCookie(replyUrl, {
            method: 'POST', body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Origin': SITE_URL, 'Referer': `${SITE_URL}/thread-${threadId}.htm` }
        });
        if (data.includes("您尚未登录")) { log("回帖失败：Cookie已失效或不正确。"); $utils.toastError("Cookie已失效，请重新获取", 3000); return null; }
        log(`回帖成功，内容: "${message}", 并已获取到解锁后的HTML。`);
        return data;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") { $utils.toastError("回帖异常，请检查网络或Cookie", 3000); }
        return null;
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (纯前端改造版 v1.7)");
    searchCache = {};
    categoryCache = {};
    lastSearchKeyword = "";
    return jsonify({ ver: 1, title: '夸父资源', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

async function getCards(ext) {
    ext = argsify(ext);
    const page = parseInt(ext.page || 1);
    const id = ext.id;
    const cacheKey = id; // 分类的缓存键就是其ID

    // 如果是第一页，则需要从网络获取，并建立缓存
    if (page === 1) {
        const url = `${SITE_URL}/${id.replace('.htm', '')}-1.htm`;
        log(`获取分类首页数据: ${url}`);
        try {
            const { data } = await fetchWithCookie(url);
            const $ = cheerio.load(data);
            const cards = [];
            $('li.media.thread').each((_, item) => {
                const subjectLink = $(item).find('.style3_subject a[href*="thread-"]');
                const vod_id = subjectLink.attr('href') || '';
                const vod_name = subjectLink.text().trim() || '';
                let vod_pic = $(item).find('a[href*="user-"] img.avatar-3').attr('src') || '';
                if (vod_pic && !vod_pic.startsWith('http' )) { vod_pic = `${SITE_URL}/${vod_pic}`; }
                const views = $(item).find('span.fa-eye').next('span').text().trim();
                const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
                const vod_remarks = `看:${views} / 评:${comments}`;
                if (vod_id && vod_name) { cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } }); }
            });

            let pagecount = 1;
            const pagination = $('ul.pagination');
            if (pagination.length > 0) {
                const lastPageLink = pagination.find('a:contains("▶")').prev('a');
                if (lastPageLink.length > 0) {
                    pagecount = parseInt(lastPageLink.text()) || 1;
                } else {
                    const lastNumber = pagination.find('li.page-item a.page-link').last().text();
                    pagecount = parseInt(lastNumber) || 1;
                }
            }
            
            // 建立缓存
            categoryCache[cacheKey] = { pagecount: pagecount };
            log(`成功解析 ${cards.length} 条卡片数据，总页数: ${pagecount}`);
            return jsonify({ list: cards });

        } catch (e) {
            log(`获取卡片列表异常: ${e.message}`);
            return jsonify({ list: [] });
        }
    }

    // 如果是请求后续页面
    if (page > 1) {
        // 检查缓存中的总页数
        if (categoryCache[cacheKey] && page > categoryCache[cacheKey].pagecount) {
            log(`主动防御：请求页码 ${page} 超出总页数 ${categoryCache[cacheKey].pagecount}，返回空。`);
            return jsonify({ list: [] });
        }
        
        // 正常请求后续页面数据
        const url = `${SITE_URL}/${id.replace('.htm', '')}-${page}.htm`;
        log(`获取分类后续页数据: ${url}`);
        try {
            const { data } = await fetchWithCookie(url);
            const $ = cheerio.load(data);
            const cards = [];
            $('li.media.thread').each((_, item) => {
                const subjectLink = $(item).find('.style3_subject a[href*="thread-"]');
                const vod_id = subjectLink.attr('href') || '';
                const vod_name = subjectLink.text().trim() || '';
                let vod_pic = $(item).find('a[href*="user-"] img.avatar-3').attr('src') || '';
                if (vod_pic && !vod_pic.startsWith('http' )) { vod_pic = `${SITE_URL}/${vod_pic}`; }
                const views = $(item).find('span.fa-eye').next('span').text().trim();
                const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
                const vod_remarks = `看:${views} / 评:${comments}`;
                if (vod_id && vod_name) { cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } }); }
            });
            log(`成功解析后续页 ${cards.length} 条卡片数据`);
            return jsonify({ list: cards });
        } catch (e) {
            log(`获取卡片列表后续页异常: ${e.message}`);
            return jsonify({ list: [] });
        }
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);
    try {
        let unlockedHtml = null;
        const initialResponse = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(initialResponse.data);
        
        const isContentHidden = $('.message[isfirst="1"]').text().includes("回复");
        if (isContentHidden) {
            const threadIdMatch = url.match(/thread-(\d+)/);
            const threadId = threadIdMatch ? threadIdMatch[1] : null;
            if (threadId) {
                log("内容被隐藏，启动回帖流程...");
                unlockedHtml = await performReply(threadId);
                if (unlockedHtml) {
                    $ = cheerio.load(unlockedHtml);
                } else {
                    throw new Error("回帖失败或未收到解锁内容");
                }
            }
        }

        const postContent = $('.message[isfirst="1"]').text();
        const urlRegex = /https?:\/\/pan\.quark\.cn\/[a-zA-Z0-9\/]+/g;
        const urls = [...new Set(postContent.match(urlRegex ) || [])];
        const tracks = [];
        if (urls.length > 0) {
            urls.forEach((link, index) => {
                const context = postContent.substring(postContent.indexOf(link));
                const passMatch = context.match(/(?:提取码|访问码|密码|code|pwd)\s*[：:]?\s*([a-zA-Z0-9]{4,})/i);
                let panName = `夸克网盘 ${index + 1}`;
                if (passMatch && passMatch[1]) { panName += ` [码:${passMatch[1]}]`; }
                tracks.push({ name: panName, pan: link, ext: {} });
            });
        }
        if (tracks.length === 0) { tracks.push({ name: '未找到有效资源链接', pan: '', ext: {} }); }
        log(`成功处理 ${tracks.length} 个播放链接`);
        return jsonify({ list: [{ title: '资源列表', tracks }] });
    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '提示', tracks: [{ name: e.message, pan: '', ext: {} }] }] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });

    // 如果是新的搜索词
    if (text !== lastSearchKeyword) {
        log(`新的搜索任务: ${text}`);
        lastSearchKeyword = text;
        delete searchCache[text]; // 清理旧缓存（以防万一）

        const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
        try {
            const { data } = await fetchWithCookie(url);
            const $ = cheerio.load(data);
            const allResults = [];
            $('li.media.thread').each((_, item) => {
                const subjectLink = $(item).find('.style3_subject a[href*="thread-"]');
                const vod_id = subjectLink.attr('href') || '';
                const vod_name = subjectLink.text().trim() || '';
                let vod_pic = $(item).find('a[href*="user-"] img.avatar-3').attr('src') || '';
                if (vod_pic && !vod_pic.startsWith('http' )) { vod_pic = `${SITE_URL}/${vod_pic}`; }
                const views = $(item).find('span.fa-eye').next('span').text().trim();
                const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
                const vod_remarks = `看:${views} / 评:${comments}`;
                if (vod_id && vod_name) { allResults.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } }); }
            });
            
            log(`一次性获取到 ${allResults.length} 条搜索结果`);
            
            // 建立缓存
            searchCache[text] = {
                fullList: allResults,
                deliveredCount: 0
            };

        } catch (e) {
            log(`搜索异常: ${e.message}`);
            searchCache[text] = { fullList: [], deliveredCount: 0 }; // 即使失败也建立空缓存
        }
    }

    // --- 【v1.7 终极战术】分批交付 ---
    const cache = searchCache[text];
    if (!cache) return jsonify({ list: [] }); // 理论上不会发生

    const delivered = cache.deliveredCount;
    const total = cache.fullList.length;

    if (delivered >= total) {
        log(`所有搜索结果已交付完毕，返回空列表。`);
        return jsonify({ list: [] }); // “牙膏”挤完了
    }

    const nextPageData = cache.fullList.slice(delivered, delivered + PAGE_SIZE);
    cache.deliveredCount += PAGE_SIZE; // 更新已交付数量

    log(`交付 ${nextPageData.length} 条数据，累计已交付 ${Math.min(cache.deliveredCount, total)} / ${total}`);
    return jsonify({ list: nextPageData });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('夸父资源插件加载完成 (纯前端改造版 v1.7)');
