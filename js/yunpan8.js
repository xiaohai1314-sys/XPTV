/**
 * 海绵小站前端插件 - v12.01 (await修正方案)
 * 
 * 更新日志:
 * - 【v12.0 核心修正】根据对“云巢”脚本的逐行对比，移除了对 `$utils.openSafari` 的 `await` 调用。这被怀疑是导致跳转失败和白屏的根本原因。
 * - 【v12.0 架构确认】坚定地采用纯前端“Safari授权”方案，这是唯一正确的道路。
 * - 【v12.0 目标】此版本旨在通过最精确地模仿成功案例，解决“不跳转”的最终难题，让插件真正可用。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V12] ${msg}`); } catch (_) { console.log(`[海绵小站 V12] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 自动回帖与登录处理 (修正版) ---
async function replyAndCheckLogin(url) {
    log("尝试自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) {
        log("回帖失败：无法从URL中解析出帖子ID。");
        return false;
    }
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
                
                // 【关键修正】模仿“云巢”脚本的成功逻辑。
                // 1. 直接调用跳转，不使用 await。
                // 2. 立即返回 false，中断当前操作，让用户手动处理登录。
                //    这避免了脚本在后台无效地等待或重试。
                $utils.openSafari(`${SITE_URL}/user-login.htm`, UA);
                return false; // <-- 修改点：直接返回false，与云巢脚本行为一致。
                
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
  log("插件初始化 (V12.0 - await修正方案)");
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
          vod_pic: $(item).find("a > img.avatar-3")?.attr("src") || "",
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
          log("回帖/登录流程已触发，为确保Cookie生效，延迟2秒后重试...");
          // 增加一个短暂的延时，给App环境和Cookie同步留出时间
          await new Promise(resolve => setTimeout(resolve, 2000));
          log("重新获取详情页面...");
          const retryResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
          data = retryResponse.data;
          $ = cheerio.load(data);
      }
  }

  // 解析最终的页面内容
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
  const url = `${SITE_URL}/search-${encodeURIComponent(text)}.htm`;
  log(`执行搜索: ${url}`);
  const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
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
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('海绵小站插件加载完成 (V12.0 - await修正方案)');
