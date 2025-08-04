/**
 * 海绵小站前端插件 - v15.0 (终极方案：智能跳转)
 * 
 * 更新日志:
 * - 【v15.0 最终结论】通过cURL分析，确认登录请求包含无法模拟的动态验证码参数。因此，脚本内模拟登录方案不可行。
 * - 【v15.0 回归初心】回归并优化“跳转浏览器登录”方案。这是唯一可行且稳定的方式。
 * - 【v15.0 智能交互】当需要登录时，脚本会明确提示用户，并打开浏览器。用户在浏览器登录成功后，返回APP点击重试即可。
 * - 【v15.0 移除无效代码】完全移除了模拟登录、MD5加密等所有不再需要的复杂逻辑，让脚本更轻量、更稳定。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V15] ${msg}`); } catch (_) { console.log(`[海绵小站 V15] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 登录处理 (智能跳转版) ---
function handleLoginRedirect() {
    log("需要登录，执行跳转浏览器方案。");
    const loginUrl = `${SITE_URL}/user-login.htm`;
    $utils.toastError("需要登录，请在浏览器中操作后返回重试", 5000); // 显示5秒
    // 使用最原始、最简单的跳转方式，不附加任何复杂逻辑
    $utils.openSafari(loginUrl, UA);
}

// --- 自动回帖 (依赖Cookie) ---
async function reply(url) {
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
        // 直接发送回帖请求，让APP环境自动带上已有的Cookie
        const { data } = await $fetch.post(postUrl, {
            doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0
        }, { headers: { 'User-Agent': UA, 'Referer': url } });

        // 检查回帖是否因为未登录而失败
        if (data.includes("您尚未登录")) {
            log("回帖失败：Cookie无效或未登录。");
            return false;
        }
        
        log("回帖请求已发送，可能成功。");
        return true;

    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        return false;
    }
}

// --- getTracks (核心业务逻辑) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    
    // 1. 首次尝试获取页面
    let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
    let $ = cheerio.load(data);
    
    // 2. 检查是否需要回复
    let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");

    if (isContentHidden) {
        log("内容被隐藏，启动回帖/登录流程...");
        const replied = await reply(detailUrl);
        
        if (replied) {
            // 如果回帖成功，说明已登录，刷新页面获取资源
            log("回帖成功，重新获取页面内容...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
            const retryResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
            data = retryResponse.data;
            $ = cheerio.load(data);
        } else {
            // 如果回帖失败，大概率是没登录，执行跳转
            log("回帖失败，判定为未登录，执行跳转。");
            handleLoginRedirect();
            // 返回提示信息，让用户操作后重试
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "请在浏览器登录后，返回本页面下拉刷新", pan: "" }] }] });
        }
    }

    // 3. 解析最终的页面内容
    const tracks = [];
    const mainMessage = $('.message[isfirst="1"]');
    mainMessage.find('a').each((_, linkElement) => {
        let link = $(linkElement).attr('href');
        if (link && (link.includes('cloud.189.cn') || link.includes('pan.quark.cn') || link.includes('www.alipan.com'))) {
            let fileName = $(linkElement).text().trim() || '未知文件名';
            tracks.push({ name: fileName, pan: link });
        }
    });

    if (tracks.length === 0) {
        tracks.push({ name: "未找到有效资源，或需要回复", pan: "" });
    }
    return jsonify({ list: [{ title: '云盘', tracks }] });
}


// 其他函数 (getConfig, getCards, search等) 保持不变
async function getConfig() {
  log("插件初始化 (v15.0 - 终极方案)");
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

log('海绵小站插件加载完成 (v15.0 - 终极方案)');
