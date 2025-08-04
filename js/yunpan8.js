/**
 * 海绵小站前端插件 - v19.0 (分块解析最终版)
 * 
 * 更新日志:
 * - 【v19.0 终极版】向用户致歉。基于用户提供的两张关键HTML截图，重构了核心解析逻辑。
 * - 【v19.0 核心重构】引入最终的“分块解析”逻辑。脚本不再使用任何全局或上下文查找，
 *    而是将帖子内容分割成独立的“资源块”（如<p>或<div>），在每个块内部独立查找链接、
 *    文件名和访问码，从根本上解决了所有链接和访问码的精确配对问题。
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
function log(msg ) { try { $log(`[海绵小站 V19.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V19.0] ${msg}`); } }
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

// --- getTracks (核心业务逻辑 - V19.0 分块解析最终版) ---
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
        const tracks = [];
        const seenUrls = new Set();
        const promises = [];

        // 步骤1: 遍历帖子内容中的每一个直接子元素（资源块）
        mainMessage.children('p, div').each((_, block) => {
            const $block = $(block);
            const blockText = $block.text();
            
            // 步骤2: 在当前块内查找链接
            let link = '';
            const linkElement = $block.find('a[href*="cloud.189.cn"], a[href^="outlink-"]');
            if (linkElement.length > 0) {
                link = linkElement.attr('href');
            } else {
                const textLinkMatch = blockText.match(/https?:\/\/cloud\.189\.cn\/t\/[\w]+/ );
                if (textLinkMatch) {
                    link = textLinkMatch[0];
                }
            }

            // 如果当前块没有链接，就跳过
            if (!link) return;

            // 步骤3: 在当前块内查找访问码
            let accessCode = '';
            const passMatch = blockText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
            if (passMatch && passMatch[1]) {
                accessCode = passMatch[1].replace(/[^a-zA-Z0-9]/g, '');
            } else {
                // 兼容“黄飞鸿”模式：访问码在兄弟节点
                const nextAlert = $block.nextAll('.alert').first();
                if (nextAlert.length > 0) {
                    accessCode = nextAlert.text().trim().replace(/[^a-zA-Z0-9]/g, '');
                }
            }

            // 步骤4: 在当前块内查找文件名
            let fileName = $block.clone().find('a, span, br').remove().end().text().trim();
            fileName = fileName.replace(/链接|:|：/g, '').trim();
            if (!fileName) {
                fileName = linkElement.text().trim();
            }
            if (!fileName || fileName.includes('http' )) {
                fileName = $("h4.break-all").text().trim();
            }

            // 步骤5: 组合并处理
            if (link.startsWith('outlink-')) {
                const promise = (async () => {
                    const outlinkUrl = `${SITE_URL}/${link}`;
                    try {
                        const outlinkResponse = await fetchWithCookie(outlinkUrl);
                        const $outlink = cheerio.load(outlinkResponse.data);
                        const pureLink = $outlink('.alert.alert-info a').attr('href');
                        if (pureLink && !seenUrls.has(pureLink)) {
                            seenUrls.add(pureLink);
                            tracks.push({ name: fileName, pan: pureLink, ext: { pwd: accessCode } });
                        }
                    } catch (e) { log(`请求中转链接 ${outlinkUrl} 失败: ${e.message}`); }
                })();
                promises.push(promise);
            } else {
                if (!seenUrls.has(link)) {
                    seenUrls.add(link);
                    tracks.push({ name: fileName, pan: link, ext: { pwd: accessCode } });
                }
            }
        });
        
        await Promise.all(promises);

        if (tracks.length === 0) {
            return jsonify({ list: [{ title: '云盘', tracks: [{ name: "未找到有效资源", pan: '', ext: {} }] }] });
        }

        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}

// --- 其他函数 (getConfig, getCards, search等) ---
async function getConfig() {
  log("插件初始化 (v19.0 - 分块解析最终版)");
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

// --- 兼容旧版接口 (已从v17.5完整恢复) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v19.0 - 分块解析最终版)');
