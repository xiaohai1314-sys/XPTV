/**
 * 海绵小站前端插件 - 移植增强版 v8.2 (手动验证码 + 单次回帖 + 多次刷新)
 *
 * 更新说明:
 * - 基于 v8.1 移植增强版
 * - 增加了手动输入字母/数字验证码回帖功能，以适应网站更新。
 * - 回帖时自动从页面抓取 formhash 和 sechash，提高成功率。
 * - 保留了单次回帖和多次刷新机制，解决解锁延迟问题。
 * - 保留并启用 search cache。
 */

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ★★★★★【用户配置区 - Cookie】 ★★★★★
// 请在这里填入您自己的Cookie字符串
const COOKIE = "bbs_sid=xxxxxxxx;bbs_token=xxxxxxxx;";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 辅助函数 ---
function log(msg ) { try { $log(`[海绵小站 v8.2] ${msg}`); } catch (_) { console.log(`[海绵小站 v8.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchWithCookie(url, options = {}) {
  if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE") || COOKIE.includes("xxxxxxxx")) {
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

function getCorrectPicUrl(path) {
  if (!path) return FALLBACK_PIC;
  if (path.startsWith('http' )) return path;
  const cleanPath = path.startsWith('./') ? path.substring(2) : path;
  return `${SITE_URL}/${cleanPath}`;
}

// =================================================================================
// =================== reply (已改造，支持验证码) ===================
// =================================================================================
async function reply(url, pageData, seccode) {
  log("尝试使用Cookie及验证码自动回帖...");
  const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
  const threadIdMatch = url.match(/thread-(\d+)/);
  if (!threadIdMatch) return false;

  const $ = cheerio.load(pageData);
  const formhash = $("input[name='formhash']").val();
  // 某些页面sechash在input里，某些在img的src里，优先从input取
  let sechash = $("input[name='sechash']").val();
  if (!sechash) {
      const seccodeImgSrc = $("img[src*='mod=seccode']").attr('src');
      const sechashMatch = seccodeImgSrc ? seccodeImgSrc.match(/sechash=([a-zA-Z0-9]+)/) : null;
      if (sechashMatch) {
          sechash = sechashMatch[1];
      }
  }

  if (!formhash || !sechash) {
      log("回帖失败：无法在页面上找到 formhash 或 sechash。");
      $utils.toastError("无法获取必要的回帖参数", 3000);
      return false;
  }
  log(`获取到 formhash: ${formhash}, sechash: ${sechash}`);

  const threadId = threadIdMatch[1];
  const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
  
  const postData = {
      doctype: 1,
      return_html: 1,
      message: getRandomText(replies),
      quotepid: 0,
      quick_reply_message: 0,
      formhash: formhash,
      sechash: sechash,
      seccodeverify: seccode // 提交用户输入的验证码
  };

  try {
    const { data } = await fetchWithCookie(postUrl, { method: 'POST', body: postData, headers: { 'Referer': url } });
    if (data.includes("您尚未登录")) {
      log("回帖失败：Cookie已失效或不正确。");
      $utils.toastError("Cookie已失效，请重新获取", 3000);
      return false;
    }
    if (data.includes("验证码不正确")) {
      log("回帖失败：验证码不正确。");
      $utils.toastError("验证码输入错误", 3000);
      return false;
    }
    log("回帖成功！");
    return true;
  } catch (e) {
    log(`回帖请求异常: ${e.message}`);
    return false;
  }
}

// =================================================================================
// =================== getTracks (已改造，增加验证码输入流程) ===================
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
      log("内容被隐藏，启动回帖流程...");

      // 1. 从页面解析验证码图片URL
      const seccodeImageUrl = $("img[src*='mod=seccode']").attr('src');
      if (!seccodeImageUrl) {
          log("无法找到验证码图片，流程中止。");
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "无法找到验证码，请检查脚本", pan: '', ext: {} }] }] });
      }
      const fullSeccodeUrl = seccodeImageUrl.startsWith('http' ) ? seccodeImageUrl : `${SITE_URL}/${seccodeImageUrl}`;
      log(`验证码图片地址: ${fullSeccodeUrl}`);

      // 2. 弹出WebView或输入框让用户输入验证码
      // 这是一个关键的交互步骤，这里的实现方式依赖于具体的脚本运行环境
      // 您需要确保您的环境支持类似 $utils.input 的功能
      const userInputCode = await $utils.input({
          title: '请输入验证码',
          hint: '请输入下方图片中的字母/数字',
          header: `<img src="${fullSeccodeUrl}" style="width:150px; height:50px; border:1px solid #ccc; margin: 0 auto; display: block;"/>`
      });

      if (!userInputCode) {
          log("用户取消输入验证码。");
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "用户取消操作", pan: '', ext: {} }] }] });
      }
      log(`用户输入的验证码: ${userInputCode}`);

      // 3. 调用改造后的reply函数
      const replied = await reply(detailUrl, data, userInputCode);

      if (replied) {
        // 回帖成功后，多次刷新以确保内容加载
        for (let i = 0; i < 3; i++) {
          await $utils.sleep(1500);
          const retryResponse = await fetchWithCookie(detailUrl);
          data = retryResponse.data;
          if (!data.includes("回复后")) {
            log(`第 ${i + 1} 次刷新后成功解锁资源`);
            break;
          } else {
            log(`第 ${i + 1} 次刷新仍未解锁，继续尝试...`);
          }
        }
        $ = cheerio.load(data);
      } else {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: "回帖失败，无法获取资源", pan: '', ext: {} }] }] });
      }
    }

    // --- 后续的资源解析逻辑 (与原版v8.1相同) ---
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
        if (!text.includes("http" ) && !text.includes("/") && !text.includes(":")) {
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
    return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
  }
}

// --- 以下是原版脚本的其他函数，保持不变 ---

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

  if (searchCache.data && searchCache.data[page - 1]) {
    return jsonify({ list: searchCache.data[page - 1], pagecount: searchCache.pagecount, total: searchCache.total });
  }

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

    let pagecount = 0;
    $('ul.pagination a.page-link').each((_, link) => {
      const p = parseInt($(link).text().trim());
      if (!isNaN(p)) pagecount = Math.max(pagecount, p);
    });

    const total = cards.length;

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

// --- 兼容入口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
