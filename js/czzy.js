/**
 * 夸父资源社 - 纯前端改造版 (v1.4 - 最终决战修正版)
 *
 * 架构分析与总指挥: (您的名字)
 * 代码实现: Manus
 *
 * 版本说明:
 * - 【v1.4 BUG修复】
 *   - 1. 解决了首次点击“回复可见”帖时，因异步流程处理不当导致的“闪退”及需二次进入的问题。
 *   - 2. 解决了搜索结果只有一个时，因缺少分页元数据而导致的无限重复加载问题。
 * - 【v1.3 终极优化】根据您的最终指令，将“回复可见”的判断条件修改为最直接、最可靠的“回复”关键词，确保100%触发。
 * - 【v1.2 修正】修复了getTracks函数中因逻辑顺序错误，导致自动回帖功能在特定情况下不触发的致命BUG。
 * - 【v1.1】根据您的指令，已将您提供的Cookie直接集成到脚本中，实现开箱即用。
 * - 【架构革命】彻底抛弃原有的"Node.js后端代理+前端插件"的笨重模式，回归纯前端实现。
 */

// --- 核心配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio(); // 假设XPTV环境提供此函数

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

// --- 核心辅助函数 ---
function log(msg) {
    try { $log(`[夸父纯前端版] ${msg}`); } catch (_) { console.log(`[夸父纯前端版] ${msg}`); }
}

function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}

function jsonify(data) {
    return JSON.stringify(data);
}

const REPLY_MESSAGES = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！", "不错的帖子点赞！", "哈哈，不错哦！", "感谢楼主，下载来看看", "这个必须支持一下！", "楼主辛苦了，资源收下了"];

function getRandomReply() {
    return REPLY_MESSAGES[Math.floor(Math.random() * REPLY_MESSAGES.length)];
}

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.length < 20) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, 'Referer': SITE_URL, ...options.headers };
    const finalOptions = { ...options, headers, timeout: 20000 };
    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}

async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await fetchWithCookie(replyUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': SITE_URL,
                'Referer': `${SITE_URL}/thread-${threadId}.htm`
            }
        });
        if (data.includes("您尚未登录")) {
            log("回帖失败：Cookie已失效或不正确。");
            $utils.toastError("Cookie已失效，请重新获取", 3000);
            return false;
        }
        log(`回帖成功，内容: "${message}"`);
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") {
            $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        }
        return false;
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (纯前端改造版 v1.4)");
    return jsonify({ ver: 1, title: '夸父资源', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
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
            if (vod_pic && !vod_pic.startsWith('http' )) {
                vod_pic = `${SITE_URL}/${vod_pic}`;
            }
            const views = $(item).find('span.fa-eye').next('span').text().trim();
            const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
            const vod_remarks = `看:${views} / 评:${comments}`;
            if (vod_id && vod_name) {
                cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
            }
        });
        
        // 检查是否有下一页，为分页提供依据
        const hasNextPage = $('.pagination .page-item a:contains("▶")').length > 0;
        const pagecount = hasNextPage ? parseInt(page) + 1 : parseInt(page); // 简单处理，假设有下一页则总页数+1

        log(`成功解析 ${cards.length} 条卡片数据`);
        return jsonify({ list: cards, page: parseInt(page), pagecount: pagecount, limit: cards.length, total: cards.length * pagecount });
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
        const threadIdMatch = url.match(/thread-(\d+)/);
        const threadId = threadIdMatch ? threadIdMatch[1] : null;

        let { data, $ } = await (async () => {
            const initialData = await fetchWithCookie(detailUrl);
            const initial$ = cheerio.load(initialData.data);
            const isContentHidden = initial$('.message[isfirst="1"]').text().includes("回复");

            if (isContentHidden && threadId) {
                log("内容被隐藏，启动回帖流程...");
                // ★★★ 【v1.4 BUG修复 1】★★★
                // 使用await确保回帖完成后再继续
                const replied = await performReply(threadId);
                if (replied) {
                    log("回帖成功，等待1秒后重新获取页面内容...");
                    await $utils.sleep(1000);
                    const retryResponse = await fetchWithCookie(detailUrl);
                    return { data: retryResponse.data, $: cheerio.load(retryResponse.data) };
                } else {
                    // 如果回帖失败，抛出一个错误，由外层catch处理
                    throw new Error("回帖失败，无法获取资源");
                }
            }
            // 如果无需回帖，直接返回初次请求的结果
            return { data: initialData.data, $: initial$ };
        })();

        const postContent = $('.message[isfirst="1"]').text();
        const urlRegex = /https?:\/\/pan\.quark\.cn\/[a-zA-Z0-9\/]+/g;
        const urls = [...new Set(postContent.match(urlRegex ) || [])];
        const tracks = [];

        if (urls.length > 0) {
            urls.forEach((link, index) => {
                const context = postContent.substring(postContent.indexOf(link));
                const passMatch = context.match(/(?:提取码|访问码|密码|code|pwd)\s*[：:]?\s*([a-zA-Z0-9]{4,})/i);
                let panName = `夸克网盘 ${index + 1}`;
                if (passMatch && passMatch[1]) {
                    panName += ` [码:${passMatch[1]}]`;
                }
                tracks.push({ name: panName, pan: link, ext: {} });
            });
        }

        if (tracks.length === 0) {
            tracks.push({ name: '未找到有效资源链接', pan: '', ext: {} });
        }

        log(`成功处理 ${tracks.length} 个播放链接`);
        return jsonify({ list: [{ title: '资源列表', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        // 统一错误出口，给用户明确提示
        return jsonify({ list: [{ title: '提示', tracks: [{ name: e.message, pan: '', ext: {} }] }] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
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
            if (vod_pic && !vod_pic.startsWith('http' )) {
                vod_pic = `${SITE_URL}/${vod_pic}`;
            }
            const views = $(item).find('span.fa-eye').next('span').text().trim();
            const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
            const vod_remarks = `看:${views} / 评:${comments}`;
            if (vod_id && vod_name) {
                cards.push({ vod_id, vod_name, vod_pic, vod_remarks, ext: { url: vod_id } });
            }
        });
        log(`搜索成功，找到 ${cards.length} 条结果`);
        
        // ★★★ 【v1.4 BUG修复 2】★★★
        // 返回完整的元数据，明确告知App框架总页数和总数量，以停止无限加载
        return jsonify({ 
            list: cards, 
            page: 1, 
            pagecount: 1, // 搜索结果不分页，总页数永远是1
            limit: cards.length, 
            total: cards.length // 总记录数就是当前找到的数量
        });

    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

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

log('夸父资源插件加载完成 (纯前端改造版 v1.4)');
