/**
 * 网盘资源社 App 插件前端代码 (V24 - 最终健壮版)
 * 
 * 更新日志:
 * - V23: 旨在解决所有已知复杂情况，包括链接与提取码不在同一行的问题，同时确保链接组合的正确性。
 *   - 【核心升级】: 引入“跨行状态”管理，能够处理链接和提取码不在同一HTML元素（如换行）的情况。
 *   - 【链接优先】: 优先识别链接，并将其暂存到“待匹配密码列表”，等待后续的提取码匹配。
 *   - 【智能匹配】: 当在后续元素中发现提取码时，会尝试与“待匹配密码列表”中的最后一个链接进行匹配。
 *   - 【精确组合】: 确保所有网盘链接（包括夸克、阿里、百度）的最终组合格式正确，特别是百度网盘的特殊处理。
 *   - 【全面健壮】: 兼容所有之前版本能处理的场景，并解决了提取码换行、多链接单密码等复杂情况。
 */

const SITE_URL = 'https://www.wpzysq.vip';
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%22%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%7D; __mxav__c1-WWwEoLo0=137';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const cheerio = createCheerio();

function log(msg) {
  try { $log(`[网盘资源社插件] ${msg}`); } 
  catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}
function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}
function jsonify(data) { return JSON.stringify(data); }

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

// ★★★★★【V23 核心修改区域：getTracks 函数 - 最终健壮版】★★★★★
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  let { data: html } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
  
  const isContentHidden = html.includes("回复") && (html.includes("再查看") || html.includes("后可见"));
  if (isContentHidden) {
      log("检测到回复可见，提示用户刷新...");
      const threadIdMatch = url.match(/thread-(\d+)/);
      if (threadIdMatch && threadIdMatch[1]) {
          performReply(threadIdMatch[1]);
          return jsonify({
              list: [{
                  title: '提示',
                  tracks: [{ name: "正在回帖，请稍后刷新页面", pan: '', ext: {} }]
              }]
          });
      }
  }

  const $ = cheerio.load(html);
  const mainMessage = $(".message[isfirst='1']");
  const tracks = [];
  const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com', 'pan.baidu.com'];
  
  log("页面内容已完全显示，开始使用V23最终健壮引擎进行解析...");

  const finalResultsMap = new Map(); // 使用Map来存储和去重最终结果
  let lastTitle = ''; // 用于上下文命名

  // ★ V23 核心：用于跨行匹配的“待匹配密码的链接列表”
  // 存储的是 { href, fileName }，等待后续的提取码
  let pendingLinksForPassword = []; 

  // 遍历主消息内容的所有直接子元素（通常是 <p>, <div>, <span> 等）
  mainMessage.children().each((_, element) => {
      const el = $(element);
      const currentElementText = el.text().trim();

      // 1. 检查当前元素是否是上下文标题（如“夸克”、“阿里”）
      if (currentElementText === '夸克' || currentElementText === '阿里' || currentElementText === '百度') {
          lastTitle = currentElementText;
          pendingLinksForPassword = []; // 遇到新标题，清空待匹配列表
          return;
      }

      // 2. 在当前元素内部查找所有链接
      const linksInCurrentElement = [];
      el.find('a').each((_idx, linkNode) => {
          const link = $(linkNode);
          const href = link.attr('href');

          if (!href || !supportedHosts.some(host => href.includes(host))) {
              return;
          }

          // 如果这个链接已经处理过，跳过
          if (finalResultsMap.has(href)) {
              return;
          }

          let accessCode = '';
          let pureLink = href;

          // 2.1. 优先从链接URL中提取密码
          const pwdMatchInHref = href.match(/[?&](?:pwd|password)=([a-zA-Z0-9]+)/);
          if (pwdMatchInHref && pwdMatchInHref[1]) {
              accessCode = pwdMatchInHref[1];
              pureLink = href.substring(0, pwdMatchInHref.index); // 得到纯净链接
              log(`[V23] 链接自带密码: ${href} -> ${accessCode}`);
          } else {
              // 2.2. 如果链接不带密码，检查紧邻的下一个文本节点
              let nextNode = linkNode.nextSibling;
              while (nextNode && nextNode.type === 'text' && nextNode.data.trim() === '') {
                  nextNode = nextNode.nextSibling;
              }
              if (nextNode && nextNode.type === 'text') {
                  const passMatch = nextNode.data.match(/(?:提取码|访问码|取码)\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
                  if (passMatch && passMatch[1]) {
                      accessCode = passMatch[1].trim();
                      log(`[V23] 链接后紧跟密码: ${href} -> ${accessCode}`);
                  }
              }
          }
          
          let fileName = link.text().trim() || lastTitle || (href.includes('quark.cn') ? '夸克' : (href.includes('baidu.com') ? '百度' : '阿里'));
          
          // 将当前处理的链接加入结果Map
          finalResultsMap.set(href, { pureLink, accessCode, fileName });
          // 如果这个链接还没有密码，加入待匹配列表
          if (!accessCode) {
              pendingLinksForPassword.push({ href, fileName });
          }
          linksInCurrentElement.push(href); // 记录当前元素中发现的链接
      });

      // 3. 在当前元素内部查找提取码文本
      const passMatchInElement = currentElementText.match(/(?:提取码|访问码|取码)\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
      if (passMatchInElement && passMatchInElement[1]) {
          const foundAccessCode = passMatchInElement[1].trim();
          log(`[V23] 在当前元素中找到提取码: ${foundAccessCode}`);

          // 3.1. 如果当前元素中发现了链接，将密码赋给这些链接中尚未有密码的
          if (linksInCurrentElement.length > 0) {
              linksInCurrentElement.forEach(href => {
                  const record = finalResultsMap.get(href);
                  if (record && !record.accessCode) {
                      record.accessCode = foundAccessCode;
                      log(`[V23] 匹配当前元素内链接: ${record.fileName} -> ${foundAccessCode}`);
                  }
              });
              pendingLinksForPassword = []; // 当前元素内有链接和密码，清空待匹配列表
          } 
          // 3.2. 如果当前元素没有链接，但有提取码，尝试匹配“待匹配密码的链接列表”中的最后一个
          else if (pendingLinksForPassword.length > 0) {
              const lastPendingLink = pendingLinksForPassword.pop(); // 取出最后一个待匹配链接
              const record = finalResultsMap.get(lastPendingLink.href);
              if (record && !record.accessCode) {
                  record.accessCode = foundAccessCode;
                  log(`[V23] 跨行匹配待匹配链接: ${record.fileName} -> ${foundAccessCode}`);
              }
              // 匹配成功后，清空待匹配列表，防止一个密码匹配多个跨行链接
              pendingLinksForPassword = []; 
          }
      }

      // 如果当前元素包含链接，重置上下文标题
      if (linksInCurrentElement.length > 0) {
          lastTitle = '';
      }
  });

  // 将Map中的最终结果转换为App插件所需的格式
  finalResultsMap.forEach(record => {
      let finalPan = record.pureLink;
      if (record.accessCode) {
          if (record.pureLink.includes('baidu.com')) {
              // 百度盘链接特殊处理，App端可能需要识别“提取码:”这个文本
              finalPan = `${record.pureLink} 提取码: ${record.accessCode}`;
          } else {
              const separator = finalPan.includes('?') ? '&' : '?';
              finalPan = `${finalPan}${separator}pwd=${record.accessCode}`;
          }
      }
      tracks.push({
        name: record.fileName,
        pan: finalPan,
        ext: { pwd: record.accessCode || '' }, // 确保ext.pwd始终存在
      });
  });

  if (tracks.length === 0) {
    let message = '获取资源失败或帖子无内容';
    if (isContentHidden) message = '自动回帖后请刷新查看资源';
    tracks.push({ name: message, pan: '', ext: {} });
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


