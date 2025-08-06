/**
 * 海绵小站前端插件 - v45.8 (最终排版-终极版)
 * 
 * 更新日志:
 * - 【v45.8 终极版】向您致以最诚挚的歉意！此版本在功能不变的基础上，严格按照V45.0的
 *   原始排版风格进行了全面格式化，确保代码清晰、易读。
 * - 【100%保留V45核心】: 完全保留V45.0的双引擎、名称链接提取等所有核心逻辑。
 * - 【唯一修正点】: 仅在访问码提取流程中，无缝增加了对特殊HTML结构访问码的兼容。
 * - 【最终形态】: V45的逻辑、V45的排版、增强的功能。这是我们所有探索的最终答案。
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
function log(msg ) { 
    try { 
        $log(`[海绵小站 V45.8 终版] ${msg}`); 
    } catch (_) { 
        console.log(`[海绵小站 V45.8 终版] ${msg}`); 
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

// --- 核心函数 (已完整恢复) ---

async function getConfig() {
  log("插件初始化 (v45.8 - 最终排版-终极版)");
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
// =================== 【V45.8 最终排版版】 getTracks 函数 ===================
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

        const processAndPushTrack = (fileName, rawLink, accessCode = '') => {
            if (!rawLink || seenUrls.has(rawLink)) return;
            
            const preliminaryCleanCode = (accessCode || '').replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '');

            let dataPacket = rawLink;
            if (preliminaryCleanCode) {
                dataPacket = `${rawLink}（访问码：${preliminaryCleanCode}）`;
            }
            
            let pureLink = '';
            let finalAccessCode = '';
            const splitMatch = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
            
            if (splitMatch && splitMatch.length === 3) {
                pureLink = splitMatch[1].trim();
                finalAccessCode = splitMatch[2].trim();
            } else {
                pureLink = dataPacket.trim();
            }
            
            const normalizeCode = (rawCode) => {
                const charMap = { '₆': '6' };
                let normalized = '';
                for (const char of rawCode) { normalized += charMap[char] || char; }
                return normalized.trim();
            };
            finalAccessCode = normalizeCode(finalAccessCode);

            log(`[最终赋值] 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);
            
            if (seenUrls.has(pureLink)) return;
            seenUrls.add(pureLink);

            let finalPan;
            if (finalAccessCode) {
                finalPan = `${pureLink}（访问码：${finalAccessCode}）`;
            } else {
                finalPan = pureLink;
            }

            tracks.push({
                name: fileName,
                pan: finalPan,
                ext: { pwd: '' },
            });
        };

        // --- 引擎一：处理<a>标签 (100%复刻V45.0的逻辑) ---
        log("引擎一：开始解析<a>标签(名称链接)...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            if (seenUrls.has(href)) return;

            const text = linkElement.text().trim();
            let fileName = (text && text.length > 5 && !text.startsWith('http' )) ? text : pageTitle;
            
            const parentText = linkElement.parent().text();
            const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            let accessCode = '';
            if (preciseMatch && preciseMatch[1]) {
                accessCode = preciseMatch[1];
            }
            processAndPushTrack(fileName, href, accessCode);
        });
        log("引擎一：<a>标签解析完成。");

        // --- 引擎二：处理剩余纯文本链接 (基于V45.0，并增加唯一修正) ---
        log("引擎二：开始解析剩余纯文本链接...");
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();

        const allLinksInMessage = (mainMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g ) || []);
        const isolatedLinks = allLinksInMessage.filter(link => !seenUrls.has(link));

        if (isolatedLinks.length > 0) {
            let potentialCodes = [];
            
            // V45原始逻辑
            const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
            let match;
            while ((match = codeRegex.exec(mainMessageText)) !== null) {
                potentialCodes.push(match[1]);
            }
            
            // 【唯一修正点】新增逻辑
            const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
            while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
                potentialCodes.push(match[1].trim());
            }
            
            // 过滤与分配
            const usedCodes = new Set();
            tracks.forEach(t => {
                 const m = t.pan.match(/访问码：([^）]+)/);
                 if (m && m[1]) usedCodes.add(m[1]);
            });
            const availableCodes = [...new Set(potentialCodes)].filter(c => !usedCodes.has(c));
            
            log(`在主楼中发现 ${isolatedLinks.length} 个孤立链接和 ${availableCodes.length} 个可用访问码: ${JSON.stringify(availableCodes)}`);

            for (let i = 0; i < isolatedLinks.length; i++) {
                const link = isolatedLinks[i];
                const code = availableCodes[i] || '';
                processAndPushTrack(pageTitle, link, code);
            }
        }
        log("引擎二：纯文本链接解析完成。");

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

log('海绵小站插件加载完成 (v45.8 - 最终排版-终极版)');
