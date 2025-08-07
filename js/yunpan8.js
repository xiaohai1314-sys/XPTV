/**
 * 海绵小站前端插件 - v64.0 (后端日志测试版)
 * 
 * 更新日志:
 * - 【v64.0-test】: 用于验证最小化、无损修复方案的测试版本。
 *   - 1. 【待验证】修正主标题获取逻辑，确保只获取纯净标题。
 *   - 2. 【待验证】移除“按点截断”净化逻辑。
 *   - 3. 保留所有成熟提取逻辑，并添加详细日志以供验证。
 */

// ★★★★★【后端日志配置区】★★★★★
const DEBUG_MODE = true; // 设置为 true 开启后端日志功能
// 【重要】请将下面的 IP 地址修改为您运行后端服务器的电脑的局域网IP地址
const DEBUG_ENDPOINT = "http://192.168.10.111:3000/log"; 
// ★★★★★★★★★★★★★★★★★★★★★

// --- 原有配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";

// --- 【改造后】的日志函数 ---
async function log(message, level = 'info' ) {
    const timestamp = new Date().toISOString();
    try { $log(`[海绵小站 V64.0-test] ${message}`); } catch (_) { console.log(`[海绵小站 V64.0-test] ${message}`); }
    if (DEBUG_MODE) {
        try {
            await $fetch.post(DEBUG_ENDPOINT, { level, message, timestamp }, { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            console.log(`[后端日志发送失败]: ${e.message}`);
        }
    }
}

// --- 核心辅助函数 ---
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求与回帖 ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
        await log("Cookie未配置或无效", "error");
        $utils.toastError("请先在插件脚本中配置Cookie", 3000);
        throw new Error("Cookie not configured.");
    }
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') { return $fetch.post(url, options.body, finalOptions); }
    return $fetch.get(url, finalOptions);
}
async function reply(url) {
    await log("尝试使用Cookie自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) return false;
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const postData = { doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0 };
    try {
        const { data } = await fetchWithCookie(postUrl, { method: 'POST', body: postData, headers: { 'Referer': url } });
        if (data.includes("您尚未登录")) {
            await log("回帖失败：Cookie已失效或不正确。", "error");
            return false;
        }
        await log("回帖成功！");
        return true;
    } catch (e) {
        await log(`回帖请求异常: ${e.message}`, "error");
        return false;
    }
}

// --- 核心函数 ---
async function getConfig() {
  await log("插件初始化 (v64.0 - 后端日志测试版)");
  return jsonify({
    ver: 1, title: '海绵小站', site: SITE_URL,
    tabs: [
      { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } },
      { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } },
    ],
  });
}
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    return `${SITE_URL}/${path.startsWith('./') ? path.substring(2) : path}`;
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
    await log(`获取卡片列表异常: ${e.message}`, "error");
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== 【待验证的 getTracks 函数】 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    await log(`--- 开始处理详情页: ${detailUrl} ---`);
    
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        if ($("div.alert.alert-warning").text().includes("回复后")) {
            await log("内容被隐藏，需要回帖。", "warn");
            if (await reply(detailUrl)) {
                await log("回帖成功，重新获取页面内容...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或无法回帖，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        
        // 【待验证-1】使用 clone() 方法获取纯净的主标题
        const pageTitle = $("h4.break-all").clone().children().remove().end().text().trim();
        await log(`【主标题提取】: 获取到纯净主标题: "${pageTitle}"`);
        const tracks = [];

        // --- 步骤一：采集链接 (逻辑不变) ---
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex ) || [])];
        await log(`【链接提取】: 共找到 ${uniqueLinks.length} 个链接。 列表: ${JSON.stringify(uniqueLinks)}`);

        // --- 步骤二：采集访问码 (逻辑不变) ---
        let codePool = [];
        const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
        let match;
        while ((match = textCodeRegex.exec(mainMessageText)) !== null) { codePool.push(match[1].trim()); }
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
            const code = match[1].trim();
            if (code.length < 15 && !code.includes('http' )) { codePool.push(code); }
        }
        codePool = [...new Set(codePool)];
        await log(`【访问码提取】: 共找到 ${codePool.length} 个。 列表: ${JSON.stringify(codePool)}`);

        // --- 步骤三：文件名获取与分配 ---
        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                await log(`--- 开始处理第 ${index + 1} 个链接: ${link} ---`);
                let fileName = '';
                
                // 1. 优先尝试从链接自身的文本获取文件名 (逻辑不变)
                const linkElement = mainMessage.find(`a[href="${link}"]`).first();
                if (linkElement.length > 0) {
                    const text = linkElement.text().trim();
                    await log(`链接的文本内容是: "${text}"`);
                    if (text && text.length > 5 && !text.startsWith('http' )) {
                        fileName = text;
                        await log(`链接文本有效，文件名被设置为: "${fileName}"`);
                    }
                }

                // 2. 如果第一步失败，安全回退到使用纯净的页面主标题 (逻辑不变)
                if (!fileName) {
                    fileName = pageTitle;
                    await log(`链接文本无效，回退使用主标题作为文件名: "${fileName}"`);
                }
                
                // 3. 【待验证-2】确认原有的净化逻辑已被移除
                await log(`【文件名净化检查】: 当前文件名是 "${fileName}"。确认没有进行按点截断。`, "info");

                const code = codePool[index] || '';
                let finalPan = code ? `${link}（访问码：${code}）` : link;

                tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' } });
                await log(`第 ${index + 1} 个资源处理完成。最终文件名: "${fileName}"`);
            });
        }

        if (tracks.length === 0) {
            await log("【最终结果】: 未找到任何有效资源。", "error");
        }
        
        await log(`--- 全部处理完成，共生成 ${tracks.length} 个资源 ---`);
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        await log(`getTracks函数出现致命错误: ${e.message}`, "error");
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
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
    await log(`搜索异常: ${e.message}`, "error");
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
