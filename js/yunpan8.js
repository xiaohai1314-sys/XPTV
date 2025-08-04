/**
 * 海绵小站前端插件 - v14.0 (最终完美增强版)
 * 
 * 更新日志:
 * - 【v14.0 搜索增强】修正了搜索功能的URL构造方式，采用更通用、兼容性更好的 `search.htm?keyword=` 查询字符串格式，以解决搜索失败的问题。
 * - 【v13.0 功能固化】保留了V13版本中被验证为正确的“海报路径补全”和“Safari授权”核心逻辑。
 * - 【v14.0 目标】此版本旨在修复搜索功能，成为一个功能100%完整、显示完美、逻辑稳健的最终交付版本。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V14] ${msg}`); } catch (_) { console.log(`[海绵小站 V14] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function completeUrl(path) {
    if (!path) return "";
    if (path.startsWith('http' )) return path;
    if (path.startsWith('//')) return 'https:' + path;
    return `${SITE_URL}/${path.startsWith('/' ) ? path.substring(1) : path}`;
}

// --- 自动回帖与登录处理 (V12的正确逻辑) ---
async function replyAndCheckLogin(url) {
    log("尝试自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) { log("回帖失败：无法从URL中解析出帖子ID。"); return false; }
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;

    try {
        const { data } = await $fetch.post(postUrl, {
            doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0
        }, { headers: { 'User-Agent': UA, 'Referer': url } });

        const $ = cheerio.load(data);
        const alertText = $('.alert.alert-danger').text().trim();

        if (alertText.includes("您尚未登录")) {
            log("回帖失败：需要登录。将启动Safari进行登录...");
            if (typeof $utils !== 'undefined' && typeof $utils.openSafari === 'function') {
                $utils.toastError("需要登录，请在跳转的浏览器中完成登录/验证");
                $utils.openSafari(`${SITE_URL}/user-login.htm`, UA);
                log("已发送跳转指令。");
                return true; 
            } else {
                $utils.toastError("插件环境异常，无法打开浏览器登录");
                return false; 
            }
        }
        log("回帖成功或遇到其他提示，流程继续。");
        return true; 
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        return false;
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
  log("插件初始化 (V14.0 - 最终完美增强版)");
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
  log(`获取分类: ${url}`);

  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const cards = [];
  $("ul.threadlist > li.media.thread").each((_, item) => {
      cards.push({
          vod_id: $(item).find(".subject a")?.attr("href") || "",
          vod_name: $(item).find(".subject a")?.text().trim() || "",
          vod_pic: completeUrl($(item).find("a > img.avatar-3")?.attr("src")),
          vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
          ext: { url: $(item).find(".subject a")?.attr("href") || "" }
      });
  });
  log(`成功解析 ${cards.length} 条数据`);
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  let tracks = [];
  
  log(`尝试直接获取详情: ${detailUrl}`);
  let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
  let $ = cheerio.load(data);
  
  let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");

  if (isContentHidden) {
      log("内容被隐藏，启动回帖/登录流程...");
      const canRetry = await replyAndCheckLogin(detailUrl);
      if (canRetry) {
          log("回帖/登录流程已触发，为确保Cookie生效，延迟3秒后重试...");
          await new Promise(resolve => setTimeout(resolve, 3000));
          log("重新获取详情页面...");
          const retryResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
          data = retryResponse.data;
          $ = cheerio.load(data);
      }
  }

  const playUrlParts = [];
  const seenUrls = new Set();
  const mainMessage = $('.message[isfirst="1"]');
  const fullMessageText = mainMessage.text();
  let globalAccessCode = '';
  const passMatch = fullMessageText.match(/(?:访问码|提取码|密码)\s*[:：]\s*([\w*.:-]+)/i);
  if (passMatch && passMatch[1]) {
      globalAccessCode = passMatch[1].replace(/[^a-zA-Z0-9]/g, '');
  }

  mainMessage.find('a').each((_, linkElement) => {
      let link = $(linkElement).attr('href');
      if (link && link.includes('cloud.189.cn')) {
          if (seenUrls.has(link)) return;
          seenUrls.add(link);
          let fileName = $(linkElement).text().trim() || $('h4.break-all').text().trim();
          let finalUrl = globalAccessCode ? `${link} (访问码: ${globalAccessCode})` : link;
          playUrlParts.push(`${fileName}$${finalUrl}`);
      }
  });
  
  tracks = playUrlParts.map(part => {
      const [name, pan] = part.split('$');
      return { name, pan };
  });

  if (tracks.length === 0) {
      tracks.push({ name: "未找到有效资源或需手动登录后重试", pan: "" });
  }

  return jsonify({ list: [{ title: '云盘', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  
  // 【关键修正】采用最标准的查询字符串URL格式
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  
  log(`执行搜索: ${url}`);
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
  const $ = cheerio.load(data);
  const cards = [];
  
  // 搜索结果页的HTML结构可能与分类页不同，使用更通用的选择器
  $("ul.threadlist > li.media, ul.search-threadlist > li.media").each((_, item) => {
      cards.push({
          vod_id: $(item).find(".subject a")?.attr("href") || "",
          vod_name: $(item).find(".subject a")?.text().trim() || "",
          vod_pic: completeUrl($(item).find("a > img.avatar-3")?.attr("src")),
          vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "",
          ext: { url: $(item).find(".subject a")?.attr("href") || "" }
      });
  });
  
  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (V14.0 - 最终完美增强版)');
