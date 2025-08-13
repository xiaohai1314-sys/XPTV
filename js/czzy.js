/**
 * 夸父资源社 - 纯前端改造版 (v1.11 - 部署版)
 *
 * 架构分析与总指挥: (您的名字)
 * 代码实现: Manus
 *
 * 版本说明:
 * - 【v1.1】根据您的指令，已将您提供的Cookie直接集成到脚本中，实现开箱即用。
 * - 【架构革命】彻底抛弃原有的"Node.js后端代理+前端插件"的笨重模式，回归纯前端实现。
 * - 【性能巅峰】所有数据（列表、详情、海报）均由前端直接请求，一次性解析完成，性能远超原版。
 * - 【登录简化】废除Puppeteer，采用与"海绵小站"一致的Cookie登录方案，稳定且高效。
 * - 【精准回帖】根据您提供的cURL情报，实现轻量化的HTTP自动回帖功能，完美解决"回复可见"。
 * - 【情报驱动】严格遵循您提供的所有情报，确保每一行代码都有据可依。
 * - 【基石不变】完全保留您指定的`CUSTOM_CATEGORIES`分类导航，确保入口稳定。
 */

// --- 核心配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio(); // 假设XPTV环境提供此函数

// ★★★★★【用户配置区 - 已根据您的情报填入】★★★★★
const COOKIE = "FCNEC=%5B%5B%22AKsRol9IGaKWOBTOGBzw722JesBuZ6oBQ8BWyhS1sid5T6EgiFzx03EthXDVTByqguQO6R5cUsGSFpQTAO0YUi8M59bHnBLUvpzUvXbuuX_2PMD3jesg4s_64cWP2ADcDT2RQ60xpAYTwQzVys3pOKDHx6c5jNTi5g%3D%3D%22%5D%5D; bbs_sid=jhkoc4ehds51tnq53s92m4pgg2; Hm_lvt_2c2cd308748eb9097e250ba67b76ef20=1753520407,1755058584; HMACCOUNT=29968E74595D96C7; isClose=yes; bbs_token=rtsyyvswV8ToUUWxp9AiSMhDFryWZn8pDX0o_2FOqJcbsGfjBA; __gads=ID=e36eaf8870050a1a:T=1753520409:RT=1755059258:S=ALNI_MbHHfmGOmCC1aUYCrZV2orHdqlAkQ; __gpi=UID=0000116ee2558a2e:T=1753520409:RT=1755059258:S=ALNI_MbPo0LUpjI9Szvl30bM0_NBZO3Fvw; __eoi=ID=87ce519f7ac78c31:T=1753520409:RT=1755059258:S=AA-AfjYwkQUVZH6vQ7LqvTvnihuE; Hm_lpvt_2c2cd308748eb9097e250ba67b76ef20=1755059365";
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 不可修改的基石 ---
// 严格遵循您的指示，此部分原封不动
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
    try {
        $log(`[夸父纯前端版] ${msg}`);
    } catch (_) {
        console.log(`[夸父纯前端版] ${msg}`);
    }
}

function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}

function jsonify(data) {
    return JSON.stringify(data);
}

// 自动回复的语料库
const REPLY_MESSAGES = [
    "感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！",
    "不错的帖子点赞！", "哈哈，不错哦！", "感谢楼主，下载来看看",
    "这个必须支持一下！", "楼主辛苦了，资源收下了"
];

function getRandomReply() {
    return REPLY_MESSAGES[Math.floor(Math.random() * REPLY_MESSAGES.length)];
}

// 统一的网络请求函数
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.length < 20) { // 简单检查Cookie是否为空
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = {
        'User-Agent': UA,
        'Cookie': COOKIE,
        'Referer': SITE_URL,
        ...options.headers
    };
    const finalOptions = { ...options, headers, timeout: 20000 };

    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}

// 【全新】轻量化自动回帖函数
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
    log("插件初始化 (纯前端改造版 v1.1)");
    return jsonify({
        ver: 1,
        title: '夸父资源',
        site: SITE_URL,
        cookie: '', // cookie由内部管理，此处留空
        tabs: CUSTOM_CATEGORIES,
    });
}

// 【全新】列表页解析函数
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
            
            // 【制胜关键】直接从列表页获取海报图（发帖人头像）
            let vod_pic = $(item).find('a[href*="user-"] img.avatar-3').attr('src') || '';
            if (vod_pic && !vod_pic.startsWith('http' )) {
                vod_pic = `${SITE_URL}/${vod_pic}`;
            }

            // 提取备注信息（浏览量和评论数）
            const views = $(item).find('span.fa-eye').next('span').text().trim();
            const comments = $(item).find('span.fa-comment-dots').next('span').text().trim();
            const vod_remarks = `看:${views} / 评:${comments}`;

            if (vod_id && vod_name) {
                cards.push({
                    vod_id: vod_id,
                    vod_name: vod_name,
                    vod_pic: vod_pic,
                    vod_remarks: vod_remarks,
                    ext: { url: vod_id },
                });
            }
        });

        log(`成功解析 ${cards.length} 条卡片数据`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 【全新】详情页解析函数
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);

    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);

        // 检查是否需要回复
        const threadIdMatch = url.match(/thread-(\d+)/);
        const threadId = threadIdMatch ? threadIdMatch[1] : null;
        const isContentHidden = $('.message[isfirst="1"]').text().includes("回复");

        if (isContentHidden && threadId) {
            log("内容被隐藏，启动回帖流程...");
            const replied = await performReply(threadId);
            if (replied) {
                log("回帖成功，等待1秒后重新获取页面内容...");
                await $utils.sleep(1000);
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data); // 重新加载页面内容
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "回帖失败，无法获取资源", pan: '', ext: {} }] }] });
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
                let finalUrl = link;

                if (passMatch && passMatch[1]) {
                    const passCode = passMatch[1];
                    panName += ` [码:${passCode}]`;
                    // 如果需要，可以构建带提取码的完整链接，但通常App是分开处理的
                    // finalUrl = `${link} (提取码: ${passCode})`; 
                }
                
                tracks.push({
                    name: panName,
                    pan: finalUrl,
                    ext: {},
                });
            });
        }

        if (tracks.length === 0) {
            tracks.push({ name: '未找到有效资源链接', pan: '', ext: {} });
        }

        log(`成功处理 ${tracks.length} 个播放链接`);
        return jsonify({ list: [{ title: '资源列表', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie或网络", pan: '', ext: {} }] }] });
    }
}

// 【全新】搜索函数
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
                cards.push({
                    vod_id: vod_id,
                    vod_name: vod_name,
                    vod_pic: vod_pic,
                    vod_remarks: vod_remarks,
                    ext: { url: vod_id },
                });
            }
        });

        log(`搜索成功，找到 ${cards.length} 条结果`);
        return jsonify({ list: cards });
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

log('夸父资源插件加载完成 (纯前端改造版 v1.1)');
