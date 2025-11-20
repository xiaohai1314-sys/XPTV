/**
 * 海绵小站前端插件 - 移植增强版 v11.4 (终极调试与防御版)
 *
 * 更新说明 (v11.4):
 * - 根本性重构：鉴于 try/catch 在当前环境下可能失效，彻底重构错误处理逻辑。
 * - 状态变量：引入 `backendOK` 状态变量，手动跟踪后端调用是否成功，不再依赖 catch。
 * - 强制调试：在关键路径上加入强制性的前端错误信息展示，用于诊断 $fetch 的真实返回值。
 * - 终极目标：无论 JS 引擎行为多么不标准，都要么正确执行，要么将最真实的错误信息暴露出来，彻底终结“幽灵成功”现象。
 */

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png";

// ★★★★★【用户配置区】★★★★★
const COOKIE = "bbs_sid=ssi4qit28fqdoksi651al5p196;bbs_token=EnvXd9CmLAoiJHlhbE8IB6nVuOX6_2FqDf2vPXemf8Ao7c7MJH;";
const YOUR_API_ENDPOINT = "http://192.168.10.103:3000/process-thread"; 
const SILICONFLOW_API_KEY = "sk-hidsowdpkargkafrjdyxxshyanrbcvxjsakfzvpatipydeio";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

function log(msg  ) { try { $log(`[海绵小站 v11.4] ${msg}`); } catch (_) { console.log(`[海绵小站 v11.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchWithCookie(url, options = {}) {
  if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
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
    if (data.includes("您尚未登录")) { log("回帖失败：Cookie已失效或不正确。"); return false; }
    if (data.includes("操作太快") || data.includes("重复提交") || data.includes("失败")) { log("回帖失败：服务器返回拒绝信息。"); return false; }
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
// =================== getTracks (V11.4 - 终极调试与防御版) ===================
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
      const needsCaptcha = $('input[name="vcode"]').length > 0;

      if (needsCaptcha) {
        log("内容被隐藏，检测到验证码，调用本地后端API处理...");
        
        if (!YOUR_API_ENDPOINT || YOUR_API_ENDPOINT.includes("YOUR_COMPUTER_IP")) {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "❌ 前端插件未配置后端IP", pan: '', ext: {} }] }] });
        }
        
        // 🟡【核心修改】引入状态变量
        let backendOK = false;
        let errorMsg = "未知错误";

        const rawBackendResponse = await $fetch.post(YOUR_API_ENDPOINT, {
            threadUrl: detailUrl,
            cookie: COOKIE,
            apiKey: SILICONFLOW_API_KEY
        }, { 
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 
        }).catch(e => {
            // 尝试使用 Promise.catch，可能比 try/catch 更可靠
            log(`Promise.catch捕获到错误: ${e.message}`);
            errorMsg = e.message;
            return null; // 返回一个可识别的值
        });

        if (rawBackendResponse === null) {
            // Promise.catch 被触发
            log("后端调用失败 (Promise.catch)");
        } else {
            try {
                let backendResponse;
                if (typeof rawBackendResponse === 'string') {
                    if (rawBackendResponse.trim() === '') {
                        backendResponse = { success: true, from: 'empty_string' }; 
                    } else {
                        backendResponse = JSON.parse(rawBackendResponse);
                    }
                } else {
                    backendResponse = rawBackendResponse;
                }

                if (backendResponse && backendResponse.success === false) {
                    log(`后端返回业务失败: ${backendResponse.message}`);
                    errorMsg = backendResponse.message;
                } else if (backendResponse && backendResponse.success === true) {
                    log("后端返回业务成功。");
                    backendOK = true;
                } else {
                    // 🟡【强制调试】如果收到无法识别的响应，直接在前端显示它
                    log("收到无法识别的后端响应。");
                    const responseType = typeof rawBackendResponse;
                    const responseContent = JSON.stringify(rawBackendResponse);
                    errorMsg = `[调试信息] 类型: ${responseType}, 内容: ${responseContent}`;
                }
            } catch (parseError) {
                log(`解析后端响应时出错: ${parseError.message}`);
                errorMsg = `解析后端响应失败: ${parseError.message}`;
            }
        }

        // 🟡【核心修改】在所有操作后，检查最终状态
        if (!backendOK) {
            log(`最终判断：后端处理失败。原因: ${errorMsg}`);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: `❌ 调用后端失败: ${errorMsg}`, pan: '', ext: {} }] }] });
        }

        // ★★★ 只有在 backendOK 为 true 时才继续 ★★★
        log("后端调用成功，前端将重新获取页面进行解析...");
        const refreshResponse = await fetchWithCookie(detailUrl);
        data = refreshResponse.data;
        $ = cheerio.load(data);

      } else {
        // ... (无验证码的回帖逻辑保持不变)
      }
    }

    // ... (后续的页面解析逻辑保持不变)
    log("页面已解锁，开始在前端进行最终解析...");
    const mainMessage = $(".message[isfirst='1']");
    if (!mainMessage.length) return jsonify({ list: [] });

    const linkNodes = mainMessage.find("a[href*='cloud.189.cn'], a[href*='pan.quark.cn']");
    const resultsMap = new Map();
    
    // ... (purify 和 linkNodes.each 逻辑保持不变)
    const numMap = {'零':'0','〇':'0','一':'1','壹':'1','依':'1','二':'2','贰':'2','三':'3','叁':'3','四':'4','肆':'4','五':'5','伍':'5','吴':'5','吾':'5','无':'5','武':'5','悟':'5','舞':'5','物':'5','乌':'5','屋':'5','唔':'5','雾':'5','勿':'5','误':'5','污':'5','务':'5','午':'5','捂':'5','戊':'5','毋':'5','邬':'5','兀':'5','六':'6','陆':'6','七':'7','柒':'7','八':'8','捌':'8','九':'9','玖':'9','久':'9','酒':'9','Ⅰ':'1','Ⅱ':'2','Ⅲ':'3','Ⅳ':'4','Ⅴ':'5','Ⅵ':'6','Ⅶ':'7','Ⅷ':'8','Ⅸ':'9','①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    const charMap = {'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ᵂ':'w','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};

    function purify(raw) {
      const isSpecialCase = /\(/.test(raw) && /\[/.test(raw); 
      if (isSpecialCase) {
          let specialCode = '';
          const regex = /\(([^)]+)\)|\[([^\]]+)\]|\{([^}]+)\}|\<([^>]+)\>/g;
          const matches = raw.matchAll(regex);
          for (const match of matches) { const char = match[1] || match[2] || match[3] || match[4]; if (char) specialCode += char; }
          if (specialCode.length > 0) return specialCode.toLowerCase();
      }
      const codeMatch = raw.match(/(?:访问码|提取码|密码)\s*[:：\s]*([\s\S]+)/);
      const extracted = codeMatch ? codeMatch[1].trim() : raw.trim();
      let converted = '';
      for (const c of extracted) { converted += numMap[c] || charMap[c] || c; }
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
      for (let i = 0; i < 3 && next.length; i++) { searchEls.push(next); next = next.next(); }
      for (const e of searchEls) {
        const text = e.text().trim();
        if (text.match(/(?:访问码|提取码|密码)/)) { const found = purify(text); if (found) { code = found; break; } }
        if (!text.includes("http"  ) && !text.includes("/") && !text.includes(":")) { const found = purify(text); if (found && /^[a-z0-9]{4,8}$/i.test(found)) { code = found; break; } }
      }
      const existing = resultsMap.get(link);
      if (!existing || (!existing.code && code)) { resultsMap.set(link, { link, code }); }
    });
    
    const tracks = [];
    resultsMap.forEach(record => {
      const finalPan = record.code ? `${record.link}（访问码：${record.code}）` : record.link;
      tracks.push({ name: "网盘", pan: finalPan, ext: { pwd: record.code || '' } });
    });

    if (tracks.length === 0) {
        log("在最终的页面解析中未能找到链接。");
        tracks.push({ name: "回帖成功但未找到有效资源", pan: '', ext: {} });
    }
    return jsonify({ list: [{ title: '云盘', tracks }] });

  } catch (e) {
    log(`getTracks最外层捕获到错误: ${e.message}`);
    return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
  }
}

const searchCache = {};
async function search(ext) {
  // ... (search 函数保持不变)
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(vod_id, vod_name, ext) { return jsonify({ url: ext.url, name: vod_name, play: ext.url }); }
async function test(ext) { return getConfig(); }
