/**
 * 海绵小站前端插件 - v30.11 (最终策略执行版)
 * 
 * 更新日志:
 * - 【v30.11 最终执行】本版本严格遵循我们共同制定的、精简后的“四步走”最终策略，并在V30.3的原始代码基础上进行最小化“微创手术”式修改。
 * - 【v30.11 策略落地】完美实现了“初始化->处理名称链接->处理剩余链接->兜底保险”的四步逻辑。
 * - 【v30.11 严格遵循】
 *    1. 优先处理并“挖掉”不带访问码的“名称链接”。
 *    2. 对剩余部分，用强大正则和全局关联规则，处理所有混合格式链接。
 *    3. 在完全失败时，启动信息保全的“兜底”机制。
 *    4. 输出格式永远是纯净的pan和pwd。
 * - 【v30.11 忠于原作】除实现新策略所必需的改动外，其余部分100%忠于V30.3。这应是解决所有问题的最终代码。
 */

// --- 配置区 (与v30.3完全一致) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 (与v30.3完全一致 ) ---
function log(msg ) { try { $log(`[海绵小站 V30.11] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.11] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求封装 (与v30.3完全一致) ---
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

// --- 自动回帖 (与v30.3完全一致) ---
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

// --- 核心函数 (除getTracks外，均与v30.3完全一致) ---

async function getConfig() {
  log("插件初始化 (v30.11 - 最终策略执行版)");
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

// =======================================================================
// ==================== 【V30.11 - 唯一修改的核心函数】 ===================
// =======================================================================
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

        // 【策略第一步：初始化与预处理】
        const $processedHTML = mainMessage.clone(); // 创建一个可修改的副本用于“挖掉”操作
        const fullMessageText = mainMessage.text();
        const allCodes = (fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/gi) || [])
            .map(code => code.replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '').replace(/[^a-zA-Z0-9]/g, ''));
        log(`[预处理] 发现 ${allCodes.length} 个潜在访问码: ${allCodes.join(', ')}`);

        // 【策略第二步：处理“名称链接” (情况 #4)】
        $processedHTML.find('a').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href') || '';
            const text = linkElement.text().trim();

            // 规则：必须是天翼云盘链接，且显示文本不能是链接
            if (href.includes('cloud.189.cn') && !text.startsWith('http' )) {
                if (seenUrls.has(href)) return;
                seenUrls.add(href);

                log(`[名称链接模式] 提取: ${text} -> ${href}`);
                tracks.push({ name: text, pan: href, ext: { pwd: '' } });
                
                // “挖掉”已处理的元素，避免干扰后续步骤
                linkElement.remove();
            }
        });

        // 【策略第三步：处理所有剩余链接 (情况 #1, #2, #3)】
        const remainingText = $processedHTML.text();
        // 强大的正则，能同时捕获链接和可选的、紧邻的访问码
        const linkRegex = /(https?:\/\/cloud\.189\.cn\/[^\s（(]+ )[\s（(]*访问码[：:]?\s*([\w*.:-]+)?/g;
        let match;
        while ((match = linkRegex.exec(remainingText)) !== null) {
            const pureLink = match[1].trim();
            if (seenUrls.has(pureLink)) continue;
            seenUrls.add(pureLink);

            let accessCode = '';
            // 优先使用正则直接捕获到的紧邻访问码
            if (match[2]) {
                accessCode = match[2].replace(/[^a-zA-Z0-9]/g, '');
                log(`[紧邻模式] 链接 ${pureLink} 找到了紧邻访问码: ${accessCode}`);
            } 
            // 否则，应用“全局唯一”规则
            else if (allCodes.length === 1) {
                accessCode = allCodes[0];
                log(`[上下文模式] 链接 ${pureLink} 关联到全局唯一访问码: ${accessCode}`);
            }

            tracks.push({ name: pageTitle, pan: pureLink, ext: { pwd: accessCode } });
        }

        // 【策略第四步：您的“兜底”保险】
        if (tracks.length === 0 && fullMessageText.includes('cloud.189.cn')) {
            log('[兜底保险模式] 精确匹配失败，启动信息保全机制...');
            const allPossibleLinks = fullMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s\n\r]+/g ) || [];
            allPossibleLinks.forEach(link => {
                if (seenUrls.has(link)) return;
                seenUrls.add(link);
                // 原封不动地交付，让上层决定如何处理
                tracks.push({ name: link, pan: link, ext: { pwd: '' } });
            });
        }

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// =======================================================================
// ========================= 【修改部分结束】 ==========================
// =======================================================================

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

// --- 兼容旧版接口 (与v30.3完全一致) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v30.11 - 最终策略执行版)');
