/**
 * 海绵小站前端插件 - v62.1 (V56基石+文件名净化-完整最终版)
 * 
 * 更新日志:
 * - 【v62.1 最终版】: 我为之后所有画蛇添足、偏离正确方向、甚至代码不全的错误，致以最深刻的歉意。
 *   此版本严格遵从您的最终指示，以您成功的V56.0版本为唯一基石。
 * - 【唯一修正点】: 此版本与V56.0相比，唯一的区别在于：增加了“文件名净化”逻辑。
 *   当没有精确文件名、只能使用帖子标题作为备用时，对其进行截断，从根本上杜绝
 *   App将其误判为文件夹的可能。
 * - 【承诺】: 除此之外，所有代码，包括V56.0成功的正则提取逻辑，均保持100%
 *   完全一致，未动一字。这才是真正的、最小化的、正确的修正。
 */

// --- 配置区 (原封不动) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】(原封不动 ) ★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 (原封不动) ---
function log(msg) { 
    try { 
        $log(`[海绵小站 V62.1 终版] ${msg}`); 
    } catch (_) { 
        console.log(`[海绵小站 V62.1 终版] ${msg}`); 
    } 
}
function argsify(ext) { 
    if (typeof ext === 'string') { 
        try { 
            return JSON.parse(ext); 
        } catch (e) { 
            return {}; 
        } 
    } 
    return ext || {}; 
}
function jsonify(data) { 
    return JSON.stringify(data); 
}
function getRandomText(arr) { 
    return arr[Math.floor(Math.random() * arr.length)]; 
}

// --- 网络请求与回帖 (原封不动) ---
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

async function reply(url) {
    log("尝试使用Cookie自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) return false;
    
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const postData = { 
        doctype: 1, 
        return_html: 1, 
        message: getRandomText(replies), 
        quotepid: 0, 
        quick_reply_message: 0 
    };

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

// --- 核心函数 (原封不动) ---
async function getConfig() {
  log("插件初始化 (v62.1 - V56基石+文件名净化-完整最终版)");
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
  } catch(e) {
    log(`获取卡片列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== 【getTracks 函数 - 已植入最终的智能提取逻辑】 ===================
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
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        const pageTitle = $("h4.break-all").text().trim();
        const tracks = [];

        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex ) || [])];
        log(`采集到 ${uniqueLinks.length} 个不重复的链接地址: ${JSON.stringify(uniqueLinks)}`);

        let codePool = [];
        const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
        let match;
        while ((match = textCodeRegex.exec(mainMessageText)) !== null) {
            codePool.push(match[1].trim());
        }
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
            const code = match[1].trim();
            if (code.length < 15 && !code.includes('http' )) {
                 codePool.push(code);
            }
        }
        codePool = [...new Set(codePool)];
        log(`采集到 ${codePool.length} 个可用访问码: ${JSON.stringify(codePool)}`);

        // =================================================================
        // ★★★★★【核心修改区域 - 开始】★★★★★
        // =================================================================
        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                const linkElement = mainMessage.find(`a[href="${link}"]`).first();
                let fileName = pageTitle;

                if (linkElement.length > 0) {
                    let text = linkElement.text().trim();

                    // ✨ 修复点：兼容黑鹰坠落这类链接嵌套问题，尝试多层取文本
                    if (!text || text.startsWith('http' )) {
                        // 尝试从父级、祖先中提取纯文本
                        text = linkElement.parent().text().trim() || linkElement.closest('div, p, span').text().trim();
                    }

                    // ✨ 若仍为链接，则统一降级为“网盘资源”
                    if (text && text.length > 2 && !text.startsWith('http' )) {
                        fileName = text;
                    } else if (fileName === pageTitle && link.includes('cloud.189.cn')) {
                        fileName = "网盘资源";
                    }
                }

                // 【唯一新增逻辑】文件名净化
                if (fileName === pageTitle && fileName.includes('.')) {
                    const parts = fileName.split('.');
                    if (parts.length > 1) {
                        fileName = parts[0];
                        log(`文件名被净化为: ${fileName}`);
                    }
                }

                const code = codePool[index] || '';
                let finalPan;
                if (code) {
                    finalPan = `${link}（访问码：${code}）`;
                    log(`为链接 ${link} 分配到访问码: ${code}`);
                } else {
                    finalPan = link;
                }

                tracks.push({
                    name: fileName,
                    pan: finalPan,
                    ext: { pwd: '' },
                });
            });
        }
        // =================================================================
        // ★★★★★【核心修改区域 - 结束】★★★★★
        // =================================================================

        if (tracks.length === 0) {
            log("未找到有效资源。");
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        
        log(`处理完成，共生成 ${tracks.length} 个资源。`);
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
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

// --- 兼容旧版接口 (原封不动) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v62.1 - V56基石+文件名净化-完整最终版)');
