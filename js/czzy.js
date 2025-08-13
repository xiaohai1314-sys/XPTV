/**
 * 夸父资源前端插件 - V5.2 王者归来版
 *
 * 版本说明:
 * - 【V5.2 核心】基于 V5.1 版本，其搜索逻辑（缓存机制 + 正确的URL格式）被完整保留，这是我们解决所有搜索问题的关键。
 * - 【王者归来】彻底废除 V5.1 中有缺陷的 `fetchWithCookie` 辅助函数和调用它的 `performReply` 函数。
 * - 【经典重现】100% 完整地、原封不动地，将 V1.9 版本中那个最原始、最可靠、已被验证成功的 `performReply` 函数移植回来，彻底解决自动回复失败的问题。
 * - 【保留完美提示】`getTracks` 函数中的提示语 “内容已隐藏，后台自动回帖，请稍后刷新本页” 被完整保留，确保了最佳的用户体验。
 * - 【继承所有成果】保留了最新的有效Cookie、固定的分类列表、以及所有其他已验证的成功逻辑。
 */

// --- 配置区 ---
const SITE_URL = "https://www.kuafuzy.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.kuafuzy.com/view/img/favicon.png";

// ★★★★★ 最新有效Cookie ★★★★★
const COOKIE = 'bbs_sid=r9voaafporp90loq4pb9tkb19f; Hm_lvt_2c2cd308748eb9097e250ba67b76ef20=1755075712; HMACCOUNT=369F5CB87E8CAB18; isClose=yes; bbs_token=fCoPPO37Lp4GXjlXVDxmUPv42rBh4Fw7sMPCjJLTe6RMWiOK; __gads=ID=7493bd5727e59480:T=1755075714:RT=1755077860:S=ALNI_MYJvEBISMvpSRLIfA3UDLv6UK981A; __gpi=UID=0000117f6c1e9b44:T=1755075714:RT=1755077860:S=ALNI_Ma4_A9salT3Rdur67vJ1Z3RZqvk1g; __eoi=ID=5cc1b8a075993313:T=1755075714:RT=1755077860:S=AA-AfjaclE5ud7kHwwQeCM5KX1c-; Hm_lpvt_2c2cd308748eb9097e250ba67b76ef20=1755077876';
// ★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg ) {
    try {
        $log(`[夸父资源 王者归来] ${msg}`);
    } catch (_) {
        console.log(`[夸父资源 王者归来] ${msg}`);
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

// ★★★★★【V5.2 核心修正：V1.9经典回帖引擎回归】★★★★★
async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        // 直接使用最原始、最可靠的 $fetch.post
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
        const result = JSON.parse(data);
        if (result.code !== 0) {
            log(`回帖失败: ${result.message}`);
            $utils.toastError(`回帖失败: ${result.message}`, 3000);
            return false;
        }
        log(`回帖成功, 内容: "${message}"`);
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        return false;
    }
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (V5.2 王者归来版)");
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
    if (path.startsWith('http' )) return path;
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

// ★★★★★【V5.1 胜利果实：最强搜索逻辑】★★★★★
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

log('夸父资源插件加载完成 (V5.2 王者归来版)');
