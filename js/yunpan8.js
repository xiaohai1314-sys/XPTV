/**
 * 海绵小站前端插件 - v17.0 (借鉴后端逻辑)
 * 
 * 更新日志:
 * - 【v17.0 逻辑升级】深度借鉴后端脚本，重构getTracks函数，实现“快车道”与“慢车道”两步链接提取。
 * - 【v17.0 链接修正】增加对`outlink-`类型链接的识别和二次请求，解决部分资源无法提取的问题。
 * - 【v17.0 访问码提取】优化了访问码的全局提取逻辑，使其能更好地与链接匹配。
 * - 【v17.0 海报图提取】在getTracks中增加详情页海报图的提取逻辑。
 */

// --- 配置区 (保持v16.1的配置) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const COOKIE = "_xn_accesscount_visited=1; BAIDUID_BFESS=82BB2F2D056FEA224952A3CCB69C40BA:FG=1; bbs_sid=3v5fdrevvvrrbpnuvbmtuv9nci; bbs_token=n_2FnvY5D4BrjB5UnJMoCsNF4MqzeOqI46EbISj_2FirjryKnVtp; guard=DcF2FicbtLwkC6o/wp0nFQ==; guardret=56; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754300299; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753863470,1753865018; HMACCOUNT=8ECC86F14D9CE668; HMACCOUNT_BFESS=8ECC86F14D9CE668";

// --- 核心辅助函数和网络请求封装 (保持不变) ---
function log(msg) { try { $log(`[海绵小站 V17] ${msg}`); } catch (_) { console.log(`[海绵小站 V17] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function fetchWithCookie(url, options = {}) {
    if (!COOKIE || COOKIE.includes("YOUR_COOKIE")) throw new Error("Cookie not configured.");
    const headers = { 'User-Agent': UA, 'Cookie': COOKIE, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') return $fetch.post(url, options.body, finalOptions);
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
        if (data.includes("您尚未登录")) {
            log("回帖失败：Cookie已失效或不正确。");
            $utils.toastError("Cookie已失效，请重新获取", 3000);
            return false;
        }
        log("回帖成功！");
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        return false;
    }
}

// --- getTracks (v17.0 核心重构) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    
    try {
        let { data } = await fetchWithCookie(detailUrl);
        let $ = cheerio.load(data);
        
        if ($("div.alert.alert-warning").text().includes("回复后")) {
            log("内容被隐藏，启动回帖流程...");
            const replied = await reply(detailUrl);
            if (replied) {
                log("回帖成功，重新获取页面内容...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryResponse = await fetchWithCookie(detailUrl);
                data = retryResponse.data;
                $ = cheerio.load(data);
            } else {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: "Cookie无效或回帖失败", pan: "" }] }] });
            }
        }

        // --- 开始模仿后端逻辑 ---
        const mainMessage = $('.message[isfirst="1"]');
        const fullMessageText = mainMessage.text();
        
        // 1. 提取海报图和全局访问码
        const vod_pic = mainMessage.find('img').attr('src') || '';
        let globalAccessCode = '';
        const passMatch = fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
        if (passMatch && passMatch[1]) {
            globalAccessCode = passMatch[1].replace(/[^a-zA-Z0-9]/g, '');
            log(`提取到全局访问码: ${globalAccessCode}`);
        }

        let tracks = [];
        const seenUrls = new Set();

        // 2. 快车道：直接从详情页提取链接
        log("进入快车道...");
        mainMessage.find('a').each((_, element) => {
            const linkElement = $(element);
            let href = linkElement.attr('href') || '';
            let text = linkElement.text().trim();

            // 修正链接（后端逻辑）
            if (href.includes('cloud.189.cn') || text.includes('cloud.189.cn')) {
                let finalLink = href.includes('cloud.189.cn') ? href : text;
                if (!seenUrls.has(finalLink)) {
                    seenUrls.add(finalLink);
                    let urlWithPass = globalAccessCode ? `${finalLink} (访问码: ${globalAccessCode})` : finalLink;
                    tracks.push({ name: text || '天翼云盘', pan: urlWithPass });
                }
            }
        });

        if (tracks.length > 0) {
            log(`快车道成功，提取到 ${tracks.length} 个链接。`);
            return jsonify({ vod_pic, list: [{ title: '云盘', tracks }] });
        }

        // 3. 慢车道：处理 outlink-
        log("快车道失败，进入慢车道...");
        const outlinks = [];
        mainMessage.find('a[href^="outlink-"]').each((_, element) => {
            outlinks.push({
                url: $(element).attr('href'),
                fileName: $(element).text().trim() || '未知文件'
            });
        });

        if (outlinks.length === 0) {
            log("慢车道也未找到outlink，提取结束。");
            return jsonify({ vod_pic, list: [{ title: '云盘', tracks: [{ name: "未找到有效资源", pan: "" }] }] });
        }

        for (const linkInfo of outlinks) {
            log(`正在处理慢车道链接: ${linkInfo.url}`);
            const { data: outlinkData } = await fetchWithCookie(`${SITE_URL}/${linkInfo.url}`);
            const $outlink = cheerio.load(outlinkData);
            
            const realLink = $outlink('.alert.alert-info a').attr('href');
            if (realLink && !seenUrls.has(realLink)) {
                seenUrls.add(realLink);
                let urlWithPass = globalAccessCode ? `${realLink} (访问码: ${globalAccessCode})` : realLink;
                tracks.push({ name: linkInfo.fileName, pan: urlWithPass });
                log(`慢车道成功提取链接: ${realLink}`);
            }
        }

        return jsonify({ vod_pic, list: [{ title: '云盘', tracks }] });

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: "" }] }] });
    }
}


// 其他函数保持不变
async function getConfig() {
  log("插件初始化 (v17.0 - 借鉴后端逻辑)");
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

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${SITE_URL}/${id}-${page}.htm`;
  try {
    const { data } = await fetchWithCookie(url);
    const $ = cheerio.load(data);
    const cards = [];
    $("ul.threadlist > li.media.thread").each((_, item) => {
        cards.push({
            vod_id: $(item).find(".subject a")?.attr("href") || "",
            vod_name: $(item).find(".subject a")?.text().trim() || "",
            vod_pic: $(item).find("a > img.avatar-3")?.attr("src") || "",
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
            ext: { url: $(item).find(".subject a")?.attr("href") || "" }
        });
    });
    return jsonify({ list: cards });
  } catch(e) {
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
        cards.push({
            vod_id: $(item).find(".subject a")?.attr("href") || "",
            vod_name: $(item).find(".subject a")?.text().trim() || "",
            vod_pic: $(item).find("a > img.avatar-3")?.attr("src") || "",
            vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
            ext: { url: $(item).find(".subject a")?.attr("href") || "" }
        });
    });
    return jsonify({ list: cards });
  } catch(e) {
    return jsonify({ list: [] });
  }
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (v17.0 - 借鉴后端逻辑)');
