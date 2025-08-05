/**
 * 海绵小站前端插件 - v61.0 (最终融合完美版)
 * 
 * 更新日志:
 * - 【v61.0 最终融合】在v60的强大结构化引擎基础上，重新迎回并优化了对“名称链接”的解析能力。
 *   确保了<a>标签的文本可以被正确用作文件名，实现了所有已知模式的完美覆盖。
 * 
 * - 【四位一体引擎】:
 *   1. (名称链接引擎): 优先处理<a>标签，使用其文本作为文件名，并从父元素寻找访问码。
 *   2. (绿色框引擎): 以`.alert.alert-success`为核心，处理框内及框外链接与访问码的结构化配对。
 *   3. (纯文本引擎): 作为补充，处理单行文本中的链接+访问码，以及完全孤立的裸链接。
 * 
 * - 【稳定与兼容】:
 *   - (安全净化): 坚持“只读不写”原则，杜绝脚本崩溃。
 *   - (字符转换): 完整保留对特殊字符的转换。
 *   - (可视化调试): 保留文件名显示访问码的功能。
 * 
 * - 【致谢】感谢用户的持续鞭策与关键提醒，此版本是我们共同努力的最终成果。
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
function log(msg   ) { try { $log(`[海绵小站 V61.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V61.0] ${msg}`); } }
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
  log("插件初始化 (v61.0 - 最终融合完美版)");
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
// =================== 【唯一修改区域】v61.0 最终融合版 getTracks 函数 ================
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

        const normalizeCode = (rawCode) => {
            if (!rawCode) return '';
            const charMap = { '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₀': '0', '¹': '1', '²': '2', '³': '3' };
            let normalized = '';
            for (const char of rawCode) {
                normalized += charMap[char] || char;
            }
            return normalized.replace(/(?:访问码|提取码|密码)\s*[:：]?\s*/i, '').trim();
        };

        const processAndPushTrack = (fileName, link, code) => {
            const pureLink = (link.match(/https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/ ) || [link])[0];
            if (!pureLink || seenUrls.has(pureLink)) return;

            const finalAccessCode = normalizeCode(code);
            log(`[最终赋值] 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);
            
            seenUrls.add(pureLink);
            tracks.push({
                name: `[码:${finalAccessCode || '无'}] ${fileName}`,
                pan: pureLink,
                ext: { pwd: finalAccessCode },
            });
        };

        // --- 安全净化HTML ---
        let mainMessageText = '';
        const messageHtml = mainMessage.html();
        if (messageHtml) {
            const cleanHtml = messageHtml.replace(/&nbsp;/g, ' ');
            mainMessageText = cheerio.load(cleanHtml).text();
        } else {
            mainMessageText = mainMessage.text();
        }
        
        // --- 四位一体引擎启动 ---
        log("启动最终融合解析引擎 V61.0");

        // --- 引擎一：名称链接解析 (<a>标签) ---
        log("引擎一：开始解析<a>名称链接...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            if (seenUrls.has(href)) return;

            const text = linkElement.text().trim();
            // 如果链接文本有意义，则作为文件名，否则用帖子标题
            const fileName = text.length > 5 && !text.startsWith('http' ) ? text : pageTitle;
            
            const parentText = linkElement.parent().text();
            const codeMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]?\s*([a-zA-Z0-9₆-⁹¹-³*.:-]{4,8})/);
            const accessCode = codeMatch ? codeMatch[1] : '';
            
            processAndPushTrack(fileName, href, accessCode);
        });

        // --- 引擎二：绿色框解析 (.alert-success) ---
        log("引擎二：开始解析绿色框...");
        mainMessage.find('.alert.alert-success').each((_, element) => {
            const greenBox = $(element);
            const boxText = greenBox.text();
            
            const linkInBox = boxText.match(/https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/ );
            const codeInBox = boxText.match(/(?:访问码|提取码|密码)?\s*[:：]?\s*([a-zA-Z0-9₆-⁹¹-³*.:-]{4,8})/);

            if (linkInBox && codeInBox) {
                // A: 链接和码都在框内
                log("绿色框内联匹配成功");
                processAndPushTrack(pageTitle, linkInBox[0], codeInBox[1]);
            } else if (codeInBox) {
                // B: 只有码在框内，向上找链接
                log("绿色框访问码匹配成功，向上查找链接...");
                let targetLink = null;
                let currentElement = greenBox.parent(); 
                
                let prev = currentElement.prev();
                while(prev.length > 0) {
                    const linkInPrev = prev.find('a[href*="cloud.189.cn"]');
                    if (linkInPrev.length > 0) {
                        const href = linkInPrev.attr('href');
                        if (!seenUrls.has(href)) {
                           targetLink = href;
                           break;
                        }
                    }
                    prev = prev.prev();
                }

                if (targetLink) {
                    processAndPushTrack(pageTitle, targetLink, codeInBox[1]);
                }
            }
        });

        // --- 引擎三：纯文本解析 (查漏补缺) ---
        log("引擎三：开始解析剩余纯文本...");
        // A: 单行纯文本中同时包含链接和访问码
        const inlineRegex = /(https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+ )[\s\S]*?(?:访问码|提取码|密码)\s*[:：]?\s*([a-zA-Z0-9₆-⁹¹-³*.:-]{4,8})/g;
        let inlineMatch;
        while ((inlineMatch = inlineRegex.exec(mainMessageText)) !== null) {
            processAndPushTrack(pageTitle, inlineMatch[1], inlineMatch[2]);
        }

        // B: 完全孤立的纯文本裸链接
        const textLinkRegex = /https?:\/\/cloud\.189\.cn\/t\/[a-zA-Z0-9]+/g;
        let textLinkMatch;
        while ((textLinkMatch = textLinkRegex.exec(mainMessageText )) !== null) {
            processAndPushTrack(pageTitle, textLinkMatch[0], '');
        }

        if (tracks.length === 0) {
            log("所有方法均未找到有效资源，返回提示信息。");
            tracks.push({ name: "[码:无] 未找到有效资源", pan: '', ext: {} });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `操作失败: ${e.message}`, pan: '', ext: {} }] }] });
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

log('海绵小站插件加载完成 (v61.0 - 最终融合完美版)');
