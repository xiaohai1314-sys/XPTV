/**
 * 海绵小站前端插件 - v46.0 (重构核心解析函数版)
 * 
 * 更新日志:
 * - 【v46.0 重构核心】在v45.0成功逻辑的基础上，不再对其进行任何修改。
 *   而是重写了最核心的 processAndPushTrack 函数，用一个全新的、更强大、逻辑更清晰的
 *   解析引擎来处理所有数据清洗和赋值，以应对各种复杂情况。
 * - 【新引擎特性】
 *   1. (链接清洗): 强制从原始链接中剥离所有已知的干扰词和后续文本。
 *   2. (访问码标准化): 增强对特殊字符(上下标)、空格的识别和转换能力。
 *   3. (逻辑解耦): 将数据处理逻辑完全封装，不再与外部逻辑耦合，提高稳定性。
 * - 【v45.0 稳定基石】新引擎建立在v45.0已被验证成功的稳定架构之上。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg   ) { try { $log(`[海绵小站 V46.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V46.0] ${msg}`); } }
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
  log("插件初始化 (v46.0 - 重构核心解析函数版)");
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
    if (path.startsWith('http'   )) return path;
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
// =================== 【唯一修改区域】v46.0 重构版 getTracks 函数 ===================
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
        const seenUrls = new Set();
        const pageTitle = $("h4.break-all").text().trim();

        // ★★★ 【全新重构的核心解析函数】 ★★★
        const processAndPushTrack = (fileName, rawLink, accessCode = '') => {
            if (!rawLink) return;

            // 1. 清洗链接：从原始链接中提取纯净的URL
            const linkMatch = rawLink.match(/https?:\/\/cloud\.189\.cn\/[^\s（(]+/ );
            if (!linkMatch) return; // 如果没有有效的链接头，直接放弃
            const pureLink = linkMatch[0];

            if (seenUrls.has(pureLink)) return; // 防止重复添加

            // 2. 清洗和标准化访问码
            const normalizeCode = (rawCode) => {
                if (!rawCode) return '';
                const charMap = {
                    '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₀': '0',
                    '¹': '1', '²': '2', '³': '3',
                };
                let normalized = '';
                // 先移除所有非访问码有效字符，包括空格、冒号等
                const cleanedCode = rawCode.replace(/[^a-zA-Z0-9\u2080-\u2089\u00B9\u00B2\u00B3]/g, '');
                for (const char of cleanedCode) {
                    normalized += charMap[char] || char;
                }
                return normalized;
            };
            const finalAccessCode = normalizeCode(accessCode);

            log(`[最终赋值] 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);
            
            seenUrls.add(pureLink);
            tracks.push({
                name: fileName,
                pan: pureLink,
                ext: { pwd: finalAccessCode },
            });
        };

        // --- 引擎一：处理<a>标签 (完全复刻v45.0逻辑) ---
        log("引擎一：开始解析<a>标签(名称链接)...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            
            const text = linkElement.text().trim();
            let fileName = text.length > 5 ? text : pageTitle;
            
            const parentText = linkElement.parent().text();
            const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            let accessCode = '';
            if (preciseMatch && preciseMatch[1]) {
                accessCode = preciseMatch[1];
            }
            processAndPushTrack(fileName, href, accessCode);
        });
        log("引擎一：<a>标签解析完成。");

        // --- 引擎二：处理剩余纯文本链接 (完全复刻v45.0逻辑) ---
        log("引擎二：开始解析剩余纯文本链接...");
        const mainMessageText = mainMessage.text();

        const allLinksInMessage = (mainMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g  ) || []);
        const isolatedLinks = allLinksInMessage.filter(link => {
            const pureLinkMatch = link.match(/https?:\/\/cloud\.189\.cn\/[^\s（(]+/ );
            return pureLinkMatch && !seenUrls.has(pureLinkMatch[0]);
        });

        if (isolatedLinks.length > 0) {
            // ★ 使用能兼容换行的正则表达式
            const codeRegex = /(?:访问码|提取码|密码)[\s\S]{0,15}([\w*.:-]+)/g;
            let potentialCodes = [];
            let match;
            while ((match = codeRegex.exec(mainMessageText)) !== null) {
                potentialCodes.push(match[1]);
            }
            
            const usedCodes = new Set(tracks.map(t => t.ext.pwd).filter(Boolean));
            const availableCodes = potentialCodes.filter(c => !usedCodes.has(c));
            
            log(`在主楼中发现 ${isolatedLinks.length} 个孤立链接和 ${availableCodes.length} 个可用访问码: ${JSON.stringify(availableCodes)}`);

            for (let i = 0; i < isolatedLinks.length; i++) {
                const link = isolatedLinks[i];
                const code = availableCodes[i] || '';
                processAndPushTrack(pageTitle, link, code);
            }
        }
        log("引擎二：纯文本链接解析完成。");

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
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.trim() || "",
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

log('海绵小站插件加载完成 (v46.0 - 重构核心解析函数版)');
