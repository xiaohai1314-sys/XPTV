/**
 * 网盘资源社 App 插件前端代码 (V17 - 终极融合版)
 *
 * 功能:
 * - 【最终框架】采用您提供的、经过验证的App环境框架，包含正确的`$fetch`, `cheerio`及您最认可的回帖逻辑。
 * - 【V14解析引擎】搭载我们共同打磨的“节点遍历”解析引擎，精准处理所有复杂布局。
 * - 【最终指令】严格执行您的核心要求，在`pan`字段中输出拼接好的`?pwd=`链接，并提供豁免符。
 * - 【最终承诺】这是为了一次性解决所有已知问题而设计的、完全遵照您指示的最终版本。
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

// ★★★★★【采用您认可的回帖逻辑】★★★★★
async function performReply(threadId) {
    log(`正在为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const replies = ["感谢分享，资源太棒了", "找了好久，太谢谢了", "非常棒的资源！"];
    const message = replies[Math.floor(Math.random() * replies.length)];
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await $fetch.post(replyUrl, formData, {
            headers: {
                'User-Agent': UA,
                'Cookie': SITE_COOKIE,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `${SITE_URL}/thread-${threadId}.htm`
            }
        });
        if (data && data.includes(message)) {
            log("回帖成功！");
            return true;
        }
        log("回帖失败或未返回预期内容。");
        return false;
    } catch (e) {
        log(`回帖请求异常: ${e.message}`);
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
  log(`解析到 ${cards.length} 条数据`);
  return cards;
}

// ★★★★★【搭载我们共同打磨的V14解析引擎】★★★★★
function parseDetailHtml(html) {
  const $ = cheerio.load(html);
  const mainMessage = $(".message[isfirst='1']");
  if (!mainMessage.length) {
    log("❌ 错误：找不到主内容区域 .message[isfirst='1']");
    return "暂无有效网盘链接";
  }

  if (mainMessage.text().includes("回复")) {
      log("⚠️ 检测到需要回复才能查看内容。");
      return "需要回复才能查看";
  }

  log("页面内容已完全显示，开始使用V14终极引擎解析...");
  
  const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
  const finalResultsMap = new Map();
  let lastTitle = '';

  mainMessage.children().each((_, element) => {
      const el = $(element);
      const text = el.text().trim();
      
      if (text === '夸克' || text === '阿里') {
          lastTitle = text;
          log(`识别到上下文标题: ${lastTitle}`);
          return;
      }

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
                  log(`初步识别链接: 文件名=${fileName}, 链接=${href}`);
              }
          }
          else if (nodeType === 'text' && nodeText.includes('提取码')) {
              const passMatch = nodeText.match(/提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
              if (passMatch && passMatch[1] && lastLinkNode) {
                  const accessCode = passMatch[1].trim();
                  const href = lastLinkNode.attr('href');
                  const existingRecord = finalResultsMap.get(href);
                  if (existingRecord) {
                      existingRecord.accessCode = accessCode;
                      log(`成功关联提取码: 链接=${href}, 提取码=${accessCode}`);
                  }
                  lastLinkNode = null;
              }
          }
      });

      if (el.find('a').length > 0) {
          lastTitle = '';
      }
  });

  const dataPackages = [];
  finalResultsMap.forEach(record => {
      dataPackages.push(`${record.fileName}$${record.pureLink}|${record.accessCode}`);
  });

  log(`解析完成, 共生成 ${dataPackages.length} 个有效数据包`);
  return dataPackages.join("$$$") || "暂无有效网盘链接";
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
  
  const html = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } }).then(res => res.data);
  const cards = parseListHtml(html);
  
  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  let html = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } }).then(res => res.data);
  
  // --- 自动回帖核心逻辑 ---
  if (html.includes("回复") && (html.includes("才能查看") || html.includes("后可见"))) {
      log("检测到回复可见，启动自动回帖流程...");
      const threadIdMatch = url.match(/thread-(\d+)/);
      if (threadIdMatch && threadIdMatch[1]) {
          const replied = await performReply(threadIdMatch[1]);
          if (replied) {
              log("回帖成功，等待1秒后重新获取页面内容...");
              await $utils.sleep(1000);
              html = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } }).then(res => res.data);
          } else {
              return jsonify({ list: [{ title: '提示', tracks: [{ name: "自动回帖失败，请检查Cookie", pan: '', ext: {} }] }] });
          }
      }
  }

  const playUrlString = parseDetailHtml(html);

  const tracks = [];
  if (playUrlString && !["暂无有效网盘链接", "需要回复才能查看"].includes(playUrlString)) {
    playUrlString.split('$$$').forEach((pkg) => {
      if (!pkg.trim()) return;
      const parts = pkg.split('$');
      if (parts.length < 2) return;

      const fileName = parts[0];
      const [pureLink, accessCode = ''] = parts[1].split('|');

      // ★★★★★【执行您的最终指令：拼接URL】★★★★★
      let finalPan = pureLink;
      if (accessCode) {
          const separator = pureLink.includes('?') ? '&' : '?';
          finalPan = `${pureLink}${separator}pwd=${accessCode}`;
      }

      tracks.push({
        name: fileName,
        pan: finalPan,      // 输出拼接好的、带?pwd=的URL
        ext: { pwd: '' },   // 提供豁免符
      });
    });
  }

  if (tracks.length === 0) {
    const message = playUrlString || '获取资源失败或帖子无内容';
    tracks.push({ name: message, pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  const html = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } }).then(res => res.data);
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
