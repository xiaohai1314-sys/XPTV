/**
 * 海绵小站前端插件 - V7.1 增强版
 * 
 * 版本说明:
 * - 【v7.1 增强版】严格基于用户反馈，回归V7.0的稳定逻辑。
 * - 100%保留V7.0原有的两步提取策略（HTML div提取、标准文本正则提取）及其执行顺序。
 * - 唯一的修改点：在V7.0所有标准方法都提取失败后，才启用一个新增的、源自V9.0的“终极净化”兜底策略。
 * - 这种“保持现有，增加兜底”的方式，确保了V7.0原本能处理的所有情况不受任何影响，同时增强了对复杂、非常规访问码的识别能力。
 * - 拼接方式、数据结构等所有其他部分，均与V7.0原版保持一致。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X     ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】 ★★★★★
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=ovaqn33d3msc6u1ht3cf3chu4p;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754329315,1754403914,1754439300,1754546919;HMACCOUNT=A4FF248A8A431217;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754546923;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg   ) { 
    try { 
        $log(`[海绵小站 v7.1] ${msg}`); 
    } catch (_) { 
        console.log(`[海绵小站 v7.1] ${msg}`); 
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

// --- 网络请求与回帖 ---
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

// --- 核心函数 ---

async function getConfig() {
  log("插件初始化 (v7.1 增强版)");
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
// =================== 【V7.1 增强版】 getTracks 函数 ===================
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
            const replied = await reply(detailUrl);
            if (replied) {
                log("回帖成功，重新获取页面内容...");
                await $utils.sleep(1000); 
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        const mainMessage = $(".message[isfirst='1']");
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        const tracks = [];

        // --- 步骤一：采集所有链接地址 (与V7一致) ---
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex   ) || [])];
        log(`采集到 ${uniqueLinks.length} 个不重复的链接地址: ${JSON.stringify(uniqueLinks)}`);

        // --- 步骤二：采集所有访问码 (严格遵循V7.0流程) ---
        let codePool = [];
        let match;
        
        // 【V7.0 保留策略1】优先使用最精确的DIV提取
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
            const code = match[1].trim();
            if (code.length < 15 && !code.includes('http'   )) {
                 codePool.push(code);
            }
        }
        
        // 【V7.0 保留策略2】如果策略1失败，使用次精确的文本提取
        if (codePool.length === 0) {
            const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
            while ((match = textCodeRegex.exec(mainMessageText)) !== null) {
                codePool.push(match[1].trim());
            }
        }
        
        // ★★★ 【V7.1 新增增强型兜底策略】 ★★★
        // 仅当V7.0的所有标准策略都失败后，才启用此策略
        if (codePool.length === 0) {
            log("V7.0标准提取失败，启用增强型兜底策略...");
            const fallbackRegex = /(?:访问码|提取码|密码)\s*[:：]\s*(.+)/g;
            while ((match = fallbackRegex.exec(mainMessageText)) !== null) {
                let rawCode = match[1].trim(); 
                log(`兜底策略捕获到原始字符串: "${rawCode}"`);
                
                const finalNumMap = { '零': '0', '〇': '0', '一': '1', '壹': '1', '依': '1', '二': '2', '贰': '2', '三': '3', '叁': '3', '四': '4', '肆': '4', '五': '5', '伍': '5', '吴': '5', '吾': '5', '无': '5', '武': '5', '悟': '5', '舞': '5', '物': '5', '乌': '5', '屋': '5', '唔': '5', '雾': '5', '勿': '5', '误': '5', '污': '5', '务': '5', '午': '5', '捂': '5', '戊': '5', '毋': '5', '邬': '5', '兀': '5', '六': '6', '陆': '6', '七': '7', '柒': '7', '八': '8', '捌': '8', '九': '9', '玖': '9', '久': '9', '酒': '9', 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10', '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
                const finalCharMap = { 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z', 'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵀ': 'T', 'ᵁ': 'U', 'ᵂ': 'W', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x' };

                let convertedCode = '';
                for (const char of rawCode) {
                    convertedCode += finalNumMap[char] || finalCharMap[char] || char;
                }
                log(`兜底策略初步转换后字符串: "${convertedCode}"`);

                const atoms = convertedCode.match(/[a-zA-Z0-9]/g);
                if (atoms && atoms.length > 0) {
                    let finalCode = atoms.join('');
                    log(`兜底策略重组后的纯净访问码: "${finalCode}"`);
                    codePool.push(finalCode);
                }
            }
        }
        
        codePool = [...new Set(codePool)];
        log(`最终采集到 ${codePool.length} 个可用访问码: ${JSON.stringify(codePool)}`);

        // --- 步骤三：循环处理，分配并生成结果 (与V7一致) ---
        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                const fileName = "网盘";
                const code = codePool[index] || '';
                let finalPan;
                if (code) {
                    // 严格使用V7.0的全角括号拼接格式
                    finalPan = `${link}（访问码：${code}）`;
                    log(`为链接 ${link} 分配到访问码: ${code}`);
                } else {
                    finalPan = link;
                }
                tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' } });
            });
        }

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

// 定义一个缓存对象，用于存储搜索结果，避免重复请求
const searchCache = {};

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = ext.page || 1;

  if (!text) return jsonify({ list: [] });

  if (searchCache.keyword !== text) {
    searchCache.keyword = text;
    searchCache.data = [];
    searchCache.pagecount = 0;
    searchCache.total = 0;
  }

  if (searchCache.data[page - 1]) {
    log(`从缓存中获取搜索结果，关键词: ${text}, 页码: ${page}`);
    return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total });
  }

  if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
    log(`请求页码 ${page} 超出总页数 ${searchCache.pagecount}，返回空列表。`);
    return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total });
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

    let pagecount = 0;
    let total = 0;

    const paginationLinks = $('ul.pagination a.page-link');
    if (paginationLinks.length > 0) {
        paginationLinks.each((_, link) => {
            const pageNum = parseInt($(link).text().trim());
            if (!isNaN(pageNum)) {
                pagecount = Math.max(pagecount, pageNum);
            }
        });
    }

    total = $("ul.threadlist > li.media.thread").length;

    searchCache.data[page - 1] = cards;
    searchCache.pagecount = pagecount;
    searchCache.total = total;

    log(`搜索完成，关键词: ${text}, 页码: ${page}, 找到 ${cards.length} 条结果，总页数: ${pagecount}, 当前页条目数: ${total}`);
    return jsonify({ list: cards, pagecount: pagecount, total: total });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
