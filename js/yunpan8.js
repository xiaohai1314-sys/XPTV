/**
 * 海绵小站前端插件 - v13.0 (诊断模式)
 *
 * 更新说明:
 * - 诊断模式: 此版本专门用于测试后端API的真实返回值。
 * - 它会捕获后端 /reply 接口的响应，并将其完整地打印到日志和App界面上。
 * - 使用此版本进行一次解锁操作，然后检查日志，即可知道后端到底返回了什么。
 *
 * @version 13.0
 * @author Manus & 您的ID
 */

// ★★★★★【用户配置区】★★★★★
const BACKEND_API_URL = "http://192.168.1.2:3000/reply";
// ★★★★★★★★★★★★★★★★★★★

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";
const COOKIE = "bbs_sid=u55b2g9go9dhrv2l8jbfi4ulbu;bbs_token=zMnlkGz9EkrmRT33Qx1Cf9uUtOiR0_2B_2Ff6Pxdv4W1aXzNIGTH;";

// --- 辅助函数 ---
function log(msg  ) {
    try { $log(`[海绵小站 v13.0] ${msg}`); } catch (_) { console.log(`[海绵小站 v13.0] ${msg}`); }
}
function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {};
}
function jsonify(data) {
    return JSON.stringify(data);
}
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE) {
        $utils.toastError("请配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}

// --- getConfig (严格按v8.1排版) ---
async function getConfig() {
    return jsonify({
        ver: 1,
        title: '海绵小站',
        site: SITE_URL,
        tabs: [
            { name: '电影', ext: { id: 'forum-1' } },
            { name: '剧集', ext: { id: 'forum-2' } },
            { name: '动漫', ext: { id: 'forum-3' } },
            { name: '综艺', ext: { id: 'forum-5' } },
        ],
    });
}

// --- getCorrectPicUrl (严格按v8.1排版) ---
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http'  )) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

// --- getCards (严格按v8.1排版) ---
async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${SITE_URL}/${id}-${page}.htm`;
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];
        $("ul.threadlist > li.media.thread").each((_, item) => {
            const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src");
            cards.push({
                vod_id: $(item).find(".subject a")?.attr("href") || "",
                vod_name: $(item).find(".subject a")?.text().trim() || "",
                vod_pic: getCorrectPicUrl(picPath),
                vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
                ext: { url: $(item).find(".subject a")?.attr("href") || "" }
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        return jsonify({ list: [] });
    }
}

// =================================================================================
// =================== getTracks (诊断模式) ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);

    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);

        if ($("div.alert.alert-warning").text().includes("回复后")) {
            log("内容被隐藏，启动后端AI解锁流程...");
            
            try {
                const response = await $fetch.post(BACKEND_API_URL, { url: url }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
                // ★★★ 诊断核心: 将后端返回的所有内容，无论是什么，都转成字符串 ★★★
                // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
                let diagnosticData;
                try {
                    // 尝试将其作为JSON格式化，如果不行就直接转字符串
                    diagnosticData = JSON.stringify(response, null, 2); 
                } catch (e) {
                    diagnosticData = String(response);
                }

                const message = `[诊断信息] 后端返回的原始响应内容如下:\n\n${diagnosticData}`;
                
                // 1. 在日志中打印
                log(message);
                
                // 2. 在App界面上显示，方便截图
                $utils.toastError("已捕获后端响应，请查看日志", 10000);
                return jsonify({ list: [{ title: '后端原始响应', tracks: [{ name: diagnosticData, pan: '', ext: {} }] }] });

            } catch (e) {
                // 如果请求本身就失败了（比如网络不通、后端服务没开），这里会捕获
                const errorMsg = `请求后端服务失败: ${e.message || '请检查网络或后端服务是否开启'}`;
                log(errorMsg);
                $utils.toastError(errorMsg, 8000);
                return jsonify({ list: [{ title: '错误', tracks: [{ name: errorMsg, pan: '', ext: {} }] }] });
            }
        } else {
            log("内容无需解锁，直接解析。");
            // 为了方便测试，这里也返回一个提示
            return jsonify({ list: [{ title: '信息', tracks: [{ name: '此页面无需解锁', pan: '', ext: {} }] }] });
        }

    } catch (e) {
        const errorMsg = `操作失败: ${e.message}. 请检查网络和后端服务状态。`;
        log(errorMsg);
        $utils.toastError(errorMsg, 8000);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: errorMsg, pan: '', ext: {} }] }] });
    }
}
// =================================================================================

// ======= search (严格按v8.1排版) =======
const searchCache = {};
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    if (searchCache.keyword !== text) {
        searchCache.keyword = text;
        searchCache.data = [];
        searchCache.pagecount = 0;
        searchCache.total = 0;
    }

    if (searchCache.data && searchCache.data[page - 1]) {
        return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total });
    }

    if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
        return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total });
    }

    const url = page === 1
        ? `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`
        : `${SITE_URL}/search-${encodeURIComponent(text)}-1-0-${page}.htm`;

    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        const cards = [];
        $("ul.threadlist > li.media.thread").each((_, item) => {
            const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src");
            cards.push({
                vod_id: $(item).find(".subject a")?.attr("href") || "",
                vod_name: $(item).find(".subject a")?.text().trim() || "",
                vod_pic: getCorrectPicUrl(picPath),
                vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
                ext: { url: $(item).find(".subject a")?.attr("href") || "" }
            });
        });

        let pagecount = 0;
        $('ul.pagination a.page-link').each((_, link) => {
            const p = parseInt($(link).text().trim());
            if (!isNaN(p)) pagecount = Math.max(pagecount, p);
        });

        const total = cards.length;

        if (!searchCache.data) searchCache.data = [];
        searchCache.data[page - 1] = cards;
        searchCache.pagecount = pagecount;
        searchCache.total = total;

        return jsonify({ list: cards, pagecount, total });
    } catch (e) {
        log(`search错误: ${e.message}`);
        return jsonify({ list: [], pagecount: 0, total: 0 });
    }
}

// ======= 兼容入口 (严格按v8.1排版) =======
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
