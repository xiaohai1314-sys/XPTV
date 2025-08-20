/**
 * 网盘资源社 App 插件前端代码 (V21 - 逻辑重构最终版)
 * 
 * 更新日志:
 * - V21: 将经过V20.4浏览器版本最终验证的“逻辑重构”解析方案，完整移植到 getTracks 函数中。
 *   - 【核心升级】: 采用“链接优先，向后查找”原则，彻底取代了旧的、有问题的状态机和密码广播机制。
 *   - 【精准定位】: 对每个链接，只检查其后紧邻的文本是否有提取码，从根本上杜绝了密码错配和误伤。
 *   - 【自带密码优先】: 优先识别并使用链接URL中自带的密码，如果存在，则不再向后查找。
 *   - 【环境适配】: 所有逻辑均使用 Cheerio API 实现，确保在App插件环境中稳定运行。
 *   - 【兼容性】: 新逻辑能够正确处理所有已知情况，包括链接自带密码、链接后跟密码、以及之前导致问题的复杂布局。
 */

const SITE_URL = 'https://www.wpzysq.com';
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%7D; __mxav__c1-WWwEoLo0=137';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
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
    if (vod_pic && !vod_pic.startsWith('http'  )) {
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

// ★★★★★【V21 核心修改区域：getTracks 函数】★★★★★
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
  
  log("页面内容已完全显示，开始使用V21重构引擎进行解析...");

  // 1. 直接查找主楼层中所有可能的链接
  const allLinks = mainMessage.find('a');

  allLinks.each((_, linkNode) => {
      const link = $(linkNode);
      const href = link.attr('href');

      // 2. 检查是否是支持的网盘链接
      if (!href || !supportedHosts.some(host => href.includes(host))) {
          return; // continue
      }

      let accessCode = '';
      let pureLink = href;

      // 3. 【自带密码优先】检查链接本身是否已包含密码
      const pwdMatch = href.match(/[?&](?:pwd|password)=([a-zA-Z0-9]+)/);
      if (pwdMatch && pwdMatch[1]) {
          accessCode = pwdMatch[1];
          pureLink = href.substring(0, pwdMatch.index);
          log(`在链接 ${href} 中直接找到自带密码: ${accessCode}`);
      } else {
          // 4. 【向后查找】如果链接不带密码，则检查紧跟其后的文本节点
          // Cheerio中，使用 .get(0).nextSibling 模拟原生DOM操作
          let nextNode = link.get(0)?.nextSibling;
          // 容忍中间有空格等空文本节点
          while (nextNode && nextNode.type === 'text' && nextNode.data.trim() === '') {
              nextNode = nextNode.nextSibling;
          }

          if (nextNode && nextNode.type === 'text') {
              const text = nextNode.data;
              const passMatch = text.match(/(?:提取码|访问码|取码)\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
              if (passMatch && passMatch[1]) {
                  accessCode = passMatch[1].trim();
                  log(`在链接 ${href} 后面的文本中找到密码: ${accessCode}`);
              }
          }
      }

      // 5. 组合最终结果
      let fileName = link.text().trim() || (href.includes('quark.cn') ? '夸克' : (href.includes('baidu.com') ? '百度' : '阿里'));
      let finalPan = pureLink;

      if (accessCode) {
          if (pureLink.includes('baidu.com')) {
              // 百度盘链接特殊处理，不直接拼接，App侧可能会有专门处理
              finalPan = `${pureLink} 提取码: ${accessCode}`;
          } else {
              const separator = pureLink.includes('?') ? '&' : '?';
              finalPan = `${pureLink}${separator}pwd=${accessCode}`;
          }
      }
      
      // 6. 避免重复添加
      if (!tracks.some(t => t.pan.startsWith(pureLink))) {
           tracks.push({
              name: fileName,
              pan: finalPan,
              ext: { pwd: accessCode }, // 将提取码也存入ext中备用
          });
      }
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
