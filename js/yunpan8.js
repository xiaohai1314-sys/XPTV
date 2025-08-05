/**
 * 海绵小站前端插件 - v50.0-debug (本地代理调试版)
 * 
 * 更新日志:
 * - 【v50.0-debug】此版本为针对真实HTML分析后得出的最终解决方案的【本地调试版】。
 *   1. (指向代理): SITE_URL已设置为指向本地代理服务器 (192.168.1.7:3000)。
 *   2. (正则主导): 所有解析逻辑基于从代理后端获取到的真实HTML，使用正则表达式完成。
 *   3. (最终匹配逻辑): 内置了针对“一对一分离”和“多对多”情况的匹配逻辑。
 *   此版本用于在本地环境中，最终验证新解析方案的正确性。
 */

// --- 配置区 ---

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★  核心修改：将请求指向我们本地运行的代理服务器 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
const SITE_URL = "http://192.168.1.7:3000"; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=rd8nluq3qbcpg5e5sfb5e08pbg;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316688,1754316727,1754329315,1754403914;HMACCOUNT=CEAB3CBE53C875F2;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754403929;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg   ) { try { $log(`[海绵小站 V50.0-debug] ${msg}`); } catch (_) { console.log(`[海绵小站 V50.0-debug] ${msg}`); } }
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
  log("插件初始化 (v50.0-debug - 正则净化最终版)");
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
    // 注意：图片地址需要用真实的URL，而不是代理地址
    const REAL_SITE_URL = "https://www.haimianxz.com";
    return `${REAL_SITE_URL}/${cleanPath}`;
}

async function getCards(ext ) {
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
// =================== 【唯一修改区域】v50.0 正则净化最终版 getTracks 函数 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    
    try {
        // 注意：这里的data是从我们的代理服务器获取的，是经过Puppeteer渲染后的真实HTML
        let { data } = await fetchWithCookie(detailUrl);
        
        // 由于data已经是最终HTML，我们不再需要回帖逻辑，但保留cheerio用于获取标题
        let $ = cheerio.load(data);
        const pageTitle = $("h4.break-all").text().trim() || "资源分享";
        const tracks = [];

        // 关键：直接在返回的HTML字符串上操作
        let mainMessageHtml = data; // 直接使用完整的返回数据
        
        // 提取器：使用正则表达式从纯HTML字符串中提取
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        // 修正访问码正则 ，以应对 `alert-success` 的情况
        const codeRegex = /(?:访问码\s*[:：]\s*([\w*.:-]{4,8}))|class="alert alert-success"[^>]*>([\w*.:-]{4,8})/g;

        const links = [...mainMessageHtml.matchAll(linkRegex)].map(m => m[0]);
        
        const codes = [];
        let codeMatch;
        while ((codeMatch = codeRegex.exec(mainMessageHtml)) !== null) {
            // 正则组1对应“访问码:xxxx”模式，组2对应“alert-success”模式
            codes.push((codeMatch[1] || codeMatch[2]).trim());
        }

        log(`正则提取结果 - 链接数: ${links.length}, 访问码数: ${codes.length}`);
        log(`提取到的链接: ${JSON.stringify(links)}`);
        log(`提取到的访问码: ${JSON.stringify(codes)}`);

        if (links.length > 0) {
            // 最终匹配逻辑
            if (links.length === 1 && codes.length === 1) {
                // 强行配对：解决“一对一分离”问题
                log("检测到唯一链接和唯一访问码，执行强行配对。");
                tracks.push({ name: pageTitle, pan: links[0], ext: { pwd: codes[0] } });
            } else {
                // 顺序配对：兼容“名称链接”和“多对多”等常规情况
                log("执行默认顺序配对。");
                links.forEach((link, index) => {
                    // 尝试处理“链接后带访问码”的特殊纯文本情况
                    const combinedMatch = link.match(/(https?:\/\/[^\s（(]+ )[\s（(]+(?:访问码|访问码)[：:]+([^）)]+)/);
                    if(combinedMatch){
                        tracks.push({ name: pageTitle, pan: combinedMatch[1].trim(), ext: { pwd: combinedMatch[2].trim() } });
                    } else {
                        tracks.push({ name: pageTitle, pan: link, ext: { pwd: codes[index] || '' } });
                    }
                });
            }
        }

        // 去重，以防万一
        const uniqueTracks = [];
        const seenPan = new Set();
        for (const track of tracks) {
            if (track.pan && !seenPan.has(track.pan)) {
                uniqueTracks.push(track);
                seenPan.add(track.pan);
            }
        }

        if (uniqueTracks.length === 0) {
            log("所有方法均未找到有效资源，返回提示信息。");
            uniqueTracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        
        return jsonify({ list: [{ title: '云盘', tracks: uniqueTracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `操作失败: ${e.message}`, pan: '', ext: {} }] }] });
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

log('海绵小站插件加载完成 (v50.0-debug - 本地代理调试版)');
