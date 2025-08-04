/**
 * 海绵小站前端插件 - v13.0 (模拟登录方案)
 * 
 * 更新日志:
 * - 【v13.0 核心革新】放弃浏览器跳转方案，采用脚本内模拟登录，从根本上解决跳转失败问题。
 * - 【v13.0 用户配置】在脚本顶部增加了账号密码配置区，方便使用。
 * - 【v13.0 混合模式】优先尝试自动登录。如果遇到验证码，会提示用户并尝试跳转浏览器进行手动验证。
 */

// --- 配置区 ---
const SITE_URL = "https://www.haimianxz.com";
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X  ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();

// ★★★★★【用户配置区】★★★★★
// 请在此处填入您在“海绵小站”的账号和密码
const USER_CREDENTIALS = {
    username: "1083328569@qq.com", // 替换成您的用户名
    password: "xiaohai1314"  // 替换成您的密码
};
// ★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg) { try { $log(`[海绵小站 V13] ${msg}`); } catch (_) { console.log(`[海绵小站 V13] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getRandomText(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- 登录与状态管理 ---
let isLoggedIn = false; // 全局变量，跟踪登录状态

async function ensureLogin() {
    if (isLoggedIn) {
        log("已登录，跳过登录检查。");
        return true;
    }
    
    log("开始执行登录流程...");
    if (!USER_CREDENTIALS.username || !USER_CREDENTIALS.password || USER_CREDENTIALS.username === "YOUR_USERNAME") {
        log("错误：未在脚本中配置账号密码。");
        $utils.toastError("请先在插件脚本中配置账号密码");
        return false;
    }

    // 登录接口地址，这通常需要通过开发者工具抓包确认
    const loginUrl = `${SITE_URL}/user-login.htm`;

    try {
        // 1. 先GET一次登录页面，获取必要的表单参数，如xsrf_token
        const getRes = await $fetch.get(loginUrl, { headers: { 'User-Agent': UA } });
        const $get = cheerio.load(getRes.data);
        const xsrfToken = $get('input[name="xsrf_token"]').val();
        if (!xsrfToken) {
            log("警告：未能获取到登录所需的xsrf_token，可能导致登录失败。");
        }

        // 2. 发送POST请求进行登录
        const { data, headers } = await $fetch.post(loginUrl, {
            // 这些是表单数据，需要根据实际情况调整
            username: USER_CREDENTIALS.username,
            password: USER_CREDENTIALS.password,
            xsrf_token: xsrfToken,
            // 有些网站还有其他隐藏的表单字段
        }, {
            headers: {
                'User-Agent': UA,
                'Referer': loginUrl,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // 3. 判断登录是否成功
        const $post = cheerio.load(data);
        if (data.includes("欢迎您回来") || $post('a[href*="user-logout"]').length > 0) {
            log("登录成功！");
            isLoggedIn = true;
            $utils.toastSuccess("账号登录成功");
            return true;
        } else if ($post('.gt-captcha').length > 0 || data.includes("验证码")) {
            log("登录失败：检测到验证码。");
            $utils.toastError("需要手动验证，请在浏览器中完成滑块或图片验证");
            // 尝试跳转，让用户手动处理
            $utils.openSafari(loginUrl, UA);
            return false;
        } else {
            const errorMsg = $post('.alert.alert-danger').text().trim() || "未知错误";
            log(`登录失败: ${errorMsg}`);
            $utils.toastError(`登录失败: ${errorMsg}`);
            return false;
        }
    } catch (e) {
        log(`登录请求异常: ${e.message}`);
        $utils.toastError("登录请求异常，请检查网络");
        return false;
    }
}


// --- 自动回帖 (现在依赖登录状态) ---
async function replyAndCheckLogin(url) {
    log("尝试自动回帖...");
    // 确保已登录
    const loginSuccess = await ensureLogin();
    if (!loginSuccess) {
        log("回帖前置条件失败：登录未成功。");
        return false;
    }

    const replies = ["资源很好,感谢分享!", "太棒了,感谢楼主分享!", "不错的帖子,支持一下!", "终于等到你,还好我没放弃!"];
    const threadIdMatch = url.match(/thread-(\d+)/);
    if (!threadIdMatch) return false;
    const threadId = threadIdMatch[1];
    const postUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;

    try {
        // 因为已经登录，这里的POST请求会携带上登录成功后的Cookie
        await $fetch.post(postUrl, {
            doctype: 1, return_html: 1, message: getRandomText(replies), quotepid: 0, quick_reply_message: 0
        }, { headers: { 'User-Agent': UA, 'Referer': url } });
        log("回帖请求已发送。");
        return true;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        return false;
    }
}


// --- getTracks (流程简化) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });

    const detailUrl = `${SITE_URL}/${url}`;
    let { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
    let $ = cheerio.load(data);
    
    let isContentHidden = $("div.alert.alert-warning").text().includes("回复后");

    if (isContentHidden) {
        log("内容被隐藏，启动回帖流程...");
        const replied = await replyAndCheckLogin(detailUrl);
        if (replied) {
            log("回帖成功，重新获取页面内容...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒让服务器处理完毕
            const retryResponse = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
            data = retryResponse.data;
            $ = cheerio.load(data);
        } else {
            log("回帖或登录失败，无法查看内容。");
            return jsonify({ list: [{ title: '提示', tracks: [{ name: "登录或回帖失败，无法获取资源", pan: "" }] }] });
        }
    }

    // ...后续的页面解析代码保持不变...
    const tracks = [];
    const mainMessage = $('.message[isfirst="1"]');
    mainMessage.find('a').each((_, linkElement) => {
        let link = $(linkElement).attr('href');
        if (link && link.includes('cloud.189.cn')) {
            let fileName = $(linkElement).text().trim() || '未知文件名';
            tracks.push({ name: fileName, pan: link });
        }
    });

    if (tracks.length === 0) {
        tracks.push({ name: "未找到有效资源", pan: "" });
    }
    return jsonify({ list: [{ title: '云盘', tracks }] });
}


// 其他函数 (getConfig, getCards, search等) 保持不变
// ...
async function getConfig() {
  log("插件初始化 (V13.0 - 模拟登录方案)");
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

log('海绵小站插件加载完成 (V13.0 - 模拟登录方案)');
