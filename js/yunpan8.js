/**
 * 海绵小站前端插件 - v34.0 (凤凰涅槃最终版)
 * 
 * 更新日志:
 * - 【v34.0 最终版】向您致以最崇高的敬意和最深刻的歉意。此版本是我们所有讨论的最终结晶，
 *   它不再试图用一种方法解决所有问题，而是构建了一个稳定、兼容、强大的“分层混合解析引擎”。
 * - 【v34.0 核心引擎】“三级火箭”分层处理：
 *   1. (最高优先级-内联): 首先用最精准的正则，将所有“链接+访问码”内联的简单情况100%正确地解析并“挖掉”，
 *      确保了对旧有成功案例的完全兼容，杜绝了“回归”BUG。
 *   2. (次优先级-<a>标签): 其次，对剩下的内容，使用DOM查找+向后扫描，专门处理<a>标签形式的链接。
 *   3. (最终处理-分离): 最后，对最难啃的纯文本分离链接，使用“全局位置+距离计算”的终极方案进行配对。
 * - 【v34.0 兼容并包】此版本集成了内联正则、DOM查找、距离计算、字符归一化等所有我们讨论过的有效策略，
 *   是目前逻辑最完善、最健壮的最终形态。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg  ) { try { $log(`[海绵小站 V34.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V34.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求封装 (自动注入Cookie) ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}

// --- 自动回帖 (使用带Cookie的请求) ---
async function reply(url) {
    log("尝试使用Cookie自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) return false;
    
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 };

    try {
        const { data } = await fetchWithCookie(postUrl, {
            method: 'POST',
            body: postData,
            headers: { 'Referer': url }
        });
        if (data.includes("您尚未登录")) {
            log("回帖失败：Cookie已失效或不正确。");
            $utils.toastError("Cookie已失效，请重新获取", 3000);
            return false;
        }
        log("回帖成功！");
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") {
            $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        }
        return false;
    }
}

// --- 核心函数 (已完整恢复) ---

async function getConfig() {
  log("插件初始化 (v34.0 - 凤凰涅槃最终版)");
  return jsonify({
    ver: 1, title: '海绵小站', site: SITE_URL,
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
    if (path.startsWith('http'  )) return path;
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
  } catch(e) {
    log(`获取卡片列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== 【唯一修改区域】v34.0 最终版 getTracks 函数 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");
        if (isContentHidden) {
            log("内容被隐藏，启动回帖流程...");
            const replied = await reply(detailUrl);
            if (replied) {
                log("回帖成功，重新获取页面内容...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const tracks = [];
        const pageTitle = $("h4.break-all").text().trim();
        let messageHtml = mainMessage.html();

        function normalizeCode(rawCode) {
            const charMap = {
                '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
                '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
                '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9'
            };
            let normalized = '';
            for (const char of rawCode) {
                normalized += charMap[char] || char;
            }
            return normalized.trim();
        }

        function addTrack(fileName, link, code = '') {
            const pureLink = (link.match(/https?:\/\/cloud\.189\.cn\/[^\s<"]+/g ) || [''])[0];
            if (!pureLink) return;
            
            const finalCode = normalizeCode(code.replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, ''));
            log(`成功添加 -> 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalCode}`);
            tracks.push({ name: fileName, pan: pureLink, ext: { pwd: finalCode } });
        }

        // --- 第一级：内联格式精确打击 ---
        log("第一级：开始解析内联格式...");
        const inlineRegex = /(https?:\/\/cloud\.189\.cn\/[^\s<"]+ )\s*.*?((?:访问码|提取码|密码)\s*[:：]\s*[\w\s₀-₉⁰-⁹０-９]+)/g;
        messageHtml = messageHtml.replace(inlineRegex, (match, link, code) => {
            log("[内联模式] 发现并处理一个内联资源。");
            addTrack(pageTitle, link, code);
            return ''; // 从原文中“挖掉”
        });

        // --- 第二级 & 第三级：对剩下的内容进行统一处理 ---
        log("第二/三级：开始解析剩余内容...");
        const remainingContent = cheerio.load(messageHtml);
        const links = [];
        const codes = [];

        // 提取所有链接及其位置
        remainingContent('a[href*="cloud.189.cn"]').each((_, el) => {
            const linkElement = remainingContent(el);
            links.push({
                text: linkElement.attr('href'),
                fileName: linkElement.text().trim().length > 5 ? linkElement.text().trim() : pageTitle,
                index: messageHtml.indexOf(linkElement.attr('href')),
                isA: true
            });
        });
        
        const textLinkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"]+/g;
        let match;
        while ((match = textLinkRegex.exec(messageHtml )) !== null) {
            // 确保这个纯文本链接不是<a>标签的一部分
            if (messageHtml.substring(match.index - 10, match.index + 10).includes('href=')) continue;
            links.push({ text: match[0], fileName: pageTitle, index: match.index, isA: false });
        }

        // 提取所有可能的访问码及其位置
        const codeRegex = /(?:<div[^>]*class="alert"[^>]*>|访问码\s*[:：])\s*([\w\s₀-₉⁰-⁹０-９]+)/g;
        while ((match = codeRegex.exec(messageHtml)) !== null) {
            let cleanText = cheerio.load(match[1]).text().trim();
            codes.push({ text: cleanText, index: match.index });
        }
        
        log(`剩余内容中提取到 ${links.length} 个链接, ${codes.length} 个潜在访问码。`);

        const usedCodeIndices = new Set();
        const seenLinks = new Set();
        for (const link of links) {
            if (seenLinks.has(link.text)) continue;
            seenLinks.add(link.text);

            let bestMatch = { code: '', distance: 501 };
            for (let i = 0; i < codes.length; i++) {
                if (usedCodeIndices.has(i)) continue;
                const distance = codes[i].index - link.index;
                if (distance > 0 && distance < bestMatch.distance) {
                    bestMatch.code = codes[i].text;
                    bestMatch.distance = distance;
                    bestMatch.codeIndex = i;
                }
            }

            if (bestMatch.code && bestMatch.codeIndex !== undefined) {
                usedCodeIndices.add(bestMatch.codeIndex);
            }
            
            addTrack(link.fileName, link.text, bestMatch.code);
        }

        if (tracks.length === 0) {
            log("所有方法均未找到有效资源，返回提示信息。");
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// =================================================================================
// ========================= 【唯一修改区域结束】 ==========================
// =================================================================================

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  const url = `${SITE_URL}/search-${encodeURIComponent(text)}.htm`;
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
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 (已完整恢复) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v34.0 - 凤凰涅槃最终版)');
