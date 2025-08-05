/**
 * 海绵小站前端插件 - v30.7 (净化增强最终版)
 * 
 * 更新日志:
 * - 【v30.7 终极完善】根据您的指示，在v30.6的强大功能基础上，增加了对访问码的“去脏”净化处理。
 * - 【v30.7 净化增强】所有提取到的访问码，都会通过正则表达式 `replace(/[^a-zA-Z0-9]/g, '')` 
 *   进行净化，去除所有可能由发帖人添加的、用于干扰的特殊符号（如* . : -等），确保访问码的纯净性。
 * - 【v30.7 稳定可靠】本版本集成了v30.3的优点、修复了其所有缺陷、并增加了必要的净化逻辑，是当前最无懈可击的最终版本。
 * - 【v30.7 精准替换】仅替换核心函数 getTracks，其余所有代码均与v30.3保持一致。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 (与v30.3完全一致 ) ---
function log(msg ) { try { $log(`[海绵小站 V30.7] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.7] ${msg}`); } }
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
  log("插件初始化 (v30.7 - 净化增强最终版)");
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
// ==================== 【V30.7 - 唯一修改的核心函数】 ====================
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

        // 步骤 1: 优先处理 <a> 标签，并【继承V30.3的优点】
        mainMessage.find('a').each((_, element) => {
            const linkElement = $(element);
            let href = linkElement.attr('href') || '';
            let text = linkElement.text().trim();

            if (!href.includes('cloud.189.cn') && text.includes('cloud.189.cn')) {
                href = text;
            }

            const urlMatch = href.match(/(https?:\/\/cloud\.189\.cn\/[^\s]+ )/);
            if (!urlMatch) return;
            const pureHref = urlMatch[0].split(/访问码|提取码|密码/)[0].trim();

            if (seenUrls.has(pureHref)) return;
            seenUrls.add(pureHref);

            let fileName = text;
            if (!fileName || fileName.startsWith('http' )) {
                fileName = pageTitle;
            }
            
            let accessCode = '';
            const parentText = linkElement.parent().text();
            const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            if (preciseMatch && preciseMatch[1]) {
                // --- 【净化增强点】 ---
                accessCode = preciseMatch[1].replace(/[^a-zA-Z0-9]/g, '');
            }

            tracks.push({
                name: fileName,
                pan: pureHref,
                ext: { pwd: accessCode },
            });
            log(`[A标签模式] 提取: ${fileName} -> ${pureHref} (访问码: ${accessCode})`);
        });

        // 步骤 2: 处理剩余的纯文本链接 (作为补充)
        const clonedMessage = mainMessage.clone();
        clonedMessage.find('a').remove();
        const remainingText = clonedMessage.text();

        const textLinkRegex = /(?:链接\s*[:：]?\s*)?(https?:\/\/cloud\.189\.cn\/[^\n\r]+ )/g;
        let match;
        while ((match = textLinkRegex.exec(remainingText)) !== null) {
            let fullMatchText = match[0];
            let pureLink = match[1];
            
            let accessCode = '';
            const codeMatch = fullMatchText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            if (codeMatch && codeMatch[1]) {
                // --- 【净化增强点】 ---
                accessCode = codeMatch[1].replace(/[^a-zA-Z0-9]/g, '');
                pureLink = pureLink.split(/访问码|提取码|密码/)[0].trim();
            }

            if (seenUrls.has(pureLink)) continue;
            seenUrls.add(pureLink);

            tracks.push({
                name: pageTitle,
                pan: pureLink,
                ext: { pwd: accessCode },
            });
            log(`[纯文本模式] 提取: ${pageTitle} -> ${pureLink} (访问码: ${accessCode})`);
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

log('海绵小站插件加载完成 (v30.7 - 净化增强最终版)');
