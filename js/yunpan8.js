/**
 * 海绵小站前端插件 - v62.4 (后端日志测试版)
 * 
 * 更新日志:
 * - 【v62.4】: 集成后端日志系统，用于实证测试。
 *   - 新增 DEBUG_MODE 和 DEBUG_ENDPOINT 配置。
 *   - 重写 log 函数，使其能将日志发送到指定后端。
 *   - 在 getTracks 函数的关键节点添加了详细的日志输出。
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
    // 1. 在插件内置日志中打印
    try {
        $log(`[海绵小站 测试版] ${message}`);
    } catch (_) {
        console.log(`[海绵小站 测试版] ${message}`);
    }

    // 2. 如果开启了后端日志模式，则发送到后端
    if (DEBUG_MODE) {
        try {
            await $fetch.post(DEBUG_ENDPOINT, {
                level,
                message,
                timestamp
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            // 后端日志发送失败，在本地控制台提示，避免影响主流程
            console.log(`[后端日志发送失败]: ${e.message}`);
        }
    }
}

// --- 核心辅助函数 (无变化) ---
function argsify(ext) { 
    if (typeof ext === 'string') { 
        try { return JSON.parse(ext); } catch (e) { return {}; } 
    } 
    return ext || {}; 
}
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 网络请求与回帖 (无变化) ---
async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE_STRING_HERE")) {
        await log("Cookie未配置或无效", "error");
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
            $utils.toastError("Cookie已失效，请重新获取", 3000);
            return false;
        }
        await log("回帖成功！");
        return true;
    } catch (e) {
        await log(`回帖请求异常: ${e.message}`, "error");
        if (e.message !== "Cookie not configured.") {
            $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        }
        return false;
    }
}

// --- 核心函数 (无变化) ---
async function getConfig() {
  await log("插件初始化 (v62.4 - 后端日志测试版)");
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
    await log(`获取卡片列表异常: ${e.message}`, "error");
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== 【原始 getTracks 函数 - 添加详细日志】 ===================
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
        
        let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");
        if (isContentHidden) {
            await log("内容被隐藏，需要回帖。", "warn");
            const replied = await reply(detailUrl);
            if (replied) {
                await log("回帖成功，重新获取页面内容...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或未配置，无法获取资源", pan: '', ext: {} }] }] });
            }
        }

        const mainMessage = $('.message[isfirst="1"]');
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        const pageTitle = $("h4.break-all").text().trim();
        await log(`页面主标题获取成功: "${pageTitle}"`);
        const tracks = [];

        // --- 步骤一：采集所有链接地址 ---
        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex ) || [])];
        await log(`【链接提取】: 正则 /https?:\\/\\/cloud\\.189\\.cn\\/[^\\s<"']+/g` );
        await log(`【链接提取结果】: 共找到 ${uniqueLinks.length} 个链接。 列表: ${JSON.stringify(uniqueLinks)}`);

        // --- 步骤二：采集所有访问码 ---
        let codePool = [];
        const textCodeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]{4,8})/g;
        let match;
        while ((match = textCodeRegex.exec(mainMessageText)) !== null) {
            codePool.push(match[1].trim());
        }
        await log(`【访问码提取-文本】: 找到 ${codePool.length} 个。 列表: ${JSON.stringify(codePool)}`);
        
        const htmlCodeRegex = /<div class="alert alert-success"[^>]*>([^<]+)<\/div>/g;
        while ((match = htmlCodeRegex.exec(mainMessageHtml)) !== null) {
            const code = match[1].trim();
            if (code.length < 15 && !code.includes('http' )) {
                 codePool.push(code);
            }
        }
        codePool = [...new Set(codePool)];
        await log(`【访问码提取-HTML】: 最终共 ${codePool.length} 个。 列表: ${JSON.stringify(codePool)}`);

        // --- 步骤三：循环处理，分配并生成结果 ---
        if (uniqueLinks.length > 0) {
            uniqueLinks.forEach((link, index) => {
                await log(`--- 开始处理第 ${index + 1} 个链接: ${link} ---`);
                const linkElement = mainMessage.find(`a[href="${link}"]`).first();
                let fileName = pageTitle; // 默认使用主标题
                
                if (linkElement.length > 0) {
                    const text = linkElement.text().trim();
                    await log(`链接的文本内容是: "${text}"`);
                    if (text && text.length > 5 && !text.startsWith('http' )) {
                        fileName = text;
                        await log(`链接文本有效，文件名被设置为: "${fileName}"`);
                    } else {
                        await log(`链接文本无效，继续使用主标题作为文件名。`);
                    }
                } else {
                    await log(`未找到链接对应的<a>元素，使用主标题作为文件名。`);
                }
                
                if (fileName === pageTitle && fileName.includes('.')) {
                    await log(`文件名 "${fileName}" 包含 '.'，触发净化逻辑。`, "warn");
                    const parts = fileName.split('.');
                    if (parts.length > 1) {
                        fileName = parts[0];
                        await log(`文件名被净化为: "${fileName}"`);
                    }
                }

                const code = codePool[index] || '';
                let finalPan;
                if (code) {
                    finalPan = `${link}（访问码：${code}）`;
                    await log(`为链接分配到访问码: "${code}"`);
                } else {
                    finalPan = link;
                    await log(`未找到可分配的访问码。`);
                }

                tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' } });
                await log(`第 ${index + 1} 个资源处理完成。`);
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

// --- 兼容旧版接口 (无变化) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

