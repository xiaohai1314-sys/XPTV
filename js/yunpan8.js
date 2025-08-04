/**
 * 海绵小站前端插件 - v17.5 (输出逻辑精确复刻版)
 * 
 * 更新日志:
 * - 【v17.5 最终修正】向用户致歉，并严格遵循用户提供的v6脚本逻辑，明确脚本的核心任务是“拆分”而非“合成”。
 * - 【v17.5 核心重构】getTracks函数现在将抓取到的纯链接和纯访问码，分别放入App播放器能直接识别的 `pan` 和 `ext: { pwd: ... }` 字段。
 *    这100%复刻了v6脚本的输出格式，是从根本上解决问题的正确方案。
 * - 【v17.4 逻辑保留】继续沿用已验证正确的“快慢车道”、“提取码去脏”等高级抓取逻辑。
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
function log(msg ) { try { $log(`[海绵小站 V17.5] ${msg}`); } catch (_) { console.log(`[海绵小站 V17.5] ${msg}`); } }
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

// --- getTracks (核心业务逻辑 - V17.5 输出逻辑精确复刻版) ---
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
        const fullMessageText = mainMessage.text();
        const tracks = [];
        const seenUrls = new Set();

        let globalAccessCode = '';
        const passMatch = fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
        if (passMatch && passMatch[1]) {
            globalAccessCode = passMatch[1].replace(/[^a-zA-Z0-9]/g, '');
            log(`成功解析并清洗提取码: ${globalAccessCode}`);
        }

        // 快车道
        mainMessage.find('a').each((_, linkElement) => {
            const pureLink = $(linkElement).attr('href');
            if (pureLink && pureLink.includes('cloud.189.cn') && !seenUrls.has(pureLink)) {
                seenUrls.add(pureLink);
                let fileName = $(linkElement).text().trim();
                if (!fileName || fileName === pureLink || fileName.includes('http' )) {
                   fileName = $("h4.break-all").text().trim() || "网盘链接";
                }
                
                tracks.push({
                    name: fileName,
                    pan: pureLink,
                    ext: { pwd: globalAccessCode }
                });
            }
        });

        if (tracks.length > 0) {
            log(`快车道成功，提取到 ${tracks.length} 个链接。`);
            return jsonify({ list: [{ title: '云盘', tracks }] });
        }

        // 慢车道
        const linksToVisit = [];
        mainMessage.find('a').each((_, linkElement) => {
            const href = $(linkElement).attr('href');
            if (href && href.startsWith('outlink-')) {
                linksToVisit.push({ url: href, fileName: $(linkElement).text().trim() || $("h4.break-all").text().trim() });
            }
        });

        if (linksToVisit.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: "未找到有效资源", pan: '', ext: {} }] }] });
        }

        for (const linkInfo of linksToVisit) {
            const outlinkUrl = `${SITE_URL}/${linkInfo.url}`;
            try {
                const outlinkResponse = await fetchWithCookie(outlinkUrl);
                const $outlink = cheerio.load(outlinkResponse.data);
                const pureLink = $outlink('.alert.alert-info a').attr('href');

                if (pureLink && !seenUrls.has(pureLink)) {
                    seenUrls.add(pureLink);
                    tracks.push({
                        name: linkInfo.fileName,
                        pan: pureLink,
                        ext: { pwd: globalAccessCode }
                    });
                }
            } catch (e) {
                log(`请求中转链接 ${outlinkUrl} 失败: ${e.message}`);
            }
        }
        
        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}

// --- 其他函数 (getConfig, getCards, search等) ---
async function getConfig() {
  log("插件初始化 (v17.5 - 输出逻辑精确复刻版)");
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

log('海绵小站插件加载完成 (v17.5 - 输出逻辑精确复刻版)');
