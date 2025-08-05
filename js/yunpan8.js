/**
 * 海绵小站前端插件 - v48.1 (可视化调试版)
 * 
 * 更新日志:
 * - 【v48.1 可视化调试】修改资源命名规则，将识别到的访问码直接显示在文件名中，
 *   格式为“[码:xxxx] 文件名”或“[码:无] 文件名”，便于在无日志环境下直接诊断问题。
 * - 【v48.0 根源修正】在v47.1引擎基础上，增加对HTML中&nbsp;实体的预处理。
 *   此修正解决了因“不换行空格”导致正则表达式匹配空白失败的根本性问题。
 * - 【v47.1 引擎升级】增加“模式3”，处理“关键词在下一行，实体在下两行”的排版。
 * - 【v47.0 核心引擎】采用“逐行扫描-上下文匹配”引擎，精准模拟人类阅读行为。
 * - 【致谢】此版本的核心思想源于用户的智慧，特此致以最崇高的敬意。
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
function log(msg   ) { try { $log(`[海绵小站 V48.1] ${msg}`); } catch (_) { console.log(`[海绵小站 V48.1] ${msg}`); } }
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
  log("插件初始化 (v48.1 - 可视化调试版)");
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
    if (path.startsWith('http'   )) return path;
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
// =================== 【唯一修改区域】v48.1 全新引擎版 getTracks 函数 ================
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
        
        const messageHtml = mainMessage.html();
        if (messageHtml) {
            mainMessage.html(messageHtml.replace(/&nbsp;/g, ' '));
        }

        const tracks = [];
        const seenUrls = new Set();
        const pageTitle = $("h4.break-all").text().trim();

        const normalizeCode = (rawCode) => {
            if (!rawCode) return '';
            const charMap = {
                '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₀': '0',
                '¹': '1', '²': '2', '³': '3',
            };
            let normalized = '';
            for (const char of rawCode) {
                normalized += charMap[char] || char;
            }
            return normalized.trim();
        };

        const processAndPushTrack = (fileName, link, code) => {
            const pureLink = (link.match(/https?:\/\/cloud\.189\.cn\/[^\s（(]+/ )?.[0] || '').trim();
            if (!pureLink || seenUrls.has(pureLink)) return;

            const finalAccessCode = normalizeCode(code);
            log(`[最终赋值] 文件名: ${fileName}, 纯链接: ${pureLink}, 访问码: ${finalAccessCode}`);
            
            seenUrls.add(pureLink);
            tracks.push({
                // ★★★ 【可视化调试】修改文件名以显示识别结果 ★★★
                name: `[码:${finalAccessCode || '无'}] ${fileName}`,
                // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

                pan: pureLink,
                ext: { pwd: finalAccessCode },
            });
        };

        // --- 引擎一：处理<a>标签 (保持不变，作为基础补充) ---
        log("引擎一：开始解析<a>标签(名称链接)...");
        mainMessage.find('a[href*="cloud.189.cn"]').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href');
            const text = linkElement.text().trim();
            let fileName = text.length > 5 ? text : pageTitle;
            
            const parentText = linkElement.parent().text();
            const codeMatch = parentText.match(/(?:访问码|提取码|密码)\s*[:：]?\s*([\w*.:-]+)/i);
            const accessCode = codeMatch ? codeMatch[1] : '';
            
            processAndPushTrack(fileName, href, accessCode);
        });
        log("引擎一：<a>标签解析完成。");

        // --- 引擎二：逐行扫描上下文匹配引擎 ---
        log("引擎二：启动逐行扫描上下文匹配引擎...");
        const lines = mainMessage.text().split(/\n+/).map(l => l.trim()).filter(Boolean);
        
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];
            const linkMatch = currentLine.match(/https?:\/\/cloud\.189\.cn\/[^\s（(]+/ );

            if (linkMatch) {
                const link = linkMatch[0];
                if (seenUrls.has(link)) continue;

                let code = '';
                
                // 模式1: 访问码和链接在同一行
                const inlineCodeMatch = currentLine.match(/(?:访问码|提取码|密码)\s*[:：]?\s*([\w*.:-]+)/);
                if (inlineCodeMatch) {
                    code = inlineCodeMatch[1];
                }

                // 模式2: 访问码在下一行 (关键词和实体在同一行)
                const nextLine = lines[i + 1] || '';
                if (!code && nextLine) {
                    const nextLineCodeMatch = nextLine.match(/(?:访问码|提取码|密码)?\s*[:：]?\s*([\w*.:-]{4,8})$/);
                     if (nextLineCodeMatch) {
                        code = nextLineCodeMatch[1] || nextLineCodeMatch[0];
                    }
                }
                
                // 模式3: 关键词在下一行，实体在下两行
                const nextNextLine = lines[i + 2] || '';
                if (!code && nextLine.match(/^(?:访问码|提取码|密码)\s*[:：]?\s*$/) && nextNextLine.match(/^[\w*.:-]{4,8}$/)) {
                    code = nextNextLine;
                }
                
                processAndPushTrack(pageTitle, link, code);
            }
        }
        log("引擎二：逐行扫描完成。");

        if (tracks.length === 0) {
            log("所有方法均未找到有效资源，返回提示信息。");
            tracks.push({ name: "[码:无] 未找到有效资源", pan: '', ext: {} });
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
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.trim() || "",
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

log('海绵小站插件加载完成 (v48.1 - 可视化调试版)');
