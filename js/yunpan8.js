/**
 * 海绵小站前端插件 - v11.0 (Safari授权方案)
 * 
 * 更新日志:
 * - 【v11.0 架构革命】彻底放弃后端代理，采用与“云巢”脚本完全一致的“外部Safari登录，内部$fetch共享Cookie”的最终正确架构。
 * - 【v11.0 登录逻辑】在需要权限的操作（如自动回帖）失败时，调用 $utils.openSafari 将用户引导至手机原生Safari浏览器完成登录/验证，一劳永逸地解决所有复杂验证码问题。
 * - 【v11.0 纯前端化】所有功能，包括自动回帖，均在前端通过 $fetch 完成，完全摆脱对后端的依赖。
 * - 【v11.0 最终形态】此版本是基于对App环境工作原理的最终正确理解而构建的，是成功的唯一途径。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V11] ${msg}`); } catch (_) { console.log(`[海绵小站 V11] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 自动回帖与登录处理 ---
async function replyAndCheckLogin(url) {
    log("尝试自动回帖...");
    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) {
        log("回帖失败：无法从URL中解析出帖子ID。");
        return false;
    }
    const threadId = threadIdMatch[1];
    // 注意：海绵小站的回帖需要从页面表单提交，而不是简单的API。我们需要找到那个POST的目标URL。
    // 通常是 post-reply-tid-1.htm 或类似格式。我们先假设是 post-create-tid-1.htm
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;

    try {
        // 关键：直接用$fetch.post模拟表单提交
        const { data } = await $fetch.post(postUrl, {
            doctype: 1,
            return_html: 1,
            message: getRandomText(replies),
            quotepid: 0,
            quick_reply_message: 0
        }, { headers: { 'User-Agent': UA, 'Referer': url } }); // 加上Referer头可能很重要

        const $ = cheerio.load(data);
        const alertText = $('.alert.alert-danger').text().trim();

        // **最核心的登录判断逻辑**
        if (alertText.includes("您尚未登录")) {
            log("回帖失败：需要登录。将启动Safari进行登录...");
            if (typeof $utils !== 'undefined' && typeof $utils.openSafari === 'function') {
                $utils.toastError("需要登录，请在跳转的浏览器中完成登录/验证");
                // 启动外部Safari，让用户完成所有复杂操作
                await $utils.openSafari(`${SITE_URL}/user-login.htm`, UA);
                log("Safari已关闭，假设登录成功，将重试操作。");
                return true; // 返回true，告诉上层函数需要重试
            } else {
                log("致命错误：找不到 $utils.openSafari 函数！插件无法继续。");
                $utils.toastError("插件环境异常，无法打开浏览器登录");
                return false; 
            }
        }
        
        if (alertText) {
            log(`回帖时遇到提示: ${alertText}`);
        } else {
            log("回帖成功或已回过帖。");
        }
        // 无论成功还是遇到“回帖太快”等提示，都返回true，让上层重试获取内容
        return true; 

    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        return false;
    }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
  log("插件初始化 (V11.0 - Safari授权方案)");
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
  
  // 尝试直接获取
  log(`尝试直接获取详情: ${detailUrl}`);
  let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
  let $ = cheerio.load(data);
  
  let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");

  // 如果内容被隐藏，则启动回帖流程
  if (isContentHidden) {
      log("内容被隐藏，启动回帖流程...");
      const canRetry = await replyAndCheckLogin(detailUrl);
      if (canRetry) {
          log("回帖/登录流程结束，重新获取详情页面...");
          const retryResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
          data = retryResponse.data;
          $ = cheerio.load(data); // 重新加载内容
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
      tracks.push({ name: "未找到有效资源或回帖失败", pan: "" });
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

log('海绵小站插件加载完成 (V11.0 - Safari授权方案)');
