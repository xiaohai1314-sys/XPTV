/**
 * 海绵小站前端插件 - V12.0 终极决战版
 * 
 * 版本说明:
 * - 【V12.0 核心修改】严格遵照用户指令，在V11.0版本基础上，进行最终格式微调。
 *   - getTracks函数中，拼接访问码字符串的格式，已从“全角括号”修改为“半角括号”。
 *   - 全角冒号“：”保持不变。
 *   - 此版本融合了“完美伪装”、“净化再组合”以及“格式圣杯”三大核心战术，旨在攻克所有已知和未知的壁垒。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
// UA 已在下方的 defaultHeaders 中定义 ，此处的 UA 仅作为备用。
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【V11.0 最强之盾 - 身份令牌升级】★★★★★
const COOKIE = 'bbs_token=FNadiSz82ritwSG4Ik4_2F8uZij2PotVP6VX8oKMQJk66ZicaB; bbs_sid=ai7g629c5i90qseoi9nf7b4t5f; _xn_accesscount_visited=1; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754232197,1754315193,1755050562,1755080864; HMACCOUNT=29968E74595D96C7; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1755085598';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg   ) { 
    try { 
        $log(`[海绵小站 V12.0 决战版] ${msg}`); 
    } catch (_) { 
        console.log(`[海绵小站 V12.0 决战版] ${msg}`); 
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

// ★★★★★【V11.0 最强之盾 - 完美伪装核心】★★★★★
const defaultHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'max-age=0',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
};

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 
        ...defaultHeaders, 
        'Cookie': COOKIE,
        'referer': options.headers?.referer || SITE_URL + '/',
        ...options.headers 
    };
    const finalOptions = { ...options, headers };

    if (options.method === 'POST') {
        return $fetch.post(url, options.body, finalOptions);
    }
    return $fetch.get(url, finalOptions);
}
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

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
  log("插件初始化 (V12.0 决战版)");
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
// =================== 【V12.0 终极决战版】 getTracks 函数 ===================
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

        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex   ) || [])];
        log(`采集到 ${uniqueLinks.length} 个不重复的链接地址: ${JSON.stringify(uniqueLinks)}`);

        let codePool = [];
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        let match;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
            const code = match[1].trim();
            if (code.length < 15 && !code.includes('http'   )) {
                 codePool.push(code);
            }
        }
        if (codePool.length === 0) {
            const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
            while ((match = textCodeRegex.exec(mainMessageText)) !== null) {
                codePool.push(match[1].trim());
            }
        }
        if (codePool.length === 0) {
            log("标准提取失败，启用兜底策略处理复杂访问码...");
            const fallbackRegex = /(?:访问码|提取码|密码)\s*[:：]\s*(.+)/g;
            while ((match = fallbackRegex.exec(mainMessageText)) !== null) {
                codePool.push(match[1].trim());
            }
        }
        codePool = [...new Set(codePool)];
        log(`初步采集到 ${codePool.length} 个原始访问码: ${JSON.stringify(codePool)}`);

        const finalNumMap = { '零': '0', '〇': '0', '一': '1', '壹': '1', '依': '1', '二': '2', '贰': '2', '三': '3', '叁': '3', '四': '4', '肆': '4', '五': '5', '伍': '5', '吴': '5', '吾': '5', '无': '5', '武': '5', '悟': '5', '舞': '5', '物': '5', '乌': '5', '屋': '5', '唔': '5', '雾': '5', '勿': '5', '误': '5', '污': '5', '务': '5', '午': '5', '捂': '5', '戊': '5', '毋': '5', '邬': '5', '兀': '5', '六': '6', '陆': '6', '七': '7', '柒': '7', '八': '8', '捌': '8', '九': '9', '玖': '9', '久': '9', '酒': '9', 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5', 'Ⅵ': '6', 'Ⅶ': '7', 'Ⅷ': '8', 'Ⅸ': '9', '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10', '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
        const finalCharMap = { 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z', 'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵀ': 'T', 'ᵁ': 'U', 'ᵂ': 'W', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x' };
        
        const purifiedCodePool = codePool.map(rawCode => {
            let convertedCode = '';
            for (const char of rawCode) {
                convertedCode += finalNumMap[char] || finalCharMap[char] || char;
            }
            log(`原始码 "${rawCode}" 已被净化为 "${convertedCode}"`);
            const cleanCodeMatch = convertedCode.match(/^[a-zA-Z0-9]+/);
            return cleanCodeMatch ? cleanCodeMatch[0] : '';
        }).filter(code => code);

        log(`最终净化得到 ${purifiedCodePool.length} 个标准访问码: ${JSON.stringify(purifiedCodePool)}`);

        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                const fileName = "网盘";
                const code = purifiedCodePool[index] || '';
                let finalPan;

                if (code) {
                    // ★★★★★★★★★★★ 【V12.0 核心修改：格式圣杯】 ★★★★★★★★★★★
                    // 使用“半角括号”和“全角冒号”进行拼接
                    finalPan = `${link}(访问码：${code})`;
                    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
                    log(`为链接 ${link} 分配净化后的访问码: ${code}，并组合成新格式: ${finalPan}`);
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
