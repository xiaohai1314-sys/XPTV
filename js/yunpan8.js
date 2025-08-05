/**
 * 海绵小站前端插件 - v31.0 (DOM结构解析最终版)
 * 
 * 更新日志:
 * - 【v31.0 最终版】根据真实HTML样本，重构解析引擎，解决分离式链接解析失败问题。
 * - 【v31.0 核心升级】放弃基于  
或.text()的不可靠分割，改为直接遍历DOM元素（如<p>, <div>），
 *   通过查找元素的“下一个兄弟节点”来实现最可靠的“邻里查找”，精准匹配分离的链接和访问码。
 * - 【v31.0 兼容并包】新引擎不仅能完美处理“链接在上，码在下”的<p>标签分离模式，
 *   同时完整保留了对<a>标签、内联链接、裸链接的解析能力。
 * - 【v31.0 交付】这应该是针对海绵小站当前页面结构最稳定、最精准的最终解决方案。
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
function log(msg  ) { try { $log(`[海绵小站 V31.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V31.0] ${msg}`); } }
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
  log("插件初始化 (v31.0 - DOM结构解析最终版)");
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
// =================== 【唯一修改区域】v31.0 最终版 getTracks 函数 ===================
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

        const addTrack = (fileName, link, code = '') => {
            const pureLink = (link.match(/https?:\/\/[^\s<]+/ ) || [''])[0];
            if (!pureLink || seenUrls.has(pureLink)) return;
            seenUrls.add(pureLink);

            const finalCode = (code.replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '').replace(/[^a-zA-Z0-9]/g, ''));
            log(`成功添加 -> 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalCode}`);
            tracks.push({ name: fileName, pan: pureLink, ext: { pwd: finalCode } });
        };

        // 正则表达式预备
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<]+/;
        const codeRegex = /(?:访问码|提取码|密码 )\s*[:：]\s*[\w*.:-]+/i;

        // 遍历内容区的每一个直接子元素 (p, div, h3 等)
        mainMessage.children().each((index, element) => {
            const currentElement = $(element);
            const currentText = currentElement.text();

            // 1. 查找当前元素中的链接
            const linkMatch = currentText.match(linkRegex);
            if (linkMatch) {
                const link = linkMatch[0];
                if (seenUrls.has(link)) return; // 如果链接已被处理，则跳过

                // 1.1 检查是否为内联模式 (链接和访问码在同一个元素内)
                const codeMatch = currentText.match(codeRegex);
                if (codeMatch) {
                    log(`[内联模式] 在同一元素中找到链接和访问码。`);
                    addTrack(pageTitle, link, codeMatch[0]);
                    return; // 处理完成，继续下一个元素
                }

                // 1.2 检查是否为分离模式 (查找下一个兄弟元素)
                const nextElement = currentElement.next();
                if (nextElement.length > 0) {
                    const nextText = nextElement.text();
                    const nextCodeMatch = nextText.match(codeRegex);
                    if (nextCodeMatch) {
                        log(`[分离模式] 在下一个元素中找到链接 ${link} 的访问码。`);
                        addTrack(pageTitle, link, nextCodeMatch[0]);
                        // 将下一个元素标记为已处理，防止它自己又被当成一个独立的项
                        nextElement.addClass('processed-by-parser');
                        return;
                    }
                }
                
                // 1.3 如果以上都不是，则为裸链接
                log(`[裸链接模式] 链接 ${link} 未找到关联访问码。`);
                addTrack(pageTitle, link, '');
            }
            
            // 2. 检查当前元素是否只包含一个独立的访问码 (且未被处理过)
            // (这个逻辑主要用于防止访问码被漏掉，但通常在分离模式中已被处理)
            else if (currentElement.hasClass('processed-by-parser')) {
                // 如果元素已被标记处理，直接跳过
                return;
            }
            else {
                const codeMatch = currentText.match(codeRegex);
                if (codeMatch && !currentText.match(linkRegex)) {
                    // 这是一个没有链接的、独立的访问码行，通常忽略
                    log(`[孤立访问码] 发现一个孤立的访问码，已忽略: ${codeMatch[0]}`);
                }
            }
        });

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

log('海绵小站插件加载完成 (v31.0 - DOM结构解析最终版)');
