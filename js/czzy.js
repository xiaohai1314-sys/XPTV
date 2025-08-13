/**
 * 夸父资源社 - 纯前端改造版 (v2.0 - 最终完美版)
 *
 * 架构分析与总指挥: (您的名字)
 * 代码实现: Manus
 *
 * 版本说明:
 * - 【v2.0 最终修正】
 *   - 1. (自动回复) 彻底修复“提示语无法显示”及“二次进入”的根源问题。根据您的最终情报，确认App框架存在“单任务网络请求”限制。v2.0版getTracks函数在检测到需回帖时，将无条件、毫秒级返回操作指引，彻底规避框架限制，同时在后台异步触发回帖，逻辑完美闭环。
 *   - 2. (搜索) 彻底修复“多页结果只显示一页”的BUG。采用更鲁棒的分页解析逻辑，确保能准确获取所有分页并一次性扫荡全部数据。
 * - 【v1.9 核心保留】完整保留v1.9已成功的“一次获取，分批交付”缓存策略，杜绝重复加载。
 * - 【架构革命】彻底抛弃原有的"Node.js后端代理+前端插件"的笨重模式，回归纯前端实现。
 * - 【核心基石】所有功能均基于您提供的真实情报（Cookie、cURL、HTML）构建，并保留您指定的分类导航。
 */

// --- 核心配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const PAGE_SIZE = 20;

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
let lastSearchKeyword = "";
let isReplying = {};

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[夸父纯前端版] ${msg}`); } catch (_) { console.log(`[夸父纯前端版] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
const REPLY_MESSAGES = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！", "不错的帖子点赞！", "哈哈，不错哦！", "感谢楼主，下载来看看", "这个必须支持一下！", "楼主辛苦了，资源收下了"];
function getRandomReply() { return REPLY_MESSAGES[Math.floor(Math.random() * REPLY_MESSAGES.length)]; }

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.length < 20) { throw new Error("Cookie not configured."); }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, 'Referer': SITE_URL, ...options.headers };
    const finalOptions = { ...options, headers, timeout: 20000 };
    if (options.method === 'POST') { return $fetch.post(url, options.body, finalOptions); }
    return $fetch.get(url, finalOptions);
}

async function performReply(threadId) {
    if (isReplying[threadId]) {
        log(`帖子 ${threadId} 已在回帖队列中，防止重复触发。`);
        return;
    }
    isReplying[threadId] = true;
    log(`正在为帖子 ${threadId} 执行后台异步回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        await fetchWithCookie(replyUrl, {
            method: 'POST', body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Origin': SITE_URL, 'Referer': `${SITE_URL}/thread-${threadId}.htm` }
        });
        log(`帖子 ${threadId} 后台回帖成功。`);
    } catch (e) {
        log(`帖子 ${threadId} 后台回帖异常: ${e.message}`);
    } finally {
        delete isReplying[threadId];
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (纯前端改造版 v2.0)");
    searchCache = {};
    categoryCache = {};
    lastSearchKeyword = "";
    isReplying = {};
    return jsonify({ ver: 1, title: '夸父资源', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

async function getCards(ext) {
    ext = argsify(ext);
    const page = parseInt(ext.page || 1);
    const id = ext.id;
    const cacheKey = id;

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
            const pageLinks = $('ul.pagination a.page-link');
            if (pageLinks.length > 0) {
                for (let i = pageLinks.length - 1; i >= 0; i--) {
                    const linkText = $(pageLinks[i]).text().trim();
                    if (!isNaN(linkText)) {
                        pagecount = parseInt(linkText);
                        break;
                    }
                }
            }
            
            categoryCache[cacheKey] = { pagecount: pagecount };
            log(`成功解析 ${cards.length} 条卡片数据，总页数: ${pagecount}`);
            return jsonify({ list: cards });

        } catch (e) {
            log(`获取卡片列表异常: ${e.message}`);
            return jsonify({ list: [] });
        }
    }

    if (page > 1) {
        if (categoryCache[cacheKey] && page > categoryCache[cacheKey].pagecount) {
            log(`主动防御：请求页码 ${page} 超出总页数 ${categoryCache[cacheKey].pagecount}，返回空。`);
            return jsonify({ list: [] });
        }
        
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
        const { data } = await fetchWithCookie(detailUrl);
        const $ = cheerio.load(data);
        
        const isContentHidden = $('.message[isfirst="1"]').text().includes("回复");
        
        if (isContentHidden) {
            const threadIdMatch = url.match(/thread-(\d+)/);
            if (threadIdMatch) {
                // ★★★ 【v2.0 最终修正】 ★★★
                // 触发后台异步回帖，并立即返回操作指引
                performReply(threadIdMatch[1]); 
                log("内容已隐藏，返回操作指引，并已触发后台异步回帖。");
                return jsonify({ list: [{ title: '操作提示', tracks: [{ name: '内容已隐藏，后台自动回帖，请稍后刷新本页', pan: 'about:blank' }] }] });
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
        // 只有在网络请求失败时，才使用toast提示
        if (e.message === "Cookie not configured." || e.message.toLowerCase().includes('network')) {
            $utils.toastError(`详情页加载失败: ${e.message}`, 3000);
        }
        return jsonify({ list: [{ title: '提示', tracks: [{ name: `加载失败: ${e.message}`, pan: '', ext: {} }] }] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });

    if (text !== lastSearchKeyword) {
        log(`新的搜索任务: ${text}`);
        lastSearchKeyword = text;
        delete searchCache[text];

        try {
            const firstPageUrl = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
            const { data: firstPageData } = await fetchWithCookie(firstPageUrl);
            
            const parsePage = (html) => {
                const page$ = cheerio.load(html);
                const cards = [];
                page$('li.media.thread').each((_, item) => {
                    const subjectLink = page$(item).find('.style3_subject a[href*="thread-"]');
                    const vod_id = subjectLink.attr('href') || '';
                    const vod_name = subjectLink.text().trim() || '';
                    let vod_pic = page$(item).find('a[href*="user-"] img.avatar-3').attr('src') || '';
                    if (vod_pic && !vod_pic.startsWith('http' )) { vod_pic = `${SITE_URL}/${vod_pic}`; }
                    const views = page$(item).find('span.fa-eye').next('span').text().trim();
                    const comments = page$(item).find('span.fa-comment-dots').next('span').text().trim();
                    const vod_remarks = `看:${views} / 评:${comments}`;
                    if (vod_id && vod_name) { cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } }); }
                });
                return cards;
            };
            
            let allResults = parsePage(firstPageData);
            
            // ★★★ 【v2.0 最终修正】 ★★★
            // 必须用第一页的HTML来解析分页
            const $ = cheerio.load(firstPageData);
            let pagecount = 1;
            const pageLinks = $('ul.pagination a.page-link');
            if (pageLinks.length > 0) {
                for (let i = pageLinks.length - 1; i >= 0; i--) {
                    const linkText = $(pageLinks[i]).text().trim();
                    if (!isNaN(linkText)) {
                        pagecount = parseInt(linkText);
                        break;
                    }
                }
            }

            if (pagecount > 1) {
                log(`侦察到搜索结果共 ${pagecount} 页，开始扫荡剩余页面...`);
                const pagePromises = [];
                for (let i = 2; i <= pagecount; i++) {
                    const pageUrl = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}&page=${i}`;
                    pagePromises.push(fetchWithCookie(pageUrl));
                }
                const otherPageResponses = await Promise.all(pagePromises);
                otherPageResponses.forEach(res => {
                    allResults = allResults.concat(parsePage(res.data));
                });
            }
            
            log(`一次性获取到全部 ${allResults.length} 条搜索结果`);
            searchCache[text] = { fullList: allResults, deliveredCount: 0 };

        } catch (e) {
            log(`搜索异常: ${e.message}`);
            searchCache[text] = { fullList: [], deliveredCount: 0 };
        }
    }

    const cache = searchCache[text];
    if (!cache) return jsonify({ list: [] });

    const delivered = cache.deliveredCount;
    const total = cache.fullList.length;

    if (delivered >= total) {
        log(`所有搜索结果已交付完毕，返回空列表。`);
        return jsonify({ list: [] });
    }

    const nextPageData = cache.fullList.slice(delivered, delivered + PAGE_SIZE);
    cache.deliveredCount += PAGE_SIZE;

    log(`交付 ${nextPageData.length} 条数据，累计已交付 ${Math.min(cache.deliveredCount, total)} / ${total}`);
    return jsonify({ list: nextPageData });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('夸父资源插件加载完成 (纯前端改造版 v2.0)');
