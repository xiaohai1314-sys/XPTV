/**
 * 海绵小站前端插件 - v18.0 (详情页重构)
 * 
 * 更新日志:
 * - 【v18.0 核心修正】重构了 detail 函数，使其成为获取详情页数据的唯一标准入口，彻底解决海报图无法显示的问题。
 * - 【v18.0 职责分离】调整了 getTracks 函数的职责，使其专注于获取数据，而由 detail 函数负责按APP规范格式化数据。
 * - 【v1t7.0 逻辑升级】深度借鉴后端脚本，实现“快车道”与“慢车道”两步链接提取。
 */

// --- 配置区 (保持不变) ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const COOKIE = "_xn_accesscount_visited=1; BAIDUID_BFESS=82BB2F2D056FEA224952A3CCB69C40BA:FG=1; bbs_sid=3v5fdrevvvrrbpnuvbmtuv9nci; bbs_token=n_2FnvY5D4BrjB5UnJMoCsNF4MqzeOqI46EbISj_2FirjryKnVtp; guard=DcF2FicbtLwkC6o/wp0nFQ==; guardret=56; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754300299; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753863470,1753865018; HMACCOUNT=8ECC86F14D9CE668; HMACCOUNT_BFESS=8ECC86F14D9CE668";

// --- 核心辅助函数和网络请求封装 (保持不变) ---
function log(msg) { try { $log(`[海绵小站 V18] ${msg}`); } catch (_) { console.log(`[海绵小站 V18] ${msg}`); } }
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

// --- 内部函数：获取详情数据 (v18.0 职责调整) ---
// 这个函数现在返回一个包含海报图和播放列表的对象，供 detail 函数使用
async function getDetailData(url) {
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
                // 如果失败，也返回一个带提示的对象
                return { vod_pic: '', tracks: [{ name: "Cookie无效或回帖失败", pan: "" }] };
            }
        }

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

        // 2. 快车道
        log("进入快车道...");
        mainMessage.find('a').each((_, element) => {
            const linkElement = $(element);
            let href = linkElement.attr('href') || '';
            let text = linkElement.text().trim();
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
            return { vod_pic, tracks };
        }

        // 3. 慢车道
        log("快车道失败，进入慢车道...");
        const outlinks = [];
        mainMessage.find('a[href^="outlink-"]').each((_, element) => {
            outlinks.push({ url: $(element).attr('href'), fileName: $(element).text().trim() || '未知文件' });
        });

        if (outlinks.length === 0) {
            log("慢车道也未找到outlink，提取结束。");
            return { vod_pic, tracks: [{ name: "未找到有效资源", pan: "" }] };
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

        return { vod_pic, tracks };

    } catch (e) {
        log(`获取详情页异常: ${e.message}`);
        return { vod_pic: '', tracks: [{ name: "操作失败，请检查Cookie配置和网络", pan: "" }] };
    }
}


// --- 对外接口 ---

async function getConfig() {
  log("插件初始化 (v18.0 - 详情页重构)");
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

// 【v18.0 核心修正】detail函数现在是获取详情页数据的标准入口
async function detail(id) {
    // 1. 调用内部函数获取数据
    const { vod_pic, tracks } = await getDetailData(id);

    // 2. 组装成APP需要的标准数据结构
    const detailData = {
        vod_id: id,
        vod_pic: vod_pic, // 将海报图放在顶层
        vod_play_from: "云盘",
        vod_play_url: tracks.map(t => `${t.name}$${t.pan}`).join('#') // 将tracks数组转换成标准播放列表字符串
    };

    // 3. 返回包含list数组的最终JSON
    return jsonify({
        list: [detailData]
    });
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

// play接口现在只是一个简单的透传
async function play(flag, id) {
    return jsonify({
        url: id
    });
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }

log('海绵小站插件加载完成 (v18.0 - 详情页重构)');
