/**
 * 夸父资源前端插件 - V5.8 最终修正版
 *
 * - 基于 V5.3 完整底版（分类显示稳定）
 * - 唯一修正：仅修改 getTracks，实现自动回帖 + 自动刷新
 * - 已彻底修复所有 LaTex 破坏模板字符串的语法问题
 */

// --- 配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.kuafuzy.com/view/img/favicon.png";

// ★★★★★ 最新有效Cookie ★★★★★
const COOKIE = 'bbs_sid=kdk76a7etiao2uc1deru2c8q9c; Hm_lvt_2c2cd308748eb9097e250ba67b76ef20=1755075712; HMACCOUNT=369F5CB87E8CAB18; isClose=yes; bbs_token=VbfqN_2F4vvTqqNUrxO1pLpuWaXU7MXi5_2FJJHx4cmP5recv89f; __gads=ID=7493bd5727e59480:T=1755075714:RT=1755077860:S=ALNI_MYJvEBISMvpSRLIfA3UDLv6UK981A; __gpi=UID=0000117f6c1e9b44:T=1755075714:RT=1755077860:S=ALNI_Ma4_A9salT3Rdur67vJ1Z3RZqvk1g; __eoi=ID=5cc1b8a075993313:T=1755075714:RT=1755077860:S=AA-AfjaclE5ud7kHwwQeCM5KX1c-; Hm_lpvt_2c2cd308748eb9097e250ba67b76ef20=1755077876';
// ★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg) {
    try {
        $log(`[夸父资源 最终修正版 V5.8] ${msg}`);
    } catch (_) {
        console.log(`[夸父资源 最终修正版 V5.8] ${msg}`);
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

// --- 插件初始化入口 ---
async function getConfig() {
    log("插件初始化 (V5.3 最终完美版)");
    const CUSTOM_CATEGORIES = [
        { name: '电影区', ext: { id: 'forum-1.htm' } },
        { name: '剧集区', ext: { id: 'forum-2.htm' } },
        { name: '4K电影', ext: { id: 'forum-3.htm' } },
        { name: '4K剧集', ext: { id: 'forum-4.htm' } },
        { name: '纪录片', ext: { id: 'forum-13.htm' } },
        { name: '综艺区', ext: { id: 'forum-14.htm' } }
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
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

// --- 分类页面 ---
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

// ★★★★★【V5.8 唯一修正点：自动刷新详情页】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);

    try {
        let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        let $ = cheerio.load(data);

        const isContentHidden = $('.message[isfirst="1"]').text().includes("回复");

        if (isContentHidden) {
            log("内容被隐藏，启动回帖流程...");
            const threadId = url.match(/thread-(\d+)/)[1];
            const replySuccess = await performReply(threadId);

            if (replySuccess) {
                log("回帖成功，重新加载页面以获取解锁内容...");
                const refreshResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
                $ = cheerio.load(refreshResponse.data);
            } else {
                return jsonify({
                    list: [{
                        title: '提示',
                        tracks: [{ name: "❌ 自动回帖失败，请检查Cookie或网络", pan: '', ext: {} }]
                    }]
                });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const links = [];

        mainMessage.find('a[href*="pan.quark.cn"]').each((_, element) => {
            links.push($(element).attr('href'));
        });

        const tracks = links.map((link, index) => ({
            name: `夸克网盘 ${index + 1}`,
            pan: link,
            ext: {},
        }));

        if (tracks.length === 0) {
            if (isContentHidden) {
                tracks.push({ name: "回帖成功，但页面上未发现有效链接", pan: '', ext: {} });
            } else {
                tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
            }
        }

        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({
            list: [{
                title: '错误',
                tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }]
            }]
        });
    }
}

// ★★★★★【V5.1/V5.2 最强搜索逻辑】★★★★★
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
        const pageSize = 20;
        return jsonify({ list: searchCache.results.slice((page - 1) * pageSize, page * pageSize) });
    }

    const encodedKeyword = encodeURIComponent(text);
    let url = page === 1
        ? `${SITE_URL}/search-${encodedKeyword}-1.htm`
        : `${SITE_URL}/search-${encodedKeyword}-1-${page}.htm`;

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': COOKIE } });
        const $ = cheerio.load(data);

        if (searchCache.pagecount === Infinity) {
            let maxPage = 1;
            $('ul.pagination a.page-link').each((_, elem) => {
                const n = parseInt($(elem).text().trim());
                if (!isNaN(n) && n > maxPage) maxPage = n;
            });
            searchCache.pagecount = maxPage;
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

// --- XPTV新版兼容接口 ---
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

log('夸父资源插件加载完成 (V5.8 最终修正版)');
