/**
 * 网盘资源社 App 插件前端代码 (V21 - 优化提取码匹配逻辑版)
 *
 * 更新日志:
 * - 重写 getTracks 函数中的资源解析逻辑。
 * - 解决“链接与提取码分离”导致匹配失败的问题。
 * - 新逻辑会记住最近出现的链接，并将其与后面出现的提取码关联。
 * - 增强了对“夸克”、“阿里”等标题的识别，使资源命名更准确。
 * - 增加了对“访问码”、“密码”等关键词的识别，提高兼容性。
 */

const SITE_URL = 'https://www.wpzysq.com';
// 请注意：这里的Cookie是示例，可能需要您自行更新为您自己的有效Cookie
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%27D; __mxav__c1-WWwEoLo0=137';
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

  if (mainMessage.length) {
    log("页面内容已完全显示，开始使用新逻辑解析...");
    const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
    const finalResultsMap = new Map();
    let lastFoundLinkHref = null; // 关键变量：用来存储最近一个找到的链接

    // 遍历主内容区域的所有直接子元素
    mainMessage.children().each((_, element) => {
        const el = $(element);

        // 在每个子元素内部，遍历所有节点（包括文本节点和元素节点）
        el.contents().each((_, node) => {
            const $node = $(node);
            const nodeType = node.type;

            // --- 步骤1: 查找链接 ---
            if (nodeType === 'tag' && node.name === 'a') {
                const href = $node.attr('href');
                if (href && supportedHosts.some(host => href.includes(host))) {
                    if (!finalResultsMap.has(href)) {
                        let fileName = $node.text().trim();
                        if (!fileName) {
                           fileName = href.includes('quark.cn') ? '夸克' : '阿里';
                        }
                        finalResultsMap.set(href, { pureLink: href, accessCode: '', fileName });
                        log(`发现链接: ${href}`);
                    }
                    // 无论链接是否已存在，都更新“最后一个链接”为当前链接
                    lastFoundLinkHref = href;
                }
            } 
            // --- 步骤2: 查找提取码 ---
            else if (nodeType === 'text') {
                const nodeText = $node.text();
                // 使用更宽泛的正则匹配“提取码”、“访问码”、“密码”等
                const passMatch = nodeText.match(/(?:提取码|访问码|密码)\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
                if (passMatch && passMatch[1]) {
                    const accessCode = passMatch[1].trim();
                    // 如果在找到提取码之前，我们已经找到了一个链接
                    if (lastFoundLinkHref) {
                        const record = finalResultsMap.get(lastFoundLinkHref);
                        // 确保该链接还没有配对过提取码
                        if (record && !record.accessCode) {
                            log(`为链接 ${lastFoundLinkHref} 找到提取码: ${accessCode}`);
                            record.accessCode = accessCode;
                            // 成功配对后，立即重置。这可以防止一个提取码被错误地应用到多个后续链接
                            lastFoundLinkHref = null; 
                        }
                    }
                }
            }
        });
    });

    // --- 步骤3: 优化资源名称 ---
    // 再次遍历，检查"夸克"或"阿里"这类标题行，以获得更准确的资源名
    mainMessage.children().each((_, element) => {
        const el = $(element);
        const text = el.text().trim();
        const links = el.find('a');

        // 如果一个元素内只有1个链接，并且文本以“夸克”或“阿里”开头
        if (links.length === 1 && (text.startsWith('夸克') || text.startsWith('阿里'))) {
             const href = links.first().attr('href');
             if(finalResultsMap.has(href)) {
                 const record = finalResultsMap.get(href);
                 // 如果文件名还是默认的，就用更准确的标题更新它
                 if (record.fileName === '夸克' || record.fileName === '阿里') {
                    record.fileName = text.split('\n')[0].trim() || record.fileName; // 取第一行作为标题
                    log(`更新链接 ${href} 的名称为: ${record.fileName}`);
                 }
             }
        }
    });

    // --- 步骤4: 整理最终结果 ---
    finalResultsMap.forEach(record => {
        let finalPan = record.pureLink;
        if (record.accessCode) {
            // 自动拼接提取码到链接后面
            const separator = finalPan.includes('?') ? '&' : '#'; // 使用#更通用
            finalPan = `${finalPan}${separator}pwd=${record.accessCode}`;
        }
        tracks.push({
          name: record.fileName,
          pan: finalPan,
          ext: { pwd: record.accessCode }, // ext里也存一份
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
