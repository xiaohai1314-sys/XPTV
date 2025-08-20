/**
 * 网盘资源社 App 插件前端代码 (V21 - 最终启示版)
 *
 * 功能:
 * - 【正确暗号】采用您发现的、更可靠的“回复...查看”作为判断条件，确保自动回帖流程能被正确触发。
 * - 【填补异步陷阱】通过返回一个临时的“加载中”状态，彻底解决初次进入页面空白的问题。
 * - 【逻辑集成】完美融合了正确的App框架、V14解析引擎、您指定的拼接方式和回帖逻辑。
 * - 【最终承诺】这是为了一次性解决所有已知问题而设计的、完全遵照您所有指示和最终启示的终极版本。
 */

// --- 1. 配置区 ---
const SITE_URL = 'https://www.wpzysq.com';
const SITE_COOKIE = 'bbs_sid=pgd4k99mtoaig06hmcaqj0pgd7; bbs_token=rQzcr8KSQutap2CevsLpjkFRxjiRH3fsoOWCDuk5niwFuhpST6C2TgLIcOU7PoMbTOjfr8Rkaje3QMVax3avYA_3D_3D;';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const cheerio = createCheerio();

// --- 2. 核心工具函数 ---

function log(msg) {
  try { $log(`[网盘资源社插件] ${msg}`); } 
  catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}

function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

function getRandomReply() {
    const replies = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！！！", "不错的帖子点赞！", "感谢楼主，下载来看看"];
    return replies[Math.floor(Math.random() * replies.length)];
}

async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = getRandomReply();
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await $fetch.post(replyUrl, formData, {
            headers: {
                'User-Agent': UA,
                'Cookie': SITE_COOKIE,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': SITE_URL,
                'Referer': `${SITE_URL}/thread-${threadId}.htm`
            }
        });
        
        if (data && data.includes(message)) {
            log(`回帖成功, 内容: "${message}"`);
            return true;
        } else {
            log(`回帖失败: 服务器返回内容异常。`);
            $utils.toastError("回帖失败：服务器返回异常", 3000);
            return false;
        }
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
        $utils.toastError("回帖异常，请检查网络或Cookie", 3000);
        return false;
    }
}

function parseListHtml(html) {
  const $ = cheerio.load(html);
  const cards = [];
  $('.media.thread').each((_, el) => {
    const subjectAnchor = $(el).find('.style3_subject a');
    if (!subjectAnchor.length) return;
    const vod_id = subjectAnchor.attr('href');
    let vod_pic = $(el).find('a > img.avatar-3')?.attr('src') || '';
    if (vod_pic && !vod_pic.startsWith('http' )) {
      vod_pic = `${SITE_URL}/${vod_pic}`;
    }
    cards.push({
      vod_id: vod_id,
      vod_name: subjectAnchor.text().trim(),
      vod_pic: vod_pic,
      vod_remarks: $(el).find('.date')?.text().trim() || '',
      ext: { url: vod_id },
    });
  });
  return cards;
}

// --- 3. App 接口实现 ---

async function getConfig() {
  return jsonify({
    ver: 1,
    title: '网盘资源社(终极版)',
    site: SITE_URL,
    cookie: SITE_COOKIE,
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } }
    ],
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  let url = `${SITE_URL}/${id}`;
  if (parseInt(page) > 1) {
      url = url.replace('.htm', `-${page}.htm`);
  }
  const { data: html } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
  const cards = parseListHtml(html);
  return jsonify({ list: cards });
}

// ★★★★★【填补异步陷阱 + 正确暗号】★★★★★
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  // --- 异步操作 ---
  (async () => {
    const detailUrl = `${SITE_URL}/${url}`;
    let { data: html } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
    
    // ★★★★★【使用您发现的正确暗号】★★★★★
    const isContentHidden = html.includes("回复后") && html.includes("再查看");
    if (isContentHidden) {
        log("检测到回复可见，启动自动回帖流程...");
        const threadIdMatch = url.match(/thread-(\d+)/);
        if (threadIdMatch && threadIdMatch[1]) {
            const replied = await performReply(threadIdMatch[1]);
            if (replied) {
                log("回帖成功，等待1秒后重新获取页面内容...");
                await $utils.sleep(1000);
                const { data: newHtml } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
                html = newHtml;
            } else {
                // 回帖失败，推送失败提示并终止
                $push.post({
                    type: 'update',
                    data: {
                        list: [{ title: '提示', tracks: [{ name: "自动回帖失败，请检查Cookie", pan: '', ext: {} }] }]
                    }
                });
                return;
            }
        }
    }

    // --- V14解析引擎，就地执行 ---
    const $ = cheerio.load(html);
    const mainMessage = $(".message[isfirst='1']");
    const tracks = [];

    if (mainMessage.length) {
      const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
      const finalResultsMap = new Map();
      let lastTitle = '';

      mainMessage.children().each((_, element) => {
          const el = $(element);
          const text = el.text().trim();
          if (text === '夸克' || text === '阿里') { lastTitle = text; return; }
          let lastLinkNode = null;
          el.contents().each((_, node) => {
              const nodeType = node.type;
              const nodeText = $(node).text();
              if (nodeType === 'tag' && node.name === 'a' && supportedHosts.some(host => $(node).attr('href').includes(host))) {
                  lastLinkNode = $(node);
                  const href = lastLinkNode.attr('href');
                  if (!finalResultsMap.has(href)) {
                      let fileName = lastTitle || (href.includes('quark.cn') ? '夸克' : '阿里');
                      finalResultsMap.set(href, { pureLink: href, accessCode: '', fileName });
                  }
              } else if (nodeType === 'text' && nodeText.includes('提取码')) {
                  const passMatch = nodeText.match(/提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
                  if (passMatch && passMatch[1] && lastLinkNode) {
                      const accessCode = passMatch[1].trim();
                      const href = lastLinkNode.attr('href');
                      const existingRecord = finalResultsMap.get(href);
                      if (existingRecord) { existingRecord.accessCode = accessCode; }
                      lastLinkNode = null;
                  }
              }
          });
          if (el.find('a').length > 0) { lastTitle = ''; }
      });

      finalResultsMap.forEach(record => {
          let finalPan = record.pureLink;
          if (record.accessCode) {
              const separator = finalPan.includes('?') ? '&' : '?';
              finalPan = `${finalPan}${separator}pwd=${record.accessCode}`;
          }
          tracks.push({ name: record.fileName, pan: finalPan, ext: { pwd: '' } });
      });
    }

    if (tracks.length === 0) {
      let message = '获取资源失败或帖子无内容';
      if (isContentHidden) message = '自动回帖后仍未找到资源';
      tracks.push({ name: message, pan: '', ext: {} });
    }
    
    // ★★★★★【推送最终结果】★★★★★
    $push.post({
        type: 'update',
        data: {
            list: [{ title: '资源列表', tracks }]
        }
    });

  })();

  // ★★★★★【同步返回加载中状态】★★★★★
  return jsonify({
    list: [{
      title: '资源列表',
      tracks: [{
        name: '正在加载，请稍候...',
        pan: 'loading', // 特殊标记，App端可用于显示加载动画
        ext: {}
      }]
    }]
  });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  const { data: html } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
  const cards = parseListHtml(html);
  
  return jsonify({ list: cards });
}

// --- 4. 兼容旧版 App 接口 ---
async function init() { return getConfig(); }
async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return jsonify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg, filter, ext) { 
  const id = ext.id || tid;
  return getCards({ id: id, page: pg }); 
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id, flags) { return jsonify({ url: id }); }
