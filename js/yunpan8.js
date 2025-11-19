/**
 * 海绵小站前端插件 - 移植增强版 v9.6 (前端智能分流 + 藏码增强)
 *
 * 更新说明:
 * - 核心：在 getTracks 中加入智能分流逻辑（无验证码走前端，有验证码走后端）。
 * - 增强：在 purify 函数中加入“符号藏码”特例解析逻辑。
 */

const SITE_URL = "https://www.hmxz.org";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.hmxz.org/view/img/logo.png";

// ★★★★★【用户配置区】★★★★★
const COOKIE = "bbs_sid=v7bm1kesngc0aovt0rgii4hibr;bbs_token=uFjSOW6anVYBjfFXr_2BQciy6ZUuVusl6c2MgezDNhWtewf6HG;";
// 请将下面的YOUR_COMPUTER_IP:3000替换为您电脑的IP地址和端口（例如: http://192.168.1.7:3000/process-thread）
const YOUR_API_ENDPOINT = "http://192.168.1.7:3000/process-thread"; 
const SILICONFLOW_API_KEY = "sk-hidsowdpkargkafrjdyxxshyanrbcvxjsakfzvpatipydeio"; // 替换为您的 API Key
// ★★★★★★★★★★★★★★★★★★★★★★★★★

function log(msg) { try { $log(`[海绵小站 v9.6] ${msg}`); } catch (_) { console.log(`[海绵小站 v9.6] ${msg}`);
} }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {};
} } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)];
}

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

// 此 reply 函数仅用于无验证码时的快速回帖
async function reply(url) {
  log("尝试使用Cookie自动回帖...");
  const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
  const threadIdMatch = url.match(/thread-(\d+)/);
  if (!threadIdMatch) return false;
  const threadId = threadIdMatch[1];
  const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
  
  // 注意：此处 postData 必须是 URLSearchParams 或类似格式
  const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 };
  
  try {
    const { data } = await fetchWithCookie(postUrl, { method: 'POST', body: postData, headers: { 'Referer': url } });
    
    // 增加对回帖失败的判断
    if (data.includes("您尚未登录")) {
      log("回帖失败：Cookie已失效或不正确。");
      $utils.toastError("Cookie已失效，请重新获取", 3000);
      return false;
    }
    if (data.includes("操作太快") || data.includes("重复提交") || data.includes("失败")) {
        log("回帖失败：服务器返回拒绝信息。");
        $utils.toastError("回帖被拒绝，可能是操作太快或内容重复", 3000);
        return false;
    }
    
    log("回帖请求已发送！");
    return true;

  } catch (e) {
    log(`回帖请求异常: ${e.message}`);
    return false;
  }
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
  } catch (e) {
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== getTracks (前端智能分流版) ===================
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

    // --- 核心逻辑：检测是否需要回帖 ---
    if ($("div.alert.alert-warning").text().includes("回复后")) {
      
      // 【智能分流判断】检测页面中是否存在验证码输入框
      const needsCaptcha = $('input[name="vcode"]').length > 0;

      if (needsCaptcha) {
        // ================== 路径 A: 有验证码，调用后端 API ==================
        log("内容被隐藏，检测到验证码，必须调用本地后端API处理...");
        
        if (!YOUR_API_ENDPOINT || YOUR_API_ENDPOINT.includes("YOUR_COMPUTER_IP")) {
            $utils.toastError("请先在插件脚本中配置您电脑的后端IP地址和API Key！", 5000);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "❌ 前端插件未配置后端IP", pan: '', ext: {} }] }] });
        }
        
        try {
          // 调用后端，后端负责识别验证码、回帖和解析
          const apiResponse = await $fetch.post(YOUR_API_ENDPOINT, {
              threadUrl: detailUrl,
              cookie: COOKIE,
              apiKey: SILICONFLOW_API_KEY
          }, { headers: { 'Content-Type': 'application/json' } });

          if (apiResponse.data && apiResponse.data.success) {
              log("后端API回帖成功。");
              $utils.toast("后端回帖成功！请退出详情页重进或刷新页面。", 3000);
              // 由于后端不返回提取内容，前端需要用户刷新以重新执行getTracks
              return jsonify({ list: [{ title: '提示', tracks: [{ name: "✅ 后端回帖成功，请刷新详情页", pan: '', ext: {} }] }] });
          } else {
              const errorMessage = apiResponse.data ? apiResponse.data.message : "未知后端错误";
              log(`后端API返回失败: ${errorMessage}`);
              $utils.toastError(`❌ 后端回帖失败: ${errorMessage}`, 5000);
              return jsonify({ list: [{ title: '提示', tracks: [{ name: `❌ 自动回帖失败: ${errorMessage}`, pan: '', ext: {} }] }] });
          }
        } catch (e) {
          log(`无法连接到后端API: ${e.message}`);
          $utils.toastError("❌ 无法连接后端，请检查网络和PC端服务", 5000);
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "❌ 无法连接后端，请检查网络和PC端服务", pan: '', ext: {} }] }] });
        }

      } else {
        // ================== 路径 B: 无验证码，使用本地回帖 ==================
        log("内容被隐藏，未检测到验证码，使用本地回帖...");
        
        const replied = await reply(detailUrl); // 使用本地 reply 函数
        
        if (replied) {
          // 单次回帖，多次刷新
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
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "❌ Cookie无效或回帖失败，无法获取资源", pan: '', ext: {} }] }] });
        }
      }
    }

    // --- 如果无需回帖，或回帖成功，则执行原始的提取逻辑 ---
    log("无需回帖或回帖已成功，使用原始逻辑直接解析页面。");
    const mainMessage = $(".message[isfirst='1']");
    if (!mainMessage.length) return jsonify({ list: [] });

    // 保持原始的链接选择器和密码提取逻辑
    const linkNodes = mainMessage.find("a[href*='cloud.189.cn'], a[href*='pan.quark.cn']");
    const resultsMap = new Map();

    const numMap = {'零':'0','〇':'0','一':'1','壹':'1','依':'1','二':'2','贰':'2','三':'3','叁':'3','四':'4','肆':'4','五':'5','伍':'5','吴':'5','吾':'5','无':'5','武':'5','悟':'5','舞':'5','物':'5','乌':'5','屋':'5','唔':'5','雾':'5','勿':'5','误':'5','污':'5','务':'5','午':'5','捂':'5','戊':'5','毋':'5','邬':'5','兀':'5','六':'6','陆':'6','七':'7','柒':'7','八':'8','捌':'8','九':'9','玖':'9','久':'9','酒':'9','Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    const charMap = {'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ᵂ':'w','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};

    function purify(raw) {
      // ================== 新增的“符号藏码”逻辑 START ==================
      // 优先处理“符号藏码”特例，例如：j(g)fr[9]v{m}6<j>k
      // 特征：字符串中包含两种括号，如此处的 '()' 和 '[]'
      const isSpecialCase = /\(/.test(raw) && /\[/.test(raw); 
      if (isSpecialCase) {
          let specialCode = '';
          // 全局匹配所有被 () [] {} <> 包裹的字符
          const regex = /\(([^)]+)\)|\[([^\]]+)\]|\{([^}]+)\}|\<([^>]+)\>/g;
          const matches = raw.matchAll(regex);
          for (const match of matches) {
              // 将第一个非空的捕获组 (match[1] 到 match[4]) 拼接到结果中
              const char = match[1] || match[2] || match[3] || match[4];
              if (char) {
                  specialCode += char;
              }
          }
          // 如果成功提取到内容，则直接返回，不再执行后续的常规逻辑
          if (specialCode.length > 0) {
              return specialCode.toLowerCase();
          }
      }
      // ================== 新增的“符号藏码”逻辑 END ====================

      // 如果不是上述特例，则执行以下原有的、完好的逻辑
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
        if (!text.includes("http") && !text.includes("/") && !text.includes(":")) {
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
async function home() { const c = await getConfig();
  const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} });
}
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id });
}
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url });
}
async function test(ext) { return getConfig(); }
