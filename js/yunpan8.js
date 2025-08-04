/**
 * 海绵小站前端插件 - v16.1 (Cookie登录方案 - 已配置)
 * 
 * 更新日志:
 * - 【v16.1 已配置】根据用户提供的Cookie截图，已将所有必要的Cookie值组合并填入脚本。
 * - 【v16.0 终极方案】采纳用户建议，启用前端Cookie登录。这是目前最稳定、最高效、最可靠的方案。
 * - 【v16.0 用户配置】在脚本顶部增加COOKIE配置区，用户只需配置一次，即可长期享受登录状态。
 * - 【v16.0 全局授权】所有需要权限的网络请求($fetch)都将自动携带配置的Cookie，实现无缝登录。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// ★★★★★【用户配置区 - Cookie】★★★★★
// 已根据您提供的截图，将Cookie值填写完毕。
const COOKIE = "_xn_accesscount_visited=1; BAIDUID_BFESS=82BB2F2D056FEA224952A3CCB69C40BA:FG=1; bbs_sid=3v5fdrevvvrrbpnuvbmtuv9nci; bbs_token=n_2FnvY5D4BrjB5UnJMoCsNF4MqzeOqI46EbISj_2FirjryKnVtp; guard=DcF2FicbtLwkC6o/wp0nFQ==; guardret=56; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754300299; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753863470,1753865018; HMACCOUNT=8ECC86F14D9CE668; HMACCOUNT_BFESS=8ECC86F14D9CE668";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V16] ${msg}`); } catch (_) { console.log(`[海绵小站 V16] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求封装 (自动注入Cookie) ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE === "YOUR_COOKIE_STRING_HERE") {
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }

    const headers = {
        'User-Agent': UA,
        'Cookie': COOKIE,
        ...options.headers,
    };

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

// --- getTracks (核心业务逻辑) ---
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
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: "" }] }] });
            }
        }

        const tracks = [];
        const mainMessage = $('.message[isfirst="1"]');
        mainMessage.find('a').each((_, linkElement) => {
            let link = $(linkElement).attr('href');
            if (link && (link.includes('cloud.189.cn') || link.includes('pan.quark.cn') || link.includes('www.alipan.com'))) {
                let fileName = $(linkElement).text().trim() || '未知文件名';
                tracks.push({ name: fileName, pan: link });
            }
        });

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源，或需要回复", pan: "" });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: "" }] }] });
    }
}


// 其他函数 (getConfig, getCards, search等) 保持不变
async function getConfig() {
  log("插件初始化 (v16.1 - Cookie已配置)");
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

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${SITE_URL}/${id}-${page}.htm`;
  try {
    const { data } = await fetchWithCookie(url);
    const $ = cheerio.load(data);
    const cards = [];
    $("ul.threadlist > li.media.thread").each((_, item) => {
        cards.push({
            vod_id: $(item).find(".subject a")?.attr("href") || "",
            vod_name: $(item).find(".subject a")?.text().trim() || "",
            vod_pic: $(item).find("a > img.avatar-3")?.attr("src") || "",
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
            ext: { url: $(item).find(".subject a")?.attr("href") || "" }
        });
    });
    return jsonify({ list: cards });
  } catch(e) {
    return jsonify({ list: [] });
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
        cards.push({
            vod_id: $(item).find(".subject a")?.attr("href") || "",
            vod_name: $(item).find(".subject a")?.text().trim() || "",
            vod_pic: $(item).find("a > img.avatar-3")?.attr("src") || "",
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
            ext: { url: $(item).find(".subject a")?.attr("href") || "" }
        });
    });
    return jsonify({ list: cards });
  } catch(e) {
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v16.1 - Cookie已配置)');
