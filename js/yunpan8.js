/**
 * 海绵小站前端插件 - v30.4 (数据流修正最终版)
 *
 * 更新日志:
 * - 【v30.4 核心修正】基于深入沟通，最终确认问题的根源在于之前所有修改都破坏了`ext`对象的数据结构，导致详情页URL信息丢失。
 * - 【v30.4 数据流修复】修正 processAndPushTrack 函数，在向 tracks 数组添加新条目时，确保 ext 对象在包含新访问码(pwd)的同时，
 *   完整保留了从 getCards 传递过来的原始 ext 数据（尤其是 ext.url），从而保证了App后续操作的连续性。
 * - 【v30.4 兼容并蓄】保留了 v30.3.2 版本中对“剩余访问码”的正确计算逻辑，使其既能抵抗页面干扰，又能正确传递数据。
 * - 【v30.4 最终交付】这才是真正理解了您脚本数据流之后，给出的最终、完整、可运行的解决方案。
 */

// --- 配置区 (原封不动) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】(原封不动 ) ★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 (原封不动) ---
function log(msg ) { try { $log(`[海绵小站 V30.4] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.4] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求封装 (原封不动) ---
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

// --- 自动回帖 (原封不动) ---
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

// --- 核心函数 (getConfig, getCorrectPicUrl, getCards 原封不动) ---
async function getConfig() {
  log("插件初始化 (v30.4 - 数据流修正最终版)");
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
  } catch(e) {
    log(`获取卡片列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- getTracks 函数，包含最终修正 ---
async function getTracks(ext) {
    const originalExt = argsify(ext); // 保存从 getCards 传来的原始 ext 对象
    const { url } = originalExt;
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
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: originalExt }] }] });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const tracks = [];
        const seenUrls = new Set();
        const pageTitle = $("h4.break-all").text().trim();

        // ★★★★★【最终核心修正点】★★★★★
        const processAndPushTrack = (fileName, rawLink, accessCode = '') => {
            if (!rawLink || seenUrls.has(rawLink)) return;
            seenUrls.add(rawLink);

            let dataPacket = rawLink;
            if (accessCode) {
                dataPacket = `${rawLink}（访问码：${accessCode}）`;
            }
            log(`组合数据包: ${dataPacket}`);

            let pureLink = '';
            let finalAccessCode = '';
            const splitMatch = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+访问码[：:]+([^）)]+)/);
            
            if (splitMatch && splitMatch.length === 3) {
                pureLink = splitMatch[1].trim();
                finalAccessCode = splitMatch[2].trim();
            } else {
                pureLink = dataPacket.trim();
            }
            log(`拆分结果 -> 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);

            // 【数据流修正】在保留原始ext对象的基础上，添加pwd字段
            const newExt = { ...originalExt, pwd: finalAccessCode };

            tracks.push({
                name: fileName,
                pan: pureLink,
                ext: newExt, // 使用合并后的新ext对象，保证url和pwd共存
            });
        };
        // ★★★★★★★★★★★★★★★★★★★★★★★

        // 步骤 1: 提取页面上所有的潜在链接和访问码 (原封不动)
        const fullMessageText = mainMessage.text();
        const allLinksInText = (fullMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g  ) || []);
        const allCodesInText = (fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/gi) || []);
        const cleanedCodes = allCodesInText.map(code => code.replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '').replace(/[^a-zA-Z0-9]/g, ''));

        // 步骤 2: 处理<a>标签 (原封不动)
        mainMessage.find('a').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href') || '';
            const text = linkElement.text().trim();
            
            let fileName = text;
            if (!fileName || fileName.startsWith('http'  )) {
                fileName = pageTitle;
            }

            let targetLink = '';
            if (href.includes('cloud.189.cn')) {
                targetLink = href;
            } else if (text.includes('cloud.189.cn')) {
                targetLink = text;
            }

            if (targetLink) {
                let accessCode = '';
                const parentText = linkElement.parent().text();
                const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
                
                if (preciseMatch && preciseMatch[1]) {
                    accessCode = preciseMatch[1].replace(/[^a-zA-Z0-9]/g, '');
                    log(`[A标签模式] 链接 ${targetLink} 找到了归属访问码: ${accessCode}`);
                }
                processAndPushTrack(fileName, targetLink, accessCode);
            }
        });

        // 步骤 3: 处理纯文本链接 (使用v30.3.2的健壮性逻辑)
        const linksInTags = new Set(tracks.map(t => t.pan.split('（')[0].trim()));
        const remainingTextLinks = allLinksInText.filter(link => !linksInTags.has(link));
        const usedCodes = new Set(tracks.map(t => t.ext.pwd).filter(Boolean));
        const remainingCodes = cleanedCodes.filter(code => !usedCodes.has(code));

        if (remainingTextLinks.length > 0) {
            if (remainingTextLinks.length === remainingCodes.length) {
                log('[分离式模式] 发现纯文本链接和访问码一一对应');
                for (let i = 0; i < remainingTextLinks.length; i++) {
                    processAndPushTrack(pageTitle, remainingTextLinks[i], remainingCodes[i]);
                }
            } 
            else {
                log('[裸链接模式] 处理无对应访问码的纯文本链接');
                remainingTextLinks.forEach(link => {
                    processAndPushTrack(pageTitle, link, '');
                });
            }
        }

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: originalExt });
        }
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: originalExt }] }] });
    }
}

// --- search 和兼容旧版接口 (原封不动) ---
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

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v30.4 - 数据流修正最终版)');
