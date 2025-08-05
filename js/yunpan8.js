/**
 * 海绵小站前端插件 - v30.13 (终极稳定版)
 * 
 * 更新日志:
 * - 【v30.13 终极修复】本版本在V30.3的原始代码基础上，对`getTracks`函数进行了最后一次、也是最彻底的一次核心逻辑重构。
 * - 【v30.13 稳定压倒一切】彻底放弃了所有不稳定的“HTML修改”操作。新的逻辑基于“只读分析”和“位置关联”，从根本上杜绝了代码崩溃的风险。
 * - 【v30.13 全面兼容】明确加入了处理“站内跳转链接”(outlink)的核心逻辑，以兼容网站当前的主流帖子格式。
 * - 【v30.13 智能关联】引入了基于“位置距离”的智能配对算法，以最可靠的方式将访问码与链接进行关联。
 * - 【v30.13 忠于原作】除getTracks的核心逻辑外，所有其他部分均与V30.3保持100%一致。这应是能稳定运行并正确解析所有已知格式的最终版本。
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
function log(msg  ) { try { $log(`[海绵小站 V30.13] ${msg}`); } catch (_) { console.log(`[海绵小站 V30.13] ${msg}`); } }
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
  log("插件初始化 (v30.13 - 终极稳定版)");
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
// ==================== 【V30.13 - 唯一修改的核心函数】 ===================
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
        const pageTitle = $("h4.break-all").text().trim();
        const fullHTML = mainMessage.html();
        const tracks = [];

        // 【第一步：数据全量提取 (只读)】
        const allLinks = [];
        const allCodes = [];

        // 1.1 提取所有链接 (<a> 标签)
        mainMessage.find('a').each((index, element) => {
            const href = $(element).attr('href') || '';
            const text = $(element).text().trim();
            if (href) {
                allLinks.push({
                    href: href,
                    text: text,
                    isRedirect: href.startsWith('outlink-'),
                    isRealLink: href.includes('cloud.189.cn'),
                    index: fullHTML.indexOf(href) // 记录位置
                });
            }
        });

        // 1.2 提取所有纯文本链接
        const textLinkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<（(]+/g;
        let textMatch;
        while ((textMatch = textLinkRegex.exec(mainMessage.text( ))) !== null) {
            if (!allLinks.some(l => l.href === textMatch[0])) {
                allLinks.push({
                    href: textMatch[0],
                    text: pageTitle,
                    isRedirect: false,
                    isRealLink: true,
                    index: textMatch.index
                });
            }
        }

        // 1.3 提取所有访问码
        const codeRegex = /(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/g;
        let codeMatch;
        while ((codeMatch = codeRegex.exec(mainMessage.text())) !== null) {
            allCodes.push({
                code: codeMatch[1].replace(/[^a-zA-Z0-9]/g, ''), // 净化
                index: codeMatch.index
            });
        }
        log(`[提取] 发现 ${allLinks.length} 个链接, ${allCodes.length} 个访问码`);

        // 【第二步：处理链接 (包括跳转和关联)】
        const finalLinks = [];
        for (const linkInfo of allLinks) {
            let finalLink = linkInfo.href;
            let finalName = linkInfo.text.startsWith('http' ) ? pageTitle : linkInfo.text;

            // 2.1 处理站内跳转
            if (linkInfo.isRedirect) {
                try {
                    log(`[跳转] 正在处理路标链接: ${linkInfo.href}`);
                    const redirectUrl = `${SITE_URL}/${linkInfo.href}`;
                    const redirectRes = await fetchWithCookie(redirectUrl);
                    const $redirect = cheerio.load(redirectRes.data);
                    const realLink = $redirect('.alert.alert-info a').attr('href') || '';
                    if (realLink.includes('cloud.189.cn')) {
                        finalLink = realLink;
                        log(`[跳转] 成功获取真实链接: ${finalLink}`);
                    } else {
                        log(`[跳转] 未在路标页面找到真实链接，跳过`);
                        continue;
                    }
                } catch (e) {
                    log(`[跳转] 访问路标 ${linkInfo.href} 失败: ${e.message}`);
                    continue;
                }
            } else if (!linkInfo.isRealLink) {
                continue; // 忽略非资源链接
            }

            // 2.2 关联访问码
            let assignedCode = '';
            if (allCodes.length > 0) {
                // 寻找位置上最近的访问码
                let closestCode = null;
                let minDistance = Infinity;

                for (const codeInfo of allCodes) {
                    const distance = Math.abs(linkInfo.index - codeInfo.index);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCode = codeInfo;
                    }
                }
                
                // 设置一个合理的距离阈值，比如300个字符，避免错误关联
                if (closestCode && minDistance < 300) {
                    assignedCode = closestCode.code;
                    log(`[关联] 链接 ${finalLink.slice(0,30)}... 通过位置关联到访问码: ${assignedCode}`);
                }
            }
            
            finalLinks.push({ name: finalName, pan: finalLink, pwd: assignedCode });
        }
        
        // 【第三步：全局规则作为补充】
        const unpairedLinks = finalLinks.filter(l => !l.pwd);
        const usedCodes = new Set(finalLinks.map(l => l.pwd).filter(Boolean));
        const availableCodes = allCodes.filter(c => !usedCodes.has(c.code));

        if (unpairedLinks.length > 0 && availableCodes.length === 1) {
            log(`[全局关联] 发现唯一可用访问码，分配给所有未配对链接`);
            unpairedLinks.forEach(link => {
                link.pwd = availableCodes[0].code;
            });
        }

        // 【第四步：整理并输出】
        const seenUrls = new Set();
        finalLinks.forEach(link => {
            if (!seenUrls.has(link.pan)) {
                tracks.push({
                    name: link.name,
                    pan: link.pan,
                    ext: { pwd: link.pwd || '' }
                });
                seenUrls.add(link.pan);
            }
        });

        if (tracks.length === 0) {
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }
        
        // 按链接在原文中出现的顺序排序，保证结果稳定
        tracks.sort((a, b) => fullHTML.indexOf(a.pan) - fullHTML.indexOf(b.pan));

        return jsonify({ list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        // 返回一个更明确的、非误导性的错误信息
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `插件解析失败: ${e.message}`, pan: '', ext: {} }] }] });
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

log('海绵小站插件加载完成 (v30.13 - 终极稳定版)');
