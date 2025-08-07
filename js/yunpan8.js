// ==UserScript==
// @name         海绵小站插件 - v62.1-blackhawk-fix
// @version      62.1
// @description  修复嵌套 <a> 导致资源提取失败（如黑鹰坠落）
// @match        *://www.haimianxz.com/*
// ==/UserScript==

const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 
const COOKIE = "_xn_accesscount_visited=1; bbs_sid=787sg4qld077s6s68h6i1ijids; bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu; Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1753817104,1754316688,1754316727; HMACCOUNT=DBCFE6207073AAA3; Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316803";

function log(msg) { 
  try { $log(`[海绵小站 V62.1-blackhawk-fix] ${msg}`); } 
  catch (_) { console.log(`[海绵小站 V62.1-blackhawk-fix] ${msg}`); } 
}

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

function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `${SITE_URL}/${cleanPath}`;
}

async function getConfig() {
  log("插件初始化 (v62.1-blackhawk-fix)");
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

async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    log(`开始处理详情页: ${detailUrl}`);
    
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
        const mainMessageHtml = mainMessage.html();
        const mainMessageText = mainMessage.text();
        const pageTitle = $("h4.break-all").text().trim();
        const tracks = [];

        const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;

        // 修复：嵌套<a>标签 + 重复链接问题
        const textLinks = mainMessageHtml.match(linkRegex) || [];
        const hrefLinks = [];
        mainMessage.find('a[href]').each((_, el) => {
            const href = $(el).attr('href')?.trim();
            if (href && href.includes('cloud.189.cn')) {
                hrefLinks.push(href);
            }
        });
        const uniqueLinks = [...new Set([...textLinks, ...hrefLinks])];

        const codePool = [];
        const textCodeRegex = /(?:访问码|提取码)[：: ]?([a-zA-Z0-9]{4})/g;
        let match;
        while ((match = textCodeRegex.exec(mainMessageText)) !== null) {
            codePool.push(match[1]);
        }

        uniqueLinks.forEach((link, index) => {
            const linkElement = mainMessage.find(`a[href="${link}"]`).first();
            let fileName = pageTitle;
            if (linkElement.length > 0) {
                let text = linkElement.text().trim();
                if (!text || text.startsWith('http')) {
                    text = linkElement.parent().text().trim();
                }
                if (text && text.length > 5 && !text.startsWith('http')) {
                    fileName = text;
                }
            }
            const code = codePool[index] || '';
            let finalPan;
            if (code) {
                finalPan = `${link}（访问码：${code}）`;
            } else {
                finalPan = link;
            }
            tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' } });
        });

        return jsonify([{ title: "网盘资源", tracks }]);
    } catch (e) {
        log(`解析详情页失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

.threadlist li").each((i, el) => {
      const $el = cheerio(el);
      const title = $el.find(".s.xst").text().trim();
      const pic = getCorrectPicUrl($el.find("img").attr("src"));
      const url = $el.find(".s.xst").attr("href");
      if (title && url) {
        cards.push({ name: title, pic, url: SITE_URL + '/' + url });
      }
  });
  return jsonify({ cards });
  } catch (e) {
    log(`获取卡片失败: ${e.message}`);
    return jsonify({ cards: [] });
  }
}

async function getTracks(ext) {
  ext = argsify(ext);
  const url = ext.url;
  const { data } = await fetchWithCookie(url);
  const $ = cheerio.load(data);
  const mainMessage = $("div#postlist div[id^='post_']:first .t_f");
  const mainMessageHtml = mainMessage.html() || '';
  const mainMessageText = mainMessage.text() || '';
  const pageTitle = $("title").text().trim().replace(/\s*-\s*海绵小站$/, '');
  const linkRegex = /https?:\/\/cloud\.189\.cn\/[^\s<"']+/g;
  const codeRegex = /访问码[：: ]*([a-zA-Z0-9]{4})/g;

  // 修复点：支持 <a href> 中嵌套链接提取
  const textLinks = mainMessageHtml.match(linkRegex) || [];
  const hrefLinks = [];
  mainMessage.find('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (href && href.includes('cloud.189.cn')) {
      hrefLinks.push(href);
    }
  });
  const uniqueLinks = [...new Set([...textLinks, ...hrefLinks])];

  const codePool = [];
  let match;
  while ((match = codeRegex.exec(mainMessageText)) !== null) {
    codePool.push(match[1]);
  }

  const tracks = [];

  uniqueLinks.forEach((link, index) => {
    const linkElement = mainMessage.find(`a[href="${link}"]`).first();
    let fileName = pageTitle;
    if (linkElement.length > 0) {
      let text = linkElement.text().trim();
      if (!text || text.startsWith('http')) {
        text = linkElement.parent().text().trim();
      }
      if (text && text.length > 5 && !text.startsWith('http')) {
        fileName = text;
      }
    }

    const code = codePool[index] || '';
    let finalPan;
    if (code) {
      finalPan = `${link}（访问码：${code}）`;
      log(`为链接 ${link} 分配到访问码: ${code}`);
    } else {
      finalPan = link;
    }

    tracks.push({ name: fileName, pan: finalPan, ext: { pwd: '' } });
  });

  return jsonify({ tracks });
}

async function getDetail(ext) {
  ext = argsify(ext);
  const { data } = await fetchWithCookie(ext.url);
  const $ = cheerio.load(data);
  const title = $("title").text().trim().replace(/\s*-\s*海绵小站$/, '');
  const img = getCorrectPicUrl($("img").first().attr("src"));
  const desc = $("meta[name='description']").attr("content") || title;
  return jsonify({ name: title, pic: img, desc });
}

async function search(ext) {
  ext = argsify(ext);
  const { keyword = '', page = 1 } = ext;
  const url = `${SITE_URL}/search.php?searchsubmit=yes&srchtxt=${encodeURIComponent(keyword)}&page=${page}`;
  try {
    const { data } = await fetchWithCookie(url);
    const $ = cheerio.load(data);
    const cards = [];
    $("div.result-list li").each((i, el) => {
      const $el = cheerio(el);
      const title = $el.find("a").text().trim();
      const link = $el.find("a").attr("href");
      const pic = getCorrectPicUrl($el.find("img").attr("src"));
      if (title && link) {
        cards.push({ name: title, url: SITE_URL + '/' + link, pic });
      }
    });
    return jsonify({ cards });
  } catch (e) {
    log(`搜索失败: ${e.message}`);
    return jsonify({ cards: [] });
  }
}
