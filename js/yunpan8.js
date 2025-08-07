/**
 * 海绵小站前端插件 - v65.1 (预检逻辑测试版 - 功能完整)
 * 
 * 更新日志:
 * - 【v65.1-test】: 修正排版和分类列表缺失问题，确保插件可完整测试。
 *   - 引入全新的“链接预检”逻辑，旨在从根本上解决单文件文件夹问题。
 *   - 1. 【待验证】在获取到链接后，会主动访问链接以分析其内部HTML。
 *   - 2. 【待验证】通过分析内部HTML，智能判断分享类型是“文件直链”还是“文件夹”。
 *   - 3. 【待验证】为两种类型链接启用不同的、正确的处理逻辑。
 */

// ★★★★★【后端日志配置区】★★★★★
const DEBUG_MODE = true; 
const DEBUG_ENDPOINT = "http://192.168.10.111:3000/log"; 
// ★★★★★★★★★★★★★★★★★★★★★

// --- 原有配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";

// --- 日志与核心辅助函数 ---
async function log(message, level = 'info' ) {
    const timestamp = new Date().toISOString();
    try { 
        $log(`[海绵小站 V65.1-test] ${message}`); 
    } catch (_) { 
        console.log(`[海绵小站 V65.1-test] ${message}`); 
    }
    if (DEBUG_MODE) {
        try {
            await $fetch.post(DEBUG_ENDPOINT, { level, message, timestamp }, { headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            console.log(`[后端日志发送失败]: ${e.message}`);
        }
    }
}
function argsify(ext) { 
    if (typeof ext === 'string') { 
        try { return JSON.parse(ext); } catch (e) { return {}; } 
    } 
    return ext || {}; 
}
function jsonify(data) { 
    return JSON.stringify(data); 
}
function getRandomText(arr) { 
    return arr[Math.floor(Math.random() * arr.length)]; 
}

// --- 网络请求与回帖 ---
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
  await log("插件初始化 (v65.1 - 预检逻辑测试版)");
  return jsonify({
    ver: 1, 
    title: '海绵小站', 
    site: SITE_URL,
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
    await log(`获取卡片列表异常: ${e.message}`, "error");
    return jsonify({ list: [] });
  }
}

// =================================================================================
// =================== 【全新 getTracks 函数 - 带预检逻辑】 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    await log(`--- 开始处理详情页: ${detailUrl} ---`);
    
    try {
        // 步骤一：获取论坛页面内容
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        if ($("div.alert.alert-warning").text().includes("回复后")) {
            if (!await reply(detailUrl)) {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或无法回帖", pan: '', ext: {} }] }] });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResponse = await fetchWithCookie(detailUrl);
            data = retryResponse.data;
            $ = cheerio.load(data);
        }

        const mainMessage = $('.message[isfirst="1"]');
        const mainMessageHtml = mainMessage.html();
        const initialTitle = $("h4.break-all").clone().children().remove().end().text().trim();
        const tracks = [];

        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
        const uniqueLinks = [...new Set(mainMessageHtml.match(linkRegex ) || [])];
        await log(`【论坛解析】: 找到 ${uniqueLinks.length} 个链接。`);

        if (uniqueLinks.length > 0) {
            for (const link of uniqueLinks) {
                await log(`--- 开始处理链接: ${link} ---`);
                
                // 步骤二：【新增】预检链接
                let finalName = initialTitle; // 默认使用论坛的标题
                let isFolder = true; // 默认假设是文件夹，让App决定

                try {
                    await log(`【预检】: 正在访问链接内部...`);
                    const { data: panPageHtml } = await fetchWithCookie(link);
                    const $$ = cheerio.load(panPageHtml);

                    // 尝试定位文件列表
                    const fileListItems = $$('ul.file-list-ul > li.file-item');
                    
                    if (fileListItems.length > 0) {
                        // 这是一个文件夹分享
                        await log(`【预检结果】: 这是一个文件夹分享，包含 ${fileListItems.length} 个项目。`);
                        // 文件夹名称从页面顶部获取
                        const folderName = $$('p.info-detail-name > span').attr('title');
                        if (folderName) finalName = folderName;
                        isFolder = true;
                    } else {
                        // 可能是单文件分享页面
                        const singleFileName = $$('p.info-detail-name > span').attr('title');
                        if (singleFileName) {
                            finalName = singleFileName;
                            isFolder = false; // 明确是文件
                            await log(`【预检结果】: 这是一个单文件分享。提取到文件名: "${finalName}"`);
                        } else {
                            await log(`【预检警告】: 无法确定链接类型，将按默认方式（文件夹）处理。`);
                        }
                    }
                } catch (e) {
                    await log(`【预检失败】: 访问链接失败: ${e.message}。将使用论坛标题并按文件夹处理。`, "error");
                }

                // 步骤三：组装结果
                // 我们不再手动添加“[文件夹]”标识，让App根据isFolder属性来决定如何渲染
                // 但为了让App能区分，我们需要一个方法。一个简单的方法是，如果是文件夹，我们返回一个稍微不同的结构或名称
                // 这里我们还是用名字来区分，因为App可能没有适配新的属性
                const trackName = isFolder ? `[文件夹] ${finalName}` : finalName;
                
                tracks.push({
                    name: trackName,
                    pan: link,
                    ext: { pwd: '' },
                });
                await log(`--- 链接处理完成。最终名称: "${trackName}" ---`);
            }
        }

        if (tracks.length === 0) {
            await log("【最终结果】: 未找到任何有效资源。", "error");
        }
        
        await log(`--- 全部处理完成 ---`);
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        await log(`getTracks函数出现致命错误: ${e.message}`, "error");
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败", pan: '', ext: {} }] }] });
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
