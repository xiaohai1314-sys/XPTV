/**
 * 网盘资源社 App 插件前端代码 (V21 - 稳定解析修复版)
 * * 修复日志:
 * - 重写 getTracks 函数核心解析逻辑，彻底解决提取码与链接错误关联的问题。
 * - 新逻辑不再使用不稳定的“记忆最后链接”状态，而是采用更可靠的“链接中心”解析模式。
 * - 对每个有效链接，脚本会精确查找其后紧邻的文本节点，从中提取配对的提取码。
 * - 提升了对复杂或不规范HTML布局的兼容性。
 */

const SITE_URL = 'https://www.wpzysq.com';
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%7D; __mxav__c1-WWwEoLo0=137';
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

// ====================================================================
// =================== 【核心逻辑修复区】 ==============================
// ====================================================================
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
          // 先执行回帖（后台），但立即返回提示，避免空白
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

  if (mainMessage.length) {
    log("页面内容已完全显示，开始使用 V21 稳定引擎解析...");
    const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
    const finalResultsMap = new Map();

    // 核心改进：直接查找所有符合条件的 a 标签，然后处理每个链接的上下文
    mainMessage.find('a').each((_, element) => {
        const link = $(element);
        const href = link.attr('href');

        // 1. 验证是否是目标链接
        if (!href || !supportedHosts.some(host => href.includes(host))) {
            return; // continue
        }

        // 如果链接已处理，则跳过，避免重复
        if (finalResultsMap.has(href)) {
            return; // continue
        }

        let accessCode = '';
        let fileName = link.text().trim(); // 默认使用链接文本作为文件名

        // 2. 查找提取码：检查链接节点之后紧邻的文本节点
        // Cheerio/JQuery 中没有直接的 nextSibling，但可以通过 .get(0).next 获取原生节点
        const nativeElement = link.get(0);
        if (nativeElement && nativeElement.next && nativeElement.next.type === 'text') {
            const nextNodeText = nativeElement.next.data || '';
            const passMatch = nextNodeText.match(/提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
            if (passMatch && passMatch[1]) {
                accessCode = passMatch[1].trim();
                log(`成功关联提取码: ${href} -> ${accessCode}`);
            }
        }
        
        // 3. 优化文件名：如果链接文本为空，尝试使用上下文标题（如 "夸克", "阿里"）
        if (!fileName) {
            const parentText = link.parent().text().trim();
            if (parentText.startsWith('夸克')) fileName = '夸克';
            else if (parentText.startsWith('阿里')) fileName = '阿里';
            else fileName = href.includes('quark.cn') ? '夸克' : '阿里'; // 最后备选方案
        }

        // 4. 存入最终结果
        finalResultsMap.set(href, { pureLink: href, accessCode: accessCode, fileName });
    });


    finalResultsMap.forEach(record => {
        let finalPan = record.pureLink;
        if (record.accessCode) {
            // 确保正确拼接pwd参数
            const urlObject = new URL(finalPan);
            urlObject.searchParams.set('pwd', record.accessCode);
            finalPan = urlObject.toString();
        }
        tracks.push({
          name: record.fileName,
          pan: finalPan,
          ext: { pwd: record.accessCode }, // ext 中也保存一份
        });
    });
  }

  if (tracks.length === 0) {
    let message = '获取资源失败或帖子无内容';
    if (isContentHidden) message = '自动回帖后请刷新查看资源';
    tracks.push({ name: message, pan: '', ext: {} });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}
// ====================================================================
// =================== 【核心逻辑修复区结束】 ==========================
// ====================================================================

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
