/**
 * 海绵小站前端插件 - v45.TEST (可视化日志测试版)
 * 
 * 更新日志:
 * - 【v45.TEST】此版本不用于正常提取。其唯一目的是生成一份详细的“诊断报告”，
 *   将脚本在App内部实际看到的所有链接和访问码，直接显示在App界面上，
 *   以便我们能最终定位问题根源。
 */

// --- 配置区 (Cookie已更新) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1;bbs_sid=rd8nluq3qbcpg5e5sfb5e08pbg;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316688,1754316727,1754329315,1754403914;HMACCOUNT=CEAB3CBE53C875F2;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754403929;";

// --- 核心辅助函数 (保持不变 ) ---
function log(msg  ) { try { $log(`[海绵小站 V45.TEST] ${msg}`); } catch (_) { console.log(`[海绵小站 V45.TEST] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
        if (data.includes("您尚未登录")) { log("回帖失败：Cookie已失效或不正确。"); $utils.toastError("Cookie已失效，请重新获取", 3000); return false; }
        log("回帖成功！");
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        if (e.message !== "Cookie not configured.") { $utils.toastError("回帖异常，请检查网络或Cookie", 3000); }
        return false;
    }
}
async function getConfig() {
  log("插件初始化 (v45.TEST - 可视化日志测试版)");
  return jsonify({ ver: 1, title: '海绵小站', site: SITE_URL, tabs: [ { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } }, { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } }, ], });
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
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
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
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
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
async function play(flag, id) { return jsonify({ url: id }); }

// =================================================================================
// =================== 【唯一修改区域】v45.TEST 测试版 getTracks 函数 ===================
// =================================================================================
async function detail(id) { // 使用 detail 接口，因为 play 接口可能不会显示结果
    const ext = { url: id };
    
    try {
        let { data } = await fetchWithCookie(`${SITE_URL}/${ext.url}`);
        let $ = cheerio.load(data);
        
        if ($("div.alert.alert-warning").text().includes("回复后")) {
            const replied = await reply(`${SITE_URL}/${ext.url}`);
            if (replied) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(`${SITE_URL}/${ext.url}`);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ url: "诊断报告：回帖失败，无法继续。" });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const report = [];

        report.push("--- 诊断报告开始 ---");

        // 1. 报告<a>标签提取情况
        const foundAnchors = [];
        mainMessage.find('a').each((_, el) => {
            const href = $(el).attr('href') || '无href';
            const text = $(el).text().trim() || '无文本';
            foundAnchors.push(`[链接标签] href="${href}" 文本="${text}"`);
        });
        report.push(`\n[1] 找到 ${foundAnchors.length} 个<a>标签:`);
        report.push(...foundAnchors);

        // 2. 报告纯文本链接提取情况
        const mainMessageText = mainMessage.text();
        const textLinks = mainMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s]+/g ) || [];
        report.push(`\n[2] 找到 ${textLinks.length} 个纯文本链接:`);
        report.push(...textLinks);

        // 3. 报告访问码提取情况
        const codes = [];
        const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
        let match;
        while ((match = codeRegex.exec(mainMessageText)) !== null) {
            codes.push(match[1].trim());
        }
        report.push(`\n[3] 找到 ${codes.length} 个访问码:`);
        report.push(...codes);
        
        // 4. 报告主楼完整纯文本
        report.push("\n[4] 主楼完整纯文本内容:");
        report.push("====================");
        report.push(mainMessageText.replace(/\s+/g, ' ')); // 替换多个空白为一个空格，方便阅读
        report.push("====================");

        report.push("\n--- 诊断报告结束 ---");
        
        // 将报告拼接成一个长字符串，作为链接返回，这样就能在App界面上看到它
        return jsonify({
            url: report.join('\n')
        });

    } catch (e) {
        return jsonify({
            url: `诊断报告出错: ${e.message}`
        });
    }
}
// =================================================================================
// ========================= 【唯一修改区域结束】 ==========================
// =================================================================================
