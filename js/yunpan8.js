/**
 * 海绵小站前端插件 - v17.1 (精确移植后端逻辑)
 * 
 * 更新日志:
 * - 【v17.1 核心修正】严格遵循后端脚本，实现了“快车道”与“慢车道”分离的提取逻辑。
 * - 【v17.1 修正-提取码】增加了与后端完全一致的提取码“去脏”处理，移除所有非字母数字的符号。
 * - 【v17.1 修正-文件名】优化了文件名与链接的关联逻辑，使其更智能、更干净。
 * - 【v17.0 重构】移植了后端的“两步提取”和“全局提取码”核心思想。
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
function log(msg ) { try { $log(`[海绵小站 V17.1] ${msg}`); } catch (_) { console.log(`[海绵小站 V17.1] ${msg}`); } }
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

// --- getTracks (核心业务逻辑 - V17.1 精确移植版) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        // 步骤〇：自动回复模块
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

        const mainMessage = $('.message[isfirst="1"]');
        const fullMessageText = mainMessage.text();
        const tracks = [];
        const seenUrls = new Set();

        // 全局提取码解析 (带去脏逻辑)
        let globalAccessCode = '';
        const passMatch = fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
        if (passMatch && passMatch[1]) {
            globalAccessCode = passMatch[1].replace(/[^a-zA-Z0-9]/g, '');
            log(`成功解析并清洗提取码: ${globalAccessCode}`);
        }

        // ==================== 步骤一：快车道 - 尝试直接提取 ====================
        log("进入快车道：尝试单页直接提取...");
        mainMessage.find('a').each((_, linkElement) => {
            const link = $(linkElement).attr('href');
            if (link && link.includes('cloud.189.cn') && !seenUrls.has(link)) {
                seenUrls.add(link);
                let finalUrl = link;
                if (globalAccessCode) finalUrl = `${link}（访问码：${globalAccessCode}）`;
                
                let fileName = $(linkElement).text().trim();
                if (!fileName || fileName === link || fileName.includes('http' )) {
                    const parentText = $(linkElement).closest('p, div').text() || fullMessageText;
                    fileName = parentText.split('\n')[0].trim();
                    fileName = fileName.replace(link, "").replace(passMatch ? passMatch[0] : "", "").replace(/链接|访问码|提取码|密码|:|：/gi, "").trim();
                }
                fileName = fileName || "网盘链接" + (tracks.length + 1);
                tracks.push({ name: fileName, pan: finalUrl });
            }
        });

        if (tracks.length > 0) {
            log(`快车道成功，提取到 ${tracks.length} 个链接。`);
            return jsonify({ list: [{ title: '云盘', tracks }] });
        }

        // ==================== 步骤二：慢车道 - 快车道失败，尝试两步跳转 ====================
        log("快车道失败，切换至慢车道：尝试两步跳转提取...");
        const linksToVisit = [];
        mainMessage.find('a').each((_, linkElement) => {
            const href = $(linkElement).attr('href');
            if (href && href.startsWith('outlink-')) {
                linksToVisit.push({ url: href, fileName: $(linkElement).text().trim() || "网盘链接" });
            }
        });

        if (linksToVisit.length === 0) {
            log("慢车道也未找到任何 outlink- 链接。提取失败。");
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: "未找到有效资源", pan: "" }] }] });
        }

        for (const linkInfo of linksToVisit) {
            const outlinkUrl = `${SITE_URL}/${linkInfo.url}`;
            try {
                const outlinkResponse = await fetchWithCookie(outlinkUrl);
                const $outlink = cheerio.load(outlinkResponse.data);
                const realLink = $outlink('.alert.alert-info a').attr('href');

                if (realLink && !seenUrls.has(realLink)) {
                    seenUrls.add(realLink);
                    let urlWithPass = realLink;
                    if (globalAccessCode) urlWithPass = `${realLink}（访问码：${globalAccessCode}）`;
                    tracks.push({ name: linkInfo.fileName, pan: urlWithPass });
                    log(`慢车道成功提取链接: ${realLink}`);
                }
            } catch (e) {
                log(`请求中转链接 ${outlinkUrl} 失败: ${e.message}`);
            }
        }

        log(`慢车道处理完毕，共提取到 ${tracks.length} 个链接。`);
        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: "" });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: "" }] }] });
    }
}

// --- 其他函数 (getConfig, getCards, search等) ---
async function getConfig() {
  log("插件初始化 (v17.1 - 精确移植版)");
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
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
            ext: { url: $(item).find(".subject a")?.attr("href") || "" }
        });
    });
    return jsonify({ list: cards });
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
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v17.1 - 精确移植版)');
