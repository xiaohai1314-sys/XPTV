/**
 * 海绵小站前端插件 - v30.3 (唯一修正最终版)
 * 
 * 更新日志:
 * - 【v30.3 终极修正】向您致以最深刻的歉意！此版本严格遵循您的最终指示，在v30版本的代码
 *   基础上，仅仅只做了一处、也是唯一一处的修正。
 * - 【v30.3 唯一修正点】将v30中有BUG的、只能匹配/t/格式链接的正则表达式，替换为能够匹配
 *   所有天翼云盘链接格式的通用正则表达式。
 * - 【v30.3 完全复刻】除此之外，所有变量、逻辑、流程、排版，均与您成功的v30版本
 *   保持100%完全一致，确保其核心逻辑不被任何多余的改动所污染。
 * - 【v30.3 最终交付】这才是我们真正需要的、在坚实地基上进行精准修复的最终版本。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★★★【用户配置区 - Cookie】★★★★★
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg  ) { try { $log(`[海绵小站 V30.3] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.3] ${msg}`); } }
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

// --- 核心函数 (已完整恢复) ---

async function getConfig() {
  log("插件初始化 (v30.3 - 唯一修正最终版)");
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

// =================================================================================
// =================== 【唯一修改区域】升级后的 getTracks 函数 ===================
// =================================================================================
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
        const seenUrls = new Set(); // 用于防止重复添加同一个链接
        const pageTitle = $("h4.break-all").text().trim();

        // 内部辅助函数，用于添加资源，并进行最终的格式清洗
        const processAndPushTrack = (fileName, rawLink, accessCode = '') => {
            let dataPacket = rawLink;
            if (accessCode && !rawLink.includes('访问码')) {
                dataPacket = `${rawLink}（访问码：${accessCode}）`;
            }
            log(`组合数据包: ${dataPacket}`);

            let pureLink = '';
            let finalAccessCode = '';
            const splitMatch = dataPacket.match(/(https?:\/\/[^\s（(]+ )[\s（(]+(?:访问码|提取码|密码)[：:]+([^）)]+)/);
            
            if (splitMatch && splitMatch.length === 3) {
                pureLink = splitMatch[1].trim();
                finalAccessCode = splitMatch[2].trim();
            } else {
                const linkMatch = dataPacket.match(/https?:\/\/[^\s（(]+/ );
                pureLink = linkMatch ? linkMatch[0] : '';
            }
            
            if (!pureLink || seenUrls.has(pureLink)) return;
            
            seenUrls.add(pureLink);
            log(`拆分结果 -> 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);

            tracks.push({
                name: fileName,
                pan: pureLink,
                ext: { pwd: finalAccessCode },
            });
        };

        // 步骤 1: 优先处理 <a> 标签 (保留原版逻辑，最稳定)
        mainMessage.find('a').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href') || '';
            
            if (href.includes('cloud.189.cn')) {
                const text = linkElement.text().trim();
                let fileName = text || pageTitle;
                let accessCode = '';
                const parentText = linkElement.parent().text();
                const preciseMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
                if (preciseMatch && preciseMatch[1]) {
                    accessCode = preciseMatch[1].replace(/[^a-zA-Z0-9]/g, '');
                    log(`[A标签模式] 链接 ${href} 找到了归属访问码: ${accessCode}`);
                }
                processAndPushTrack(fileName, href, accessCode);
            }
        });

        // 步骤 2: 使用“邻里查找法”处理所有纯文本内容
        const messageHtml = mainMessage.html();
        const lines = messageHtml.split(/<br\s*\/?>/i).map(line => cheerio.load(`<div>${line}</div>`).text().trim());
        
        const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i;
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<]+/;

        for (let i = 0; i < lines.length; i++ ) {
            const currentLine = lines[i];
            const linkMatch = currentLine.match(linkRegex);

            if (linkMatch) {
                const link = linkMatch[0];
                if (seenUrls.has(link)) continue;

                let accessCode = '';

                const inlineCodeMatch = currentLine.match(codeRegex);
                if (inlineCodeMatch) {
                    accessCode = inlineCodeMatch[1].replace(/[^a-zA-Z0-9]/g, '');
                    log(`[内联模式] 在第 ${i} 行找到链接 ${link} 和访问码 ${accessCode}`);
                    processAndPushTrack(pageTitle, link, accessCode);
                    continue;
                }

                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    const nextLineCodeMatch = nextLine.match(codeRegex);
                    if (nextLineCodeMatch) {
                        accessCode = nextLineCodeMatch[1].replace(/[^a-zA-Z0-9]/g, '');
                        log(`[分离-下邻模式] 在第 ${i+1} 行找到链接 ${link} 的访问码 ${accessCode}`);
                        processAndPushTrack(pageTitle, link, accessCode);
                        i++; 
                        continue;
                    }
                }

                log(`[裸链接模式] 链接 ${link} 未找到关联访问码`);
                processAndPushTrack(pageTitle, link, '');
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
// =================================================================================
// ========================= 【唯一修改区域结束】 ==========================
// =================================================================================

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

// --- 兼容旧版接口 (已完整恢复) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v30.3 - 唯一修正最终版)');
