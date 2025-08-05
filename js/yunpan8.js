/**
 * 海绵小站前端插件 - v30.12 (终极外科手术修复版)
 * 
 * 更新日志:
 * - 【v30.12 终极修复】本版本在V30.3的原始代码基础上，仅针对`getTracks`函数进行了核心逻辑的“外科手术”式替换。
 * - 【v30.12 唯一蓝图】新的提取与关联逻辑，完全以v73+v6这对成功的前后端范例为模板，旨在复刻其强大的解析能力。
 * - 【v30.12 输出标准】严格遵循v6的输出标准，pan字段为纯净链接，ext.pwd字段为经过净化(去除非字母数字字符)的纯净访问码。
 * - 【v30.12 逻辑再造】引入了更健壮的“多阶段关联”和“挖掉”机制，以应对各种复杂的链接与访问码组合，解决了V30.3的根本性缺陷。
 * - 【v30.12 忠于原作】除getTracks的核心逻辑外，所有其他部分均与V30.3保持100%一致。
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
function log(msg  ) { try { $log(`[海绵小站 V30.12] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.12] ${msg}`); } }
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

// --- 核心函数 ---

async function getConfig() {
  log("插件初始化 (v30.12 - 终极外科手术修复版)");
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

// =======================================================================
// ==================== 【V30.12 - 唯一修改的核心函数】 ===================
// =======================================================================
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
        const pageTitle = $("h4.break-all").text().trim();

        // 【第一步：初始化与预处理】
        const $processedHTML = mainMessage.clone(); // 创建一个可修改的副本用于“挖掉”操作
        const fullMessageText = mainMessage.text();
        
        // 提取并净化所有访问码，作为“全局弹药库”
        const allCleanedCodes = (fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/gi) || [])
            .map(code => code.replace(/(?:访问码|提取码|密码)\s*[:：]\s*/i, '').replace(/[^a-zA-Z0-9]/g, ''));
        log(`[预处理] 发现 ${allCleanedCodes.length} 个净化后的潜在访问码: ${allCleanedCodes.join(', ')}`);

        // 用于存储已明确配对的链接和密码
        const pairedLinks = new Map();

        // 【第二步：处理带紧邻访问码的链接 (最高优先级)】
        // 这个正则能捕获链接和它后面紧跟着的访问码
        const adjacentRegex = /(https?:\/\/cloud\.189\.cn\/[^\s<（(]+ )[\s\S]*?(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/g;
        let tempHTML = $processedHTML.html().replace(/<br\s*\/?>/gi, '\n'); // 将  
替换为换行符以简化正则
        let adjacentMatch;

        while ((adjacentMatch = adjacentRegex.exec(tempHTML)) !== null) {
            const pureLink = adjacentMatch[1].trim();
            const cleanedCode = adjacentMatch[2].replace(/[^a-zA-Z0-9]/g, '');
            
            if (seenUrls.has(pureLink)) continue;
            
            log(`[紧邻模式] 发现明确配对: ${pureLink} -> ${cleanedCode}`);
            pairedLinks.set(pureLink, cleanedCode);
            seenUrls.add(pureLink);

            // 从HTML中“挖掉”这个已被处理的块，避免干扰
            tempHTML = tempHTML.replace(adjacentMatch[0], '');
        }
        // 更新Cheerio对象
        $processedHTML.html(tempHTML);


        // 【第三步：处理所有<a>标签 (包括名称链接和链接型文本)】
        const allLinksData = [];
        $processedHTML.find('a').each((_, element) => {
            const linkElement = $(element);
            const href = linkElement.attr('href') || '';
            const text = linkElement.text().trim();

            if (href.includes('cloud.189.cn')) {
                if (seenUrls.has(href)) return;
                
                let fileName = text.startsWith('http' ) ? pageTitle : text;
                allLinksData.push({ name: fileName, pan: href });
                seenUrls.add(href);
            }
        });
        
        // 【第四步：处理剩余纯文本中的裸链接】
        const remainingText = $processedHTML.text();
        const nakedLinkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<（(]+/g;
        let nakedMatch;
        while ((nakedMatch = nakedLinkRegex.exec(remainingText )) !== null) {
            const pureLink = nakedMatch[0].trim();
            if (seenUrls.has(pureLink)) continue;
            
            allLinksData.push({ name: pageTitle, pan: pureLink });
            seenUrls.add(pureLink);
        }

        // 【第五步：终极关联与分配】
        // 1. 先将已明确配对的链接推入结果
        for (const [link, code] of pairedLinks.entries()) {
            tracks.push({ name: pageTitle, pan: link, ext: { pwd: code } });
        }

        // 2. 处理剩余的、未配对的链接
        const unpairedLinks = allLinksData.filter(data => !pairedLinks.has(data.pan));
        const availableCodes = allCleanedCodes.filter(code => ![...pairedLinks.values()].includes(code));

        if (unpairedLinks.length > 0 && availableCodes.length > 0) {
            // 规则A: 如果可用的码和未配对的链接数量相等，则一一对应
            if (unpairedLinks.length === availableCodes.length) {
                log('[一对一模式] 链接与访问码数量匹配，按序分配');
                for (let i = 0; i < unpairedLinks.length; i++) {
                    unpairedLinks[i].pwd = availableCodes[i];
                }
            }
            // 规则B: 如果只有一个可用的码，则分配给所有未配对的链接
            else if (availableCodes.length === 1) {
                log('[一对多模式] 发现唯一可用访问码，分配给所有剩余链接');
                for (let i = 0; i < unpairedLinks.length; i++) {
                    unpairedLinks[i].pwd = availableCodes[0];
                }
            }
        }
        
        // 3. 将分配好（或未分配到）密码的链接推入结果
        unpairedLinks.forEach(data => {
            tracks.push({ name: data.name, pan: data.pan, ext: { pwd: data.pwd || '' } });
        });


        // 【第六步：兜底保险】
        if (tracks.length === 0 && fullMessageText.includes('cloud.189.cn')) {
            log('[兜底保险模式] 精确匹配失败，启动信息保全机制...');
            const allPossibleLinks = fullMessageText.match(/https?:\/\/cloud\.189\.cn\/[^\s\n\r]+/g ) || [];
            allPossibleLinks.forEach(link => {
                if (seenUrls.has(link)) return;
                seenUrls.add(link);
                tracks.push({ name: link, pan: link, ext: { pwd: '' } });
            });
        }

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        
        // 按链接在原文中出现的顺序排序，保证结果稳定
        tracks.sort((a, b) => fullMessageText.indexOf(a.pan) - fullMessageText.indexOf(b.pan));
        
        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: '', ext: {} }] }] });
    }
}
// =======================================================================
// ========================= 【修改部分结束】 ==========================
// =======================================================================

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

log('海绵小站插件加载完成 (v30.12 - 终极外科手术修复版)');
