/**
 * 海绵小站前端插件 - v45.7 (双引擎融合最终版)
 * 
 * 更新日志:
 * - 【v45.7 双引擎融合最终版】此版本为问题的最终解决方案，融合了此前所有版本的优点。
 *   1. (引擎一：局部优先): 优先处理链接和访问码在同一父元素内的“名称链接”，保证最高准确性并标记已用数据。
 *   2. (引擎二：孤立武断): 处理引擎一剩下的所有孤立元素。如果孤立访问码只有一个，则强行分配给第一个孤立链接。
 *   此双引擎模型各司其职，互不干扰，完美覆盖“一体式”和“分离式”的所有已知情况。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=rd8nluq3qbcpg5e5sfb5e08pbg;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316688,1754316727,1754329315,1754403914;HMACCOUNT=CEAB3CBE53C875F2;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754403929;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg   ) { try { $log(`[海绵小站 V45.7] ${msg}`); } catch (_) { console.log(`[海绵小站 V45.7] ${msg}`); } }
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
  log("插件初始化 (v45.7 - 双引擎融合最终版)");
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
// =================== 【唯一修改区域】v45.7 双引擎融合最终版 getTracks 函数 ===================
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
        const pageTitle = $("h4.break-all").text().trim();
        const tracks = [];
        const seenUrls = new Set();
        const usedCodes = new Set();

        // --- 引擎一：局部优先，处理“名称链接” ---
        log("引擎一：启动局部优先匹配（处理名称链接）...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            if (!href || seenUrls.has(href)) return;

            const parentText = linkElement.parent().text();
            const codeMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            
            if (codeMatch && codeMatch[1]) {
                const accessCode = codeMatch[1].trim();
                const fileName = linkElement.text().trim() || pageTitle;
                
                log(`[引擎一] 局部匹配成功 - 文件名: ${fileName}, 链接: ${href}, 访问码: ${accessCode}`);
                tracks.push({ name: fileName, pan: href, ext: { pwd: accessCode } });
                seenUrls.add(href);
                usedCodes.add(accessCode);
            }
        });
        log("引擎一：局部优先匹配完成。");

        // --- 引擎二：孤立武断，处理剩余的分离元素 ---
        log("引擎二：启动孤立元素匹配...");
        
        // 1. 收集所有孤立链接（未被引擎一处理的）
        const isolatedLinks = [];
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href && !seenUrls.has(href)) {
                isolatedLinks.push({ value: href, text: $(element).text().trim() });
                seenUrls.add(href);
            }
        });
        const mainMessageText = mainMessage.text();
        const textLinks = mainMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g ) || [];
        textLinks.forEach(link => {
            if (!seenUrls.has(link)) {
                isolatedLinks.push({ value: link, text: '' });
                seenUrls.add(link);
            }
        });

        // 2. 收集所有孤立访问码（未被引擎一使用的）
        const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
        const isolatedCodes = [];
        let match;
        while ((match = codeRegex.exec(mainMessageText)) !== null) {
            const potentialCode = match[1].trim();
            if (!usedCodes.has(potentialCode)) {
                isolatedCodes.push(potentialCode);
            }
        }
        
        log(`[引擎二] 发现 ${isolatedLinks.length} 个孤立链接和 ${isolatedCodes.length} 个孤立访问码。`);

        // 3. 执行孤立分配逻辑
        if (isolatedLinks.length > 0) {
            if (isolatedCodes.length === 1) {
                // **武断策略**：如果只有一个孤立访问码，则认为它属于第一个孤立链接
                log("[引擎二] 检测到唯一孤立访问码，执行强行匹配策略。");
                const linkInfo = isolatedLinks[0];
                const accessCode = isolatedCodes[0];
                const fileName = linkInfo.text || pageTitle;
                tracks.push({ name: fileName, pan: linkInfo.value, ext: { pwd: accessCode } });
                // 将剩余链接作为无访问码链接添加
                for (let i = 1; i < isolatedLinks.length; i++) {
                    const remainingLink = isolatedLinks[i];
                    tracks.push({ name: remainingLink.text || pageTitle, pan: remainingLink.value, ext: { pwd: '' } });
                }
            } else {
                // 默认的顺序分配逻辑，适用于多个孤立链接和多个孤立访问码的情况
                log("[引擎二] 执行默认顺序分配策略。");
                isolatedLinks.forEach((linkInfo, index) => {
                    const accessCode = isolatedCodes[index] || '';
                    const fileName = linkInfo.text || pageTitle;
                    tracks.push({ name: fileName, pan: linkInfo.value, ext: { pwd: accessCode } });
                });
            }
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

log('海绵小站插件加载完成 (v45.7 - 双引擎融合最终版)');
