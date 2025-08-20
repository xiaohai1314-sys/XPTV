/**
 * 海绵小站前端插件 - 自动刷新优化版
 * * 版本说明:
 * - [自动刷新逻辑] 强化了getTracks函数：当检测到需要回帖时，脚本会在后台自动完成回帖、重新获取页面、解析新内容并返回最终结果的全套操作。
 * - [无缝体验] App在调用此脚本后，会直接收到包含资源链接的最终数据，理论上可以直接渲染出结果，无需用户手动退出再进入。
 * - [核心移植] 保留V9版本的先进访问码提取逻辑，确保高准确率。
 * - [环境适配] 所有逻辑均在App的前端脚本环境中执行。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio(); // 假设App环境提供了createCheerio函数
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ★★★★★【用户配置区 - Cookie】 ★★★★★
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=ovaqn33d3msc6u1ht3cf3chu4p;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754329315,1754403914,1754439300,1754546919;HMACCOUNT=A4FF248A8A431217;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754546923;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg) {
    try {
        $log(`[海绵小站 优化版] ${msg}`);
    } catch (_) {
        console.log(`[海绵小站 优化版] ${msg}`);
    }
}
function argsify(ext) { 
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
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
        doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0
    };

    try {
        const { data } = await fetchWithCookie(postUrl, {
            method: 'POST', body: postData, headers: { 'Referer': url }
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

// --- 访问码提取逻辑 (移植自V9) ---
const finalNumMap = {'零':'0','〇':'0','一':'1','壹':'1','依':'1','二':'2','贰':'2','三':'3','叁':'3','四':'4','肆':'4','五':'5','伍':'5','吴':'5','吾':'5','无':'5','武':'5','悟':'5','舞':'5','物':'5','乌':'5','屋':'5','唔':'5','雾':'5','勿':'5','误':'5','污':'5','务':'5','午':'5','捂':'5','戊':'5','毋':'5','邬':'5','兀':'5','六':'6','陆':'6','七':'7','柒':'7','八':'8','捌':'8','九':'9','玖':'9','久':'9','酒':'9','Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
const finalCharMap = {'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ᵂ':'w','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};

function purifyAndConvertCode(rawStr) {
    const codeMatch = rawStr.match(/(?:访问码|提取码|密码)\s*[:：\s]*([\s\S]+)/);
    const extractedCode = codeMatch ? codeMatch[1].trim() : rawStr.trim();
    let convertedCode = '';
    for (const char of extractedCode) {
        convertedCode += finalNumMap[char] || finalCharMap[char] || char;
    }
    const finalCodeMatch = convertedCode.match(/^[a-zA-Z0-9]+/);
    if (finalCodeMatch) {
        return finalCodeMatch[0].toLowerCase();
    }
    return null;
}

// =================================================================================
// =================== 【自动刷新优化版】 getTracks 函数 ===================
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
        
        // --- 核心逻辑：如果内容隐藏，则执行“回帖 -> 重新获取”流程 ---
        if (isContentHidden) {
            log("内容被隐藏，启动回帖流程...");
            const replied = await reply(detailUrl);
            if (replied) {
                log("回帖成功，等待1秒后重新获取页面内容...");
                await $utils.sleep(1000); // 假设App环境提供sleep函数
                
                // 关键步骤：重新请求页面，并用最新的内容覆盖旧的
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data); // 用新数据重新初始化cheerio
                log("已获取回帖后的最新页面内容，继续解析...");

            } else {
                // 如果回帖失败（例如Cookie失效），则返回提示信息
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        // --- 统一的解析逻辑 ---
        // 无论是否经过回帖，这里的代码处理的都是“最终可见”的页面内容
        const mainMessage = $(".message[isfirst='1']");
        if (!mainMessage.length) {
            log("错误：找不到主楼层内容。");
            return jsonify({ list: [] });
        }

        const finalResultsMap = new Map();
        const allLinkNodes = mainMessage.find('a[href*="cloud.189.cn"], a[href*="pan.quark.cn"]');
        log(`在最终页面找到 ${allLinkNodes.length} 个网盘链接节点。开始分析...`);
        
        const usedCodeElements = new Set();

        allLinkNodes.each((_, linkNode) => {
            const link = $(linkNode).attr('href');
            if (!link) return;

            let code = null;
            let currentElement = $(linkNode).closest('p, div, h3');
            if (!currentElement.length) {
                currentElement = $(linkNode);
            }

            const searchElements = [currentElement];
            let next = currentElement.next();
            for(let i = 0; i < 3 && next.length; i++){
                searchElements.push(next);
                next = next.next();
            }

            for (const element of searchElements) {
                if (usedCodeElements.has(element.get(0))) continue;
                const text = element.text().trim();
                
                if (text.match(/(?:访问码|提取码|密码)/)) {
                    const foundCode = purifyAndConvertCode(text);
                    if (foundCode) {
                        code = foundCode; 
                        usedCodeElements.add(element.get(0));
                        log(`通过关键词匹配到访问码: ${code}`);
                        break;
                    }
                }
                
                if (!text.includes('http') && !text.includes('/') && !text.includes(':')) {
                    const purifiedText = purifyAndConvertCode(text);
                    if (purifiedText && /^[a-z0-9]{4,8}$/i.test(purifiedText)) {
                         code = purifiedText;
                         usedCodeElements.add(element.get(0));
                         log(`通过纯净码匹配到访问码: ${code}`);
                         break;
                    }
                }
            }
            
            const existingRecord = finalResultsMap.get(link);
            if (!existingRecord || (!existingRecord.code && code)) {
                log(`更新结果库: 链接=${link}, 访问码=${code || '无'}`);
                finalResultsMap.set(link, { link, code });
            }
        });

        const tracks = [];
        if (finalResultsMap.size > 0) {
            finalResultsMap.forEach(record => {
                const finalPan = record.code ? `${record.link}（访问码：${record.code}）` : record.link;
                tracks.push({
                    name: "网盘",
                    pan: finalPan,
                    ext: { pwd: record.code || '' },
                });
            });
        }

        if (tracks.length === 0) {
            log("未找到有效资源。");
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        
        log(`处理完成，将返回 ${tracks.length} 个最终资源给App。`);
        // 关键步骤：返回包含最终结果的JSON数据
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`getTracks函数出现致命错误: ${e.message}`);
        console.error(e);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}

// --- 其他接口函数保持不变 ---
async function getConfig() {
  log("插件初始化 (自动刷新优化版)");
  return jsonify({
    ver: 1, title: '海绵小站', site: SITE_URL,
    tabs: [
      { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } },
      { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } },
    ],
  });
}
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http')) return path;
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
    return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total });
  }
  if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
    return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total });
  }
  let url;
  if (page === 1) {
    url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  } else {
    url = `${SITE_URL}/search-${encodeURIComponent(text)}-1-0-${page}.htm`;
  }
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
    const paginationLinks = $('ul.pagination a.page-link');
    if (paginationLinks.length > 0) {
        paginationLinks.each((_, link) => {
            const pageNum = parseInt($(link).text().trim());
            if (!isNaN(pageNum)) {
                pagecount = Math.max(pagecount, pageNum);
            }
        });
    } else {
      pagecount = 1;
    }
    const total = cards.length; 
    searchCache.data[page - 1] = cards;
    searchCache.pagecount = pagecount;
    searchCache.total += total;
    return jsonify({ list: cards, pagecount: pagecount, total: searchCache.total });
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
