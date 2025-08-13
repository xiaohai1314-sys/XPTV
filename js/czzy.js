/**
 * 夸父资源社 - 纯前端改造版 (v1.6 - 最终决胜版)
 *
 * 架构分析与总指挥: (您的名字)
 * 代码实现: Manus
 *
 * 版本说明:
 * - 【v1.6 闪电战术】根据您的最终洞察，彻底修复“首次点击回复帖提示Cookie失效”的BUG。
 *   - 1. 优化回帖逻辑，不再发起多余的第三次GET请求。
 *   - 2. 直接利用回帖成功后POST请求返回的、已解锁的HTML，规避服务器风控，大幅提升性能。
 * - 【v1.5 主动防御】继承并坚持v1.5的“自我清点+缓存”策略，彻底解决分类和搜索的无限加载问题。
 *   - 1. (搜索) search函数在解析完数据后，将自身的解析结果数量(cards.length)作为total和limit的权威值返回。
 *   - 2. (分类) getCards函数同样采用此逻辑，并结合从分页栏获取的精确总页数，构建完美的缓存和返回数据。
 * - 【架构革命】彻底抛弃原有的"Node.js后端代理+前端插件"的笨重模式，回归纯前端实现。
 * - 【核心基石】所有功能均基于您提供的真实情报（Cookie、cURL、HTML）构建，并保留您指定的分类导航。
 */

// --- 核心配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();

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

// --- 缓存与状态管理 ---
let searchCache = {};
let categoryCache = {};

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

// ★★★ 【v1.6 闪电战术】 ★★★
// 回帖函数不再只返回布尔值，而是直接返回解锁后的HTML
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
        return data; // 直接返回解锁后的HTML
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") { $utils.toastError("回帖异常，请检查网络或Cookie", 3000); }
        return null;
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (纯前端改造版 v1.6)");
    searchCache = {};
    categoryCache = {};
    return jsonify({ ver: 1, title: '夸父资源', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

async function getCards(ext) {
    ext = argsify(ext);
    const page = parseInt(ext.page || 1);
    const id = ext.id;
    const cacheKey = `${id}_${page}`;

    if (categoryCache[cacheKey]) {
        log(`分类列表命中缓存: ${cacheKey}`);
        return jsonify(categoryCache[cacheKey]);
    }
    
    const globalInfoKey = `${id}_info`;
    if (categoryCache[globalInfoKey] && page > categoryCache[globalInfoKey].pagecount) {
        log(`主动防御：请求页码 ${page} 超出总页数 ${categoryCache[globalInfoKey].pagecount}，返回空。`);
        return jsonify({ list: [] });
    }

    const url = `${SITE_URL}/${id.replace('.htm', '')}-${page}.htm`;
    log(`获取分类数据: ${url}`);
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

        let pagecount = page;
        const pagination = $('ul.pagination');
        if (pagination.length > 0) {
            const lastPageLink = pagination.find('a:contains("▶")').prev('a');
            if (lastPageLink.length > 0) {
                pagecount = parseInt(lastPageLink.text()) || page;
            } else {
                // 如果没有'▶'，说明可能只有一页
                const lastNumber = pagination.find('li.page-item a.page-link').last().text();
                pagecount = parseInt(lastNumber) || 1;
            }
        } else {
            pagecount = 1;
        }
        
        const result = { list: cards, page: page, pagecount: pagecount };
        categoryCache[cacheKey] = result;
        if (!categoryCache[globalInfoKey]) {
            categoryCache[globalInfoKey] = { pagecount: pagecount };
        }
        log(`成功解析 ${cards.length} 条卡片数据，总页数: ${pagecount}`);
        return jsonify(result);
    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
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
                // ★★★ 【v1.6 闪电战术】 ★★★
                // 直接获取回帖后返回的HTML，不再二次请求
                unlockedHtml = await performReply(threadId);
                if (unlockedHtml) {
                    $ = cheerio.load(unlockedHtml); // 用解锁后的HTML重新加载cheerio
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

    if (searchCache[text]) {
        log(`搜索命中缓存: ${text}`);
        return jsonify(searchCache[text]);
    }

    const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
    log(`执行搜索: ${url}`);
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
        
        log(`搜索成功，找到 ${cards.length} 条结果`);
        
        // ★★★ 【v1.5 主动防御】 ★★★
        const result = { 
            list: cards, 
            page: 1, 
            pagecount: 1,
            limit: cards.length, 
            total: cards.length
        };

        searchCache[text] = result;
        return jsonify(result);

    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('夸父资源插件加载完成 (纯前端改造版 v1.6)');
