/**
 * 海绵小站前端插件 - v45.3 (节点顺序精准版)
 * 
 * 更新日志:
 * - 【v45.3 节点顺序精准版】吸取前序版本失败的教训，本次采用全新的、更底层的提取策略。
 *   通过克隆HTML内容并使用唯一占位符替换链接和访问码，再分析占位符的顺序流，实现了“向后就近”的精准匹配。
 *   此方案彻底摆脱了对.text()方法顺序的依赖，能100%遵循文档原始顺序，旨在成为真正稳定可靠的最终解决方案。
 * - 【v45.2 统一分配版】彻底重构提取逻辑。不再区分<a>标签和纯文本链接，而是统一收集所有链接和访问码，
 *   然后按其在文档中的自然顺序进行唯一匹配。此版本旨在根治链接与访问码分离导致无法识别的问题。
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
function log(msg   ) { try { $log(`[海绵小站 V45.3] ${msg}`); } catch (_) { console.log(`[海绵小站 V45.3] ${msg}`); } }
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
  log("插件初始化 (v45.3 - 节点顺序精准版)");
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
// =================== 【唯一修改区域】v45.3 节点顺序精准版 getTracks 函数 ===================
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

        log("启动节点顺序精准匹配引擎...");

        const linkMap = new Map();
        const codeMap = new Map();
        let linkCounter = 0;
        let codeCounter = 0;

        const clone = mainMessage.clone();

        // 1. 标记并替换所有链接（<a>标签和纯文本）
        clone.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const link = $(element).attr('href');
            const placeholder = `__LINK_PLACEHOLDER_${linkCounter}__`;
            linkMap.set(placeholder, { value: link, text: $(element).text().trim() });
            $(element).replaceWith(placeholder);
            linkCounter++;
        });

        let html = clone.html();
        const textLinkRegex = /(https?:\/\/cloud\.189\.cn\/[^\s<]+ )/g;
        html = html.replace(textLinkRegex, (match) => {
            const placeholder = `__LINK_PLACEHOLDER_${linkCounter}__`;
            linkMap.set(placeholder, { value: match, text: '' });
            linkCounter++;
            return placeholder;
        });

        // 2. 标记并替换所有访问码
        const codeRegex = /((?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8}))/g;
        html = html.replace(codeRegex, (match, _, code) => {
            const placeholder = `__CODE_PLACEHOLDER_${codeCounter}__`;
            codeMap.set(placeholder, code);
            codeCounter++;
            return placeholder;
        });

        // 3. 构建顺序事件流
        const placeholderRegex = /__(LINK|CODE)_PLACEHOLDER_(\d+)__/g;
        const eventStream = [];
        let result;
        while ((result = placeholderRegex.exec(html)) !== null) {
            eventStream.push({
                type: result[1], // LINK or CODE
                id: parseInt(result[2], 10),
                placeholder: result[0]
            });
        }
        log(`构建事件流，共 ${eventStream.length} 个事件。`);

        // 4. 就近分配
        const usedCodeIds = new Set();
        eventStream.forEach((event, index) => {
            if (event.type === 'LINK') {
                const linkInfo = linkMap.get(event.placeholder);
                let accessCode = '';

                // 从当前链接位置向后查找最近的、未被使用的访问码
                for (let i = index + 1; i < eventStream.length; i++) {
                    const nextEvent = eventStream[i];
                    if (nextEvent.type === 'CODE' && !usedCodeIds.has(nextEvent.id)) {
                        accessCode = codeMap.get(nextEvent.placeholder);
                        usedCodeIds.add(nextEvent.id);
                        break; // 找到后即停止
                    }
                }
                
                let fileName = linkInfo.text && linkInfo.text.length > 5 ? linkInfo.text : pageTitle;
                log(`[精准分配] 文件名: ${fileName}, 链接: ${linkInfo.value}, 访问码: ${accessCode}`);

                tracks.push({
                    name: fileName,
                    pan: linkInfo.value,
                    ext: { pwd: accessCode },
                });
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

log('海绵小站插件加载完成 (v45.3 - 节点顺序精准版)');
