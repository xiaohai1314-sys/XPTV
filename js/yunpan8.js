/**
 * 海绵小站前端插件 - v17.0 (最终完整版)
 * 
 * 版本说明:
 * - v17.0: 【完整发布】根据您的指示，将v16.0版本最完善的getTracks核心逻辑，
 *         完整地嵌入到经过验证的V7.0稳定框架中，形成最终的、可直接替换的完整插件。
 *         这应是解决所有已知问题的最终版本。
 */

// --- 配置区 (来自V7.0) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X     ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = $cheerio;
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请将这里的Cookie字符串 ，替换为您自己获取的、最新的有效Cookie
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=ovaqn33d3msc6u1ht3cf3chu4p;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754329315,1754403914,1754439300,1754546919;HMACCOUNT=A4FF248A8A431217;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754546923;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 (来自V7.0) ---
function log(msg) { 
    try { 
        $log(`[海绵小站 v17.0] ${msg}`); 
    } catch (_) { 
        console.log(`[海绵小站 v17.0] ${msg}`); 
    } 
}
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求与回帖 (来自V7.0) ---
async function fetchWithCookie(url, options = {}) { if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) { $utils.toastError("请先在插件脚本中配置Cookie", 3000); throw new Error("Cookie not configured."); } const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers }; const finalOptions = { ...options, headers }; if (options.method === 'POST') { return $fetch.post(url, options.body, finalOptions); } return $fetch.get(url, finalOptions); }
async function reply(url) { log("尝试使用Cookie自动回帖..."); const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"]; const threadIdMatch = url.match(/thread-(\d+)/); if (!threadIdMatch) return false; const threadId = threadIdMatch[1]; const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`; const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 }; try { const { data } = await fetchWithCookie(postUrl, { method: 'POST', body: postData, headers: { 'Referer': url } }); if (data.includes("您尚未登录")) { log("回帖失败：Cookie已失效或不正确。"); $utils.toastError("Cookie已失效，请重新获取", 3000); return false; } log("回帖成功！"); return true; } catch (e) { log(`回帖请求异常: ${e.message}`); if (e.message !== "Cookie not configured.") { $utils.toastError("回帖异常，请检查网络或Cookie", 3000); } return false; } }

// --- 核心函数 (来自V7.0) ---
async function getConfig() { log("插件初始化 (v17.0 最终完整版)"); return jsonify({ ver: 17.0, title: '海绵小站', site: SITE_URL, tabs: [ { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } }, { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } }, ], }); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http' )) return path; const cleanPath = path.startsWith('./') ? path.substring(2) : path; return `${SITE_URL}/${cleanPath}`; }
async function getCards(ext) { ext = argsify(ext); const { page = 1, id } = ext; const url = `${SITE_URL}/${id}-${page}.htm`; try { const { data } = await fetchWithCookie(url); const $ = cheerio.load(data); const cards = []; $("ul.threadlist > li.media.thread").each((_, item) => { const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src"); cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } }); }); return jsonify({ list: cards }); } catch(e) { log(`获取卡片列表异常: ${e.message}`); return jsonify({ list: [] }); } }

// =================================================================================
// =================== 【v17.0 最终完整版】 getTracks 函数 ===================
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
            log("内容被隐藏，启动回帖流程...");
            if (await reply(detailUrl)) {
                log("回帖成功，重新获取页面内容...");
                await $utils.sleep(1000); 
                data = (await fetchWithCookie(detailUrl)).data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        let mainMessage;
        const selectors = [ '[isfirst="1"]', '.message.break-all[isfirst="1"]', '.message[isfirst="1"]' ];
        for (const selector of selectors) {
            mainMessage = $(selector);
            if (mainMessage.length > 0) {
                log(`成功定位主楼层，使用选择器: "${selector}"`);
                break; 
            }
        }

        if (!mainMessage || mainMessage.length === 0) {
            log("致命错误：无法找到主楼层内容。");
            return jsonify({ list: [{ title: '错误', tracks: [{ name: "插件失效，无法定位内容区域", pan: '', ext: {} }] }] });
        }

        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        const tracks = [];

        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex ) || [])];
        
        let codePool = [];
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        let match;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) { const code = match[1].trim(); if (code.length < 15 && !code.includes('http' )) { codePool.push(code); } }
        if (codePool.length === 0) { const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g; while ((match = textCodeRegex.exec(mainMessageText)) !== null) { codePool.push(match[1].trim()); } }
        if (codePool.length === 0) { log("标准提取失败，启用兜底策略..."); const fallbackRegex = /(?:访问码|提取码|密码)\s*[:：]\s*(.+)/g; while ((match = fallbackRegex.exec(mainMessageText)) !== null) { codePool.push(match[1].trim()); } }
        
        const finalNumMap = { '零': '0', '〇': '0', '一': '1', '壹': '1', '依': '1', '二': '2', '贰': '2', '三': '3', '叁': '3', '四': '4', '肆': '4', '五': '5', '伍': '5', '吴': '5', '吾': '5', '无': '5', '武': '5', '悟': '5', '舞': '5', '物': '5', '乌': '5', '屋': '5', '唔': '5', '雾': '5', '勿': '5', '误': '5', '污': '5', '务': '5', '午': '5', '捂': '5', '戊': '5', '毋': '5', '邬': '5', '兀': '5', '六': '6', '陆': '6', '七': '7', '柒': '7', '八': '8', '捌': '8', '九': '9', '玖': '9', '久': '9', '酒': '9', 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10', '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
        const finalCharMap = { 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z', 'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵀ': 'T', 'ᵁ': 'U', 'ᵂ': 'W', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x' };

        const cleanCodePool = codePool.map(rawCode => {
            let translatedCode = '';
            for (const char of rawCode) {
                translatedCode += finalNumMap[char] || finalCharMap[char] || char;
            }
            const sanitizedCode = (translatedCode.match(/[a-zA-Z0-9]/g) || []).join('');
            if (rawCode !== sanitizedCode) {
                log(`两步净化: "${rawCode}" -> (翻译) -> "${translatedCode}" -> (消毒) -> "${sanitizedCode}"`);
            }
            return sanitizedCode;
        });
        codePool = [...new Set(cleanCodePool)];
        log(`最终采集到 ${codePool.length} 个净化后的访问码: ${JSON.stringify(codePool)}`);

        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                link = (link.match(/[!-~]+/g) || []).join('');
                const code = codePool[index] || '';
                const fileName = "网盘";
                let finalPan;
                if (code) {
                    finalPan = `${link}（访问码：${code}）`;
                } else {
                    finalPan = link;
                }
                log(`最终组合结果: "${finalPan}"`);
                tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' }, });
            });
        }

        if (tracks.length === 0) { log("未找到有效资源。"); tracks.push({ name: "未找到有效资源", pan: '', ext: {} }); }
        log(`处理完成，共生成 ${tracks.length} 个资源。`);
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// =================================================================================

// 搜索功能 (来自V7.0)
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    if (!text) return jsonify({ list: [] });

    const searchCache = $storage.get('haimian_search_cache') || {};
    if (searchCache.keyword !== text) {
        $storage.put('haimian_search_cache', { keyword: text, data: [], pagecount: 0, total: 0 });
    }
    const cache = $storage.get('haimian_search_cache');

    if (cache.data[page - 1]) {
        log(`从缓存中获取搜索结果，关键词: ${text}, 页码: ${page}`);
        return jsonify({ list: cache.data[page - 1], pagecount: cache.pagecount, total: cache.total });
    }
    if (cache.pagecount > 0 && page > cache.pagecount) {
        return jsonify({ list: [], pagecount: cache.pagecount, total: cache.total });
    }

    let url;
    if (page === 1) {
        url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
    } else {
        url = `${SITE_URL}/search-${encodeURIComponent(text)}-1-0-${page}.htm`;
    }
    log(`开始搜索，关键词: ${text}, 页码: ${page}, URL: ${url}`);

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

        const pageText = $("li.page-item.active > a.page-link").text();
        const pageMatch = pageText.match(/(\d+)\s*\/\s*(\d+)/);
        let pageCount = cache.pagecount;
        if (pageMatch) {
            pageCount = parseInt(pageMatch[2], 10);
        }

        cache.data[page - 1] = cards;
        cache.pagecount = pageCount;
        $storage.put('haimian_search_cache', cache);

        return jsonify({ list: cards, pagecount: pageCount });
    } catch (e) {
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}
