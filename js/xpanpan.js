/**
 * 网盘资源社 App 插件前端代码 (V22 - UX优化版)
 *
 * 功能:
 * - 【UX优化】解决了首次进入帖子时，因后台自动回帖导致页面长时间空白的问题。
 * - 【即时反馈】当检测到需要回帖时，脚本会立刻返回提示语（如“已在后台自动回帖，请退出后重新进入”），同时在后台完成回帖任务。
 * - 【逻辑对标】完全对标成功范例的交互逻辑，提供流畅的用户体验。
 * - 【根源修复】保留了所有已验证的修复（正确的$fetch语法、V14解析引擎等）。
 */

// --- 1. 配置区 ---
const SITE_URL = 'https://www.wpzysq.com';
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%7D; __mxav__c1-WWwEoLo0=137';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
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

async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = "感谢分享";
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;

    try {
        const { data } = await $fetch.post(replyUrl, formData, {
            headers: {
                'accept': 'text/plain, */*; q=0.01',
                'accept-language': 'zh-CN,zh;q=0.9',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'cookie': SITE_COOKIE,
                'origin': SITE_URL,
                'referer': `${SITE_URL}/thread-${threadId}.htm`,
                'user-agent': UA,
                'x-requested-with': 'XMLHttpRequest'
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
    if (vod_pic && !vod_pic.startsWith('http')) {
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
    title: '网盘资源社(UX优化版)',
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


async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  const { data: html } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });

  // --- ★★★ UX优化核心逻辑 ★★★ ---
  const isContentHidden = html.includes("回复后") && (html.includes("再查看") || html.includes("后可见"));
  if (isContentHidden) {
      log("检测到回复可见，启动后台自动回帖...");
      const threadIdMatch = url.match(/thread-(\d+)/);
      if (threadIdMatch && threadIdMatch[1]) {
          // 只执行回帖，不等待，也不重新获取页面
          performReply(threadIdMatch[1]);
      }
      // 无论回帖是否开始，立刻返回提示信息
      log("立即返回提示信息，让用户刷新。");
      const tracks = [{ name: "已在后台自动回帖，请退出后重新进入", pan: '', ext: {} }];
      return jsonify({ list: [{ title: '提示', tracks }] });
  }

  // --- V14解析引擎，仅在内容可见时执行 ---
  const $ = cheerio.load(html);
  const mainMessage = $(".message[isfirst='1']");
  const tracks = [];

  if (mainMessage.length) {
    log("页面内容已完全显示，开始使用V14终极引擎解析...");
    const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
    const finalResultsMap = new Map();
    let lastTitle = '';

    mainMessage.children().each((_, element) => {
        const el = $(element);
        const text = el.text().trim();

        if (text === '夸克' || text === '阿里') {
            lastTitle = text;
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
                    }
                    lastLinkNode = null;
                }
            }
        });

        if (el.find('a').length > 0) {
            lastTitle = '';
        }
    });

    finalResultsMap.forEach(record => {
        let finalPan = record.pureLink;
        if (record.accessCode) {
            const separator = finalPan.includes('?') ? '&' : '?';
            finalPan = `${finalPan}${separator}pwd=${record.accessCode}`;
        }
        tracks.push({
          name: record.fileName,
          pan: finalPan,
          ext: { pwd: '' },
        });
    });
  }

  if (tracks.length === 0) {
    tracks.push({ name: '获取资源失败或帖子无内容', pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
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
