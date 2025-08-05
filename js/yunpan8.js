/**
 * 海绵小站前端插件 - v49.0 (代理调试版)
 * 
 * 更新日志:
 * - 【v49.0 代理调试版】此版本用于配合代理后端进行终极调试。
 *   将SITE_URL指向您自己搭建的代理服务器地址，以便在后端查看完整的请求和响应日志。
 */

// --- 配置区 ---

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★  请将下面的URL替换为您在Replit上获取到的、您自己的代理服务器URL！ ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
const SITE_URL = "http://192.168.1.7:3000"; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=rd8nluq3qbcpg5e5sfb5e08pbg;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316688,1754316727,1754329315,1754403914;HMACCOUNT=CEAB3CBE53C875F2;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754403929;";

// ... 此处省略和之前版本完全一样的其他所有代码 ...
// ... 您只需要替换上面那一行 SITE_URL 即可 ...

// --- 核心辅助函数 ---
function log(msg   ) { try { $log(`[海绵小站 V49.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V49.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
    const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 };
    try {
        const { data } = await fetchWithCookie(postUrl, { method: 'POST', body: postData, headers: { 'Referer': url } });
        if (data.includes("您尚未登录")) { log("回帖失败：Cookie已失效或不正确。"); $utils.toastError("Cookie已失效，请重新获取", 3000); return false; }
        log("回帖成功！");
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") { $utils.toastError("回帖异常，请检查网络或Cookie", 3000); }
        return false;
    }
}
async function getConfig() {
  log("插件初始化 (v49.0 - 代理调试版)");
  return jsonify({ ver: 1, title: '海绵小站', site: SITE_URL, tabs: [ { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } }, { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } }, ], });
}
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http'   )) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    // 注意：这里需要特殊处理，因为SITE_URL变了
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
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
    });
    return jsonify({ list: cards });
  } catch(e) {
    log(`获取卡片列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const detailUrl = `${SITE_URL}/${url}`;
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        if ($("div.alert.alert-warning").text().includes("回复后")) {
            const replied = await reply(detailUrl);
            if (replied) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }
        const mainMessageHtml = $('.message[isfirst="1"]').html();
        const pageTitle = $("h4.break-all").text().trim();
        const tracks = [];
        if (!mainMessageHtml) { throw new Error("无法获取主楼HTML内容。"); }
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const codeRegex = /(?:访问码|提取码|密码 )\s*[:：]\s*([\w*.:-]{4,8})/g;
        const links = mainMessageHtml.match(linkRegex) || [];
        const codes = mainMessageHtml.match(codeRegex) || [];
        if (links.length > 0) {
            links.forEach((link, index) => {
                let accessCode = '';
                if (codes[index]) {
                    accessCode = codes[index].replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '').trim();
                }
                tracks.push({ name: pageTitle, pan: link, ext: { pwd: accessCode } });
            });
        }
        if (tracks.length === 0) { tracks.push({ name: "未找到有效资源", pan: '', ext: {} }); }
        return jsonify({ list: [{ title: '云盘', tracks }] });
    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `操作失败: ${e.message}`, pan: '', ext: {} }] }] });
    }
}
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
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
    });
    return jsonify({ list: cards });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
log('海绵小站插件加载完成 (v49.0 - 代理调试版)');
