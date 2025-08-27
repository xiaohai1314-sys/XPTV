/**
 * 海绵小站前端插件 - 移植增强版 v9.1 (本地后端驱动 + 原始排版)
 *
 * 更新说明:
 * - 采用稳定的“本地后端API”方案解决自动回帖问题。
 * - 脚本排版和函数顺序严格遵循原始版本，便于维护。
 * - 链接和密码的提取逻辑完全保留，未做任何改动。
 */

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ★★★★★【用户配置区】★★★★★
const COOKIE = "bbs_sid=u55b2g9go9dhrv2l8jbfi4ulbu;bbs_token=5jxAYKEsRRLmEOSTucp4huSjUdwT6cz6JgyNX_2FmPcvUMGMu0;";
const SILICONFLOW_API_KEY = "sk-hidsowdpkargkafrjdyxxshyanrbcvxjsakfzvpatipydeio";
// ★★★ 请将下面的IP地址和端口替换为您自己的 ★★★
const YOUR_API_ENDPOINT = "http://192.168.10.111:3000/process-thread"; 
// 例如: "http://192.168.1.108:3000/process-thread"
// ★★★★★★★★★★★★★★★★★★★★★★★★★

function log(msg  ) { try { $log(`[海绵小站 v9.1] ${msg}`); } catch (_) { console.log(`[海绵小站 v9.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchWithCookie(url, options = {}) {
  if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE") || COOKIE.length < 20) {
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

// 注意：下面的 reply 函数在新的逻辑中已不再被 getTracks 调用，但为保持结构完整性而保留。
// =================================================================================
// =================== reply (此函数已废弃) ===================
// =================================================================================
async function reply(url) {
  // 此函数在新架构下已不再使用，所有逻辑均由后端处理。
  log("警告：reply函数被意外调用，此函数在新版中已废弃。");
  return false;
}

async function getConfig() {
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
  } catch (e) {
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== getTracks (本地后端驱动版) ===================
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

    // --- 检测是否需要回帖 ---
    if ($("div.alert.alert-warning").text().includes("回复后")) {
      log("内容被隐藏，调用本地后端API处理...");
      
      if (YOUR_API_ENDPOINT.includes("YOUR_COMPUTER_IP")) {
          $utils.toastError("请先在插件脚本中配置您电脑的IP地址！", 5000);
          return jsonify({ list: [{ title: '错误', tracks: [{ name: "前端插件未配置后端IP", pan: '', ext: {} }] }] });
      }

      // 调用后端API，将所有复杂工作交给后端
      const apiResponse = await $fetch.post(YOUR_API_ENDPOINT, {
          threadUrl: detailUrl,
          cookie: COOKIE,
          apiKey: SILICONFLOW_API_KEY
      }, {
          headers: { 'Content-Type': 'application/json' }
      });

      if (apiResponse.data && apiResponse.data.success) {
          log("后端API处理成功！");
          // 后端返回的数据已经是插件所需的完整格式，直接返回即可
          return jsonify(apiResponse.data); 
      } else {
          const errorMessage = apiResponse.data ? apiResponse.data.message : "无法连接到本地后端。";
          log(`后端API处理失败: ${errorMessage}`);
          $utils.toastError(`API错误: ${errorMessage}`, 4000);
          return jsonify({ list: [{ title: '错误', tracks: [{ name: `API错误: ${errorMessage}`, pan: '', ext: {} }] }] });
      }
    }

    // --- 如果无需回帖，则执行原始的提取逻辑 ---
    log("无需回帖，使用原始逻辑直接解析页面。");
    const mainMessage = $(".message[isfirst='1']");
    if (!mainMessage.length) return jsonify({ list: [] });

    const linkNodes = mainMessage.find("a[href*='cloud.189.cn'], a[href*='pan.quark.cn']");
    const resultsMap = new Map();

    const numMap = {'零':'0','〇':'0','一':'1','壹':'1','依':'1','二':'2','贰':'2','三':'3','叁':'3','四':'4','肆':'4','五':'5','伍':'5','吴':'5','吾':'5','无':'5','武':'5','悟':'5','舞':'5','物':'5','乌':'5','屋':'5','唔':'5','雾':'5','勿':'5','误':'5','污':'5','务':'5','午':'5','捂':'5','戊':'5','毋':'5','邬':'5','兀':'5','六':'6','陆':'6','七':'7','柒':'7','八':'8','捌':'8','九':'9','玖':'9','久':'9','酒':'9','Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    const charMap = {'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ᵂ':'w','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};

    function purify(raw) {
      const codeMatch = raw.match(/(?:访问码|提取码|密码)\s*[:：\s]*([\s\S]+)/);
      const extracted = codeMatch ? codeMatch[1].trim() : raw.trim();
      let converted = '';
      for (const c of extracted) {
        converted += numMap[c] || charMap[c] || c;
      }
      const finalMatch = converted.match(/^[a-zA-Z0-9]+/);
      return finalMatch ? finalMatch[0].toLowerCase() : null;
    }

    linkNodes.each((_, node) => {
      const link = $(node).attr("href");
      let code = null;
      let el = $(node).closest("p, div, h3");
      if (!el.length) el = $(node);

      const searchEls = [el];
      let next = el.next();
      for (let i = 0; i < 3 && next.length; i++) {
        searchEls.push(next);
        next = next.next();
      }

      for (const e of searchEls) {
        const text = e.text().trim();
        if (text.match(/(?:访问码|提取码|密码)/)) {
          const found = purify(text);
          if (found) { code = found; break; }
        }
        if (!text.includes("http"  ) && !text.includes("/") && !text.includes(":")) {
          const found = purify(text);
          if (found && /^[a-z0-9]{4,8}$/i.test(found)) { code = found; break; }
        }
      }

      const existing = resultsMap.get(link);
      if (!existing || (!existing.code && code)) {
        resultsMap.set(link, { link, code });
      }
    });

    const tracks = [];
    resultsMap.forEach(record => {
      const finalPan = record.code ? `${record.link}（访问码：${record.code}）` : record.link;
      tracks.push({ name: "网盘", pan: finalPan, ext: { pwd: record.code || '' } });
    });

    if (tracks.length === 0) tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
    return jsonify({ list: [{ title: '云盘', tracks }] });

  } catch (e) {
    log(`getTracks错误: ${e.message}`);
    return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查网络和本地后端服务", pan: '', ext: {} }] }] });
  }
}
// =================================================================================

// ======= search（带 cache）=======
const searchCache = {};
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = ext.page || 1;
  if (!text) return jsonify({ list: [] });

  // 命中不同关键词时重置缓存
  if (searchCache.keyword !== text) {
    searchCache.keyword = text;
    searchCache.data = [];
    searchCache.pagecount = 0;
    searchCache.total = 0;
  }

  // 命中页缓存
  if (searchCache.data && searchCache.data[page - 1]) {
    return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total });
  }

  // 页越界保护
  if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
    return jsonify({ list: [], pagecount: searchCache.pagecount, total: searchCache.total });
  }

  const url = page === 1
    ? `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`
    : `${SITE_URL}/search-${encodeURIComponent(text)}-1-0-${page}.htm`;

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

    // 计算分页总数
    let pagecount = 0;
    $('ul.pagination a.page-link').each((_, link) => {
      const p = parseInt($(link).text().trim());
      if (!isNaN(p)) pagecount = Math.max(pagecount, p);
    });

    const total = cards.length;

    // 写入缓存
    if (!searchCache.data) searchCache.data = [];
    searchCache.data[page - 1] = cards;
    searchCache.pagecount = pagecount;
    searchCache.total = total;

    return jsonify({ list: cards, pagecount, total });
  } catch (e) {
    log(`search错误: ${e.message}`);
    return jsonify({ list: [], pagecount: 0, total: 0 });
  }
}

// ======= 兼容入口 =======
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
