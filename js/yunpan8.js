/**
 * 海绵小站前端插件 - v12.1 (兼容返回结构修复版)
 *
 * 更新说明:
 * - 修复: $fetch.post 返回结构不统一导致 backendResult 取值为 undefined。
 * - 新增: 自动兼容三种情况 (对象 / {data:对象} / 字符串)。
 *
 * @version 12.1
 */

// ★★★★★【用户配置区】★★★★★
const BACKEND_API_URL = "http://192.168.1.2:3000/reply";
// ★★★★★★★★★★★★★★★★★★★

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";
const COOKIE = "bbs_sid=u55b2g9go9dhrv2l8jbfi4ulbu;bbs_token=zMnlkGz9EkrmRT33Qx1Cf9uUtOiR0_2B_2Ff6Pxdv4W1aXzNIGTH;";

// --- 辅助函数 ---
function log(msg ) {
    try { $log(`[海绵小站 v12.1] ${msg}`); } catch (_) { console.log(`[海绵小站 v12.1] ${msg}`); }
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

// --- getConfig ---
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

function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

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
// =================== getTracks (最终版 - 兼容返回结构) ===================
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
            
            const response = await $fetch.post(BACKEND_API_URL, { url: url }, {
                headers: { 'Content-Type': 'application/json' }
            });

            // ★ 修复点：兼容多种返回结构
            let backendResult;
            try {
                backendResult = typeof response === "string"
                    ? JSON.parse(response)
                    : response.data
                        ? response.data
                        : response;
            } catch (e) {
                backendResult = null;
            }

            if (!backendResult || backendResult.success !== true) {
                const errorMsg = `后端解锁失败: ${backendResult ? backendResult.message : '无有效响应'}`;
                log(errorMsg);
                $utils.toastError(errorMsg, 5000);
                return jsonify({ list: [{ title: '错误', tracks: [{ name: errorMsg, pan: '', ext: {} }] }] });
            }

            log("后端解锁成功！前端开始验证解锁状态...");
            let unlocked = false;
            for (let i = 0; i < 3; i++) {
                await $utils.sleep(2000);
                log(`第 ${i + 1} 次尝试获取解锁后页面...`);
                const retryResponse = await fetchWithCookie(detailUrl);
                const pageContent = retryResponse.data;
                if (!pageContent.includes("回复后")) {
                    log("验证成功！页面已解锁。");
                    data = pageContent;
                    unlocked = true;
                    break;
                }
                log("页面仍未解锁，继续等待和重试...");
            }

            if (!unlocked) {
                const errorMsg = "前端验证失败：后端已回帖，但页面状态未更新。";
                log(errorMsg);
                $utils.toastError(errorMsg, 5000);
                return jsonify({ list: [{ title: '错误', tracks: [{ name: errorMsg, pan: '', ext: {} }] }] });
            }
            
            $ = cheerio.load(data);
        } else {
            log("内容无需解锁，直接解析。");
        }

        // --- 资源解析逻辑 (保持原样) ---
        const mainMessage = $(".message[isfirst='1']");
        if (!mainMessage.length) return jsonify({ list: [] });
        const linkNodes = mainMessage.find("a[href*='cloud.189.cn'], a[href*='pan.quark.cn']");
        const resultsMap = new Map();
        const numMap = {'零':'0','〇':'0','一':'1','壹':'1','依':'1','二':'2','贰':'2','三':'3','叁':'3','四':'4','肆':'4','五':'5','伍':'5','吴':'5','吾':'5','无':'5','武':'5','悟':'5','舞':'5','物':'5','乌':'5','屋':'5','唔':'5','雾':'5','勿':'5','误':'5','污':'5','务':'5','午':'5','捂':'5','戊':'5','毋':'5','邬':'5','兀':'5','六':'6','陆':'6','七':'7','柒':'7','八':'8','捌':'8','九':'9','玖':'9','久':'9','酒':'9','Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
        const charMap = {'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ᵂ':'w','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
        function purify(raw) { const codeMatch = raw.match(/(?:访问码|提取码|密码)\s*[:：\s]*([\s\S]+)/); const extracted = codeMatch ? codeMatch[1].trim() : raw.trim(); let converted = ''; for (const c of extracted) { converted += numMap[c] || charMap[c] || c; } const finalMatch = converted.match(/^[a-zA-Z0-9]+/); return finalMatch ? finalMatch[0].toLowerCase() : null; }
        linkNodes.each((_, node) => { const link = $(node).attr("href"); let code = null; let el = $(node).closest("p, div, h3"); if (!el.length) el = $(node); const searchEls = [el]; let next = el.next(); for (let i = 0; i < 3 && next.length; i++) { searchEls.push(next); next = next.next(); } for (const e of searchEls) { const text = e.text().trim(); if (text.match(/(?:访问码|提取码|密码)/)) { const found = purify(text); if (found) { code = found; break; } } if (!text.includes("http" ) && !text.includes("/") && !text.includes(":")) { const found = purify(text); if (found && /^[a-z0-9]{4,8}$/i.test(found)) { code = found; break; } } } const existing = resultsMap.get(link); if (!existing || (!existing.code && code)) { resultsMap.set(link, { link, code }); } });
        const tracks = [];
        resultsMap.forEach(record => { const finalPan = record.code ? `${record.link}（访问码：${record.code}）` : record.link; tracks.push({ name: "网盘", pan: finalPan, ext: { pwd: record.code || '' } }); });
        if (tracks.length === 0) tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        const errorMsg = `操作失败: ${e.message}. 请检查网络和后端服务状态。`;
        log(errorMsg);
        $utils.toastError(errorMsg, 8000);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: errorMsg, pan: '', ext: {} }] }] });
    }
}
// =================================================================================

// ======= search =======
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

// ======= 兼容入口 =======
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
