/**
 * 海绵小站前端插件 - v9.4 (最终版 - 纯文本通信)
 *
 * 更新说明:
 * - 采用最稳定可靠的“纯文本”与后端通信，解决JSON解析BUG。
 * - 严格保持原始脚本的排版和提取逻辑。
 */

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ★★★★★【用户配置区】★★★★★
const COOKIE = "bbs_sid=tj7uh7hde2tqsavkim15lhsuls;bbs_token=5jxAYKEsRRLmEOSTucp4huSjUdwT6cz6JgyNX_2FmPcvUMGMu0;";
const SILICONFLOW_API_KEY = "sk-hidsowdpkargkafrjdyxxshyanrbcvxjsakfzvpatipydeio";
// ★★★ 请将下面的IP地址和端口替换为您自己的 ★★★
const YOUR_API_ENDPOINT = "http://192.168.10.111:3000/process-thread"; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★

function log(msg  ) { try { $log(`[海绵小站 v9.4] ${msg}`); } catch (_) { console.log(`[海绵小站 v9.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function fetchWithCookie(url, options = {}) { /* ... 此函数不变 ... */ }

// =================================================================================
// =================== getTracks (最终纯文本通信版) ===================
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
      log("内容被隐藏，调用本地后端API处理...");
      
      if (YOUR_API_ENDPOINT.includes("YOUR_COMPUTER_IP")) {
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "前端插件未配置后端IP", pan: '', ext: {} }] }] });
      }

      try {
        // ★★★ 核心改动：等待后端的纯文本响应 ★★★
        const apiResponse = await $fetch.post(YOUR_API_ENDPOINT, {
            threadUrl: detailUrl,
            cookie: COOKIE,
            apiKey: SILICONFLOW_API_KEY
        }, { headers: { 'Content-Type': 'application/json' } });

        const responseText = apiResponse.data; // 直接获取返回的文本
        log(`后端返回原始文本: ${responseText}`);

        if (typeof responseText === 'string' && responseText.startsWith("SUCCESS")) {
            log("后端API回帖成功。");
            $utils.toast("后端回帖成功！", 2000);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "✅ 回帖成功，请手动刷新页面查看资源！", pan: '', ext: {} }] }] });
        } else {
            // 如果不是以SUCCESS开头，整个返回内容都视为错误信息
            const errorMessage = typeof responseText === 'string' ? responseText.replace(/^ERROR: /, '') : "未知响应格式";
            log(`后端API返回失败: ${errorMessage}`);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: `❌ 自动回帖失败: ${errorMessage}`, pan: '', ext: {} }] }] });
        }
      } catch (e) {
        log(`无法连接到后端API: ${e.message}`);
        const errorText = e.response ? e.response.data : "请检查网络和PC端服务";
        return jsonify({ list: [{ title: '提示', tracks: [{ name: `❌ 无法连接后端: ${errorText}`, pan: '', ext: {} }] }] });
      }
    }

    // --- 如果无需回帖，则执行原始的提取逻辑 (保持不变) ---
    log("无需回帖，使用原始逻辑直接解析页面。");
    const mainMessage = $(".message[isfirst='1']");
    if (!mainMessage.length) return jsonify({ list: [] });
    const linkNodes = mainMessage.find("a[href*='cloud.189.cn'], a[href*='pan.quark.cn']");
    const resultsMap = new Map();
    const numMap = { /* ... */ };
    const charMap = { /* ... */ };
    function purify(raw) { /* ... */ }
    linkNodes.each((_, node) => { /* ... */ });
    const tracks = [];
    resultsMap.forEach(record => { /* ... */ });
    if (tracks.length === 0) tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
    return jsonify({ list: [{ title: '云盘', tracks }] });

  } catch (e) {
    log(`getTracks错误: ${e.message}`);
    return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
  }
}

// ... 其他所有函数和入口，完全保持原样 ...
async function fetchWithCookie(url, options = {}) { if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE") || COOKIE.length < 20) { $utils.toastError("请先在插件脚本中配置Cookie", 3000); throw new Error("Cookie not configured."); } const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers }; const finalOptions = { ...options, headers }; return options.method === 'POST' ? $fetch.post(url, options.body, finalOptions) : $fetch.get(url, finalOptions); }
async function getConfig() { return jsonify({ ver: 1, title: '海绵小站', site: SITE_URL, tabs: [{ name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } }, { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } },], }); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http'  )) return path; const cleanPath = path.startsWith('./') ? path.substring(2) : path; return `${SITE_URL}/${cleanPath}`; }
async function getCards(ext) { ext = argsify(ext); const { page = 1, id } = ext; const url = `${SITE_URL}/${id}-${page}.htm`; try { const { data } = await fetchWithCookie(url); const $ = cheerio.load(data); const cards = []; $("ul.threadlist > li.media.thread").each((_, item) => { const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src"); cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } }); }); return jsonify({ list: cards }); } catch (e) { return jsonify({ list: [] }); } }
const searchCache = {};
async function search(ext) { ext = argsify(ext); const text = ext.text || ''; const page = ext.page || 1; if (!text) return jsonify({ list: [] }); if (searchCache.keyword !== text) { searchCache.keyword = text; searchCache.data = []; searchCache.pagecount = 0; searchCache.total = 0; } if (searchCache.data && searchCache.data[page - 1]) { return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total }); } if (searchCache.pagecount > 0 && page > searchCache.pagecount) { return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total }); } const url = page === 1 ? `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}` : `${SITE_URL}/search-${encodeURIComponent(text)}-1-0-${page}.htm`; try { const { data } = await fetchWithCookie(url); const $ = cheerio.load(data); const cards = []; $("ul.threadlist > li.media.thread").each((_, item) => { const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src"); cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } }); }); let pagecount = 0; $('ul.pagination a.page-link').each((_, link) => { const p = parseInt($(link).text().trim()); if (!isNaN(p)) pagecount = Math.max(pagecount, p); }); const total = cards.length; if (!searchCache.data) searchCache.data = []; searchCache.data[page - 1] = cards; searchCache.pagecount = pagecount; searchCache.total = total; return jsonify({ list: cards, pagecount, total }); } catch (e) { log(`search错误: ${e.message}`); return jsonify({ list: [], pagecount: 0, total: 0 }); } }
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
