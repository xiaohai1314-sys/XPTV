/**
 * 夸父资源前端插件 - V5.10 (一步到位 + 去重优化)
 *
 * 版本说明:
 * - 【V5.10 核心】基于用户提供的 V5.6 (去重优化版) 脚本为底版。
 * - 【功能融合】将“一步到位”的自动刷新逻辑，与“链接去重、多网盘支持”的逻辑完美融合到 getTracks 函数中。
 * - 【一步到位】现在，需要回帖的资源会自动完成回帖、刷新、解析的全过程，直接显示去重后的多网盘链接，无需手动刷新。
 * - 【原封不动】脚本中新的 SITE_URL、新的 Cookie、新的分类、强大的搜索逻辑等所有特性均保留。
 */

// --- 配置区 ---
const SITE_URL = "https://suenen.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://suenen.com/view/img/favicon.png";

// ★★★★★ 最新有效Cookie (用户提供) ★★★★★
const COOKIE = 'bbs_sid=mt21hvqotqu78cl7h33ug63p1r; Hm_lvt_0a637cceb4c7e7eb54ed5c54bfc52234=1761539216; HMACCOUNT=4046F7D926357D93; bbs_token=BybmHjg4nUBBHrI6h099qtroItZJTMF8ug0n9DppL9WaUuM4; Hm_lpvt_0a637cceb4c7e7eb54ed5c54bfc52234=1761540595';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 内部工具函数 ---
function log(msg) {
    try { $log(`[夸父资源 V5.10] ${msg}`); }
    catch (_) { console.log(`[夸父资源 V5.10] ${msg}`); }
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

// ---------------- 自动回帖函数（一步到位核心） ----------------
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
        log(`回帖异常: ${e.message}`);
        $utils.toastError("回帖异常，请检查 Cookie 或网络", 3000);
        return false;
    }
}

// ---------------- XPTV 插件配置 ----------------
async function getConfig() {
    log("插件初始化 (V5.10 一步到位 + 去重优化)");

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

// 修正图片路径
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http')) return path;

    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

// ---------------- 分类列表 ----------------
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
                vod_name: linkElement.text().trim(),
                vod_pic: getCorrectPicUrl($(item).find("img.avatar-3").attr("src")),
                vod_remarks: $(item).find(".date.text-grey.hidden-sm").text().trim(),
                ext: { url: linkElement.attr('href') || "" }
            });
        });

        return jsonify({ list: cards });

    } catch (e) {
        log(`获取分类列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ---------------- 详情页（一‌步到位 + 去重） ----------------
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);

    try {
        // 第一次加载
        let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        let $ = cheerio.load(data);

        const isHidden = $('.message[isfirst="1"]').text().includes("回复");

        if (isHidden) {
            log("内容被隐藏，开始自动回帖...");
            const threadId = url.match(/thread-(\d+)/)[1];

            const ok = await performReply(threadId);
            if (!ok) {
                return jsonify({
                    list: [{
                        title: '提示',
                        tracks: [{ name: "❌ 自动回帖失败，请检查Cookie", pan: '', ext: {} }]
                    }]
                });
            }

            log("回帖成功，刷新页面...");
            const refreshed = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
            $ = cheerio.load(refreshed.data);
        }

        // 解析链接（去重）
        const tracks = [];
        const added = new Set();

        const main = $('.message[isfirst="1"]');

        main.find('a[href*="pan.quark.cn"], a[href*="cloud.189.cn"], a[href*="aliyundrive.com"], a[href*="alipan.com"]').each((_, el) => {
            const link = $(el).attr('href');
            if (!link || added.has(link)) return;
            added.add(link);

            let pan = "未知网盘";
            if (link.includes("quark.cn")) pan = "夸克网盘";
            else if (link.includes("cloud.189.cn")) pan = "天翼云盘";
            else if (link.includes("aliyundrive.com") || link.includes("alipan.com")) pan = "阿里云盘";

            const index = tracks.filter(t => t.name.startsWith(pan)).length + 1;

            tracks.push({
                name: `${pan} ${index}`,
                pan: link,
                ext: {}
            });
        });

        if (tracks.length === 0) {
            tracks.push({
                name: isHidden ? "回帖成功，但未发现资源" : "未找到有效资源",
                pan: '',
                ext: {}
            });
        }

        return jsonify({ list: [{ title: "云盘", tracks }] });

    } catch (e) {
        log(`详情解析异常: ${e.message}`);
        return jsonify({
            list: [{ title: "错误", tracks: [{ name: "操作失败，请检查网络或Cookie", pan: '', ext: {} }] }]
        });
    }
}

// ---------------- 搜索（带缓存） ----------------
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

    // 关键词发生变化 → 清除缓存
    if (text !== searchCache.keyword) {
        log(`新搜索关键词: ${text} ，重置缓存`);
        searchCache = {
            keyword: text,
            page: 0,
            results: [],
            total: Infinity,
            pagecount: Infinity
        };
    }

    if (page > searchCache.pagecount) {
        return jsonify({ list: [] });
    }

    if (page <= searchCache.page) {
        const size = 20;
        return jsonify({ list: searchCache.results.slice((page - 1) * size, page * size) });
    }

    const encoded = encodeURIComponent(text);
    const url = page === 1
        ? `${SITE_URL}/search-${encoded}-1.htm`
        : `${SITE_URL}/search-${encoded}-1-${page}.htm`;

    log(`搜索请求 URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        const $ = cheerio.load(data);

        if (searchCache.pagecount === Infinity) {
            let maxPage = 1;
            $('ul.pagination a.page-link').each((_, el) => {
                const n = parseInt($(el).text().trim());
                if (!isNaN(n) && n > maxPage) maxPage = n;
            });
            searchCache.pagecount = maxPage;
        }

        const cards = [];

        $("li.media.thread").each((_, item) => {
            const a = $(item).find('.style3_subject a');

            cards.push({
                vod_id: a.attr('href') || "",
                vod_name: a.text().trim(),
                vod_pic: getCorrectPicUrl($(item).find("img.avatar-3").attr("src")),
                vod_remarks: $(item).find(".date.text-grey.hidden-sm").text().trim(),
                ext: { url: a.attr('href') || "" }
            });
        });

        if (cards.length === 0 && page > 1) {
            searchCache.pagecount = page - 1;
            return jsonify({ list: [] });
        }

        searchCache.results = searchCache.results.concat(cards);
        searchCache.page = page;
        searchCache.total = searchCache.results.length;

        return jsonify({ list: cards });

    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 兼容旧接口
async function init() { return getConfig(); }
async function home() {
    const c = await getConfig();
    const cfg = JSON.parse(c);
    return jsonify({ class: cfg.tabs, filters: {} });
}
async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id, page: pg });
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
