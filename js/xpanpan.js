/**
 * 网盘资源社 App 插件前端代码 (V17 - V16核心 + 搜索缓存)
 * 
 * 更新日志:
 * - 【功能新增】完美移植了“海绵小站”脚本中的高级搜索缓存机制，现在支持：
 *     - 首次搜索后缓存结果。
 *     - 切换关键词时自动清空旧缓存。
 *     - 翻页时优先从缓存读取，无缓存才发起网络请求，大幅提升响应速度。
 * - 【核心保留】完整保留了V16版本中已验证成功的“智能关联”核心逻辑和“双引擎混合”模式。
 * - 【最终成品】此版本是功能完整、性能优化、兼容性强的最终稳定版。
 */

const SITE_URL = 'https://suenen.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const cheerio = createCheerio();

// ★★★★★【用户配置区 - Cookie】 ★★★★★
const SITE_COOKIE = 'bbs_sid=1cvn39gt7ugf3no79ogg4sk23l; __mxau__c1-WWwEoLo0=346c6d46-f399-45ec-9baa-f5fb49993628; __mxaf__c1-WWwEoLo0=1755651025; bbs_token=_2Bx_2FkB37QoYyoNPq1UaPKrmTEvSAzXebM69i3tStWSJFy_2BTHJcOB1f_2BuEnWKCCaqMcKRpiNIrNJzSRIZgwjK5Hy66L6KdwISn; __gads=ID=b626aa5c3829b3c8:T=1755651026:RT=1755666709:S=ALNI_MZ2XWqkyxPJ8_cLmbBB6-ExZiEQIw; __gpi=UID=00001183137b1fbe:T=1755651026:RT=1755666709:S=ALNI_MYxZPV4xrqfcorWe9NP-1acSgdVnQ; __eoi=ID=f327d82c8f60f483:T=1755651026:RT=1755666709:S=AA-AfjaDRYmOnqGusZr0W-dwTyNg; __mxas__c1-WWwEoLo0=%7B%22sid%22%3A%221b885068-7d37-4cf0-b47c-3159ebe91e47%22%2C%22vd%22%3A26%2C%22stt%22%3A3182%2C%22dr%22%3A14%2C%22expires%22%3A1755668524%2C%22ct%22%3A1755666724%7D; __mxav__c1-WWwEoLo0=137';
// ★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 核心辅助函数 ---
function log(msg) {
  try { $log(`[网盘资源社插件 V17] ${msg}`); } 
  catch (_) { console.log(`[网盘资源社插件 V17] ${msg}`); }
}
function argsify(ext) {
    if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } }
    return ext || {};
}
function jsonify(data) { return JSON.stringify(data); }

// --- 网络请求与回帖 (原封不动) ---
async function performReply(threadId) {
    log(`正在尝试为帖子 ${threadId} 自动回帖...`);
    const replyUrl = `${SITE_URL}/post-create-${threadId}-1.htm`;
    const message = "感谢分享"; 
    const formData = `doctype=1&return_html=1&quotepid=0&message=${encodeURIComponent(message)}&quick_reply_message=0`;
    try {
        const { data } = await $fetch.post(replyUrl, formData, {
            headers: {
                'accept': 'text/plain, */*; q=0.01', 'accept-language': 'zh-CN,zh;q=0.9',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'cookie': SITE_COOKIE,
                'origin': SITE_URL, 'referer': `${SITE_URL}/thread-${threadId}.htm`,
                'user-agent': UA, 'x-requested-with': 'XMLHttpRequest'
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

// --- 列表与详情解析 (原封不动) ---
function parseListHtml(html) {
  const $ = cheerio.load(html);
  const cards = [];
  $('.media.thread').each((_, el) => {
    const subjectAnchor = $(el).find('.style3_subject a');
    if (!subjectAnchor.length) return;
    const vod_id = subjectAnchor.attr('href');
    let vod_pic = $(el).find('a > img.avatar-3')?.attr('src') || '';
    if (vod_pic && !vod_pic.startsWith('http'  )) vod_pic = `${SITE_URL}/${vod_pic}`;
    cards.push({
      vod_id: vod_id, vod_name: subjectAnchor.text().trim(), vod_pic: vod_pic,
      vod_remarks: $(el).find('.date')?.text().trim() || '', ext: { url: vod_id },
    });
  });
  return cards;
}

async function getConfig() {
  return jsonify({
    ver: 1, title: '网盘资源社(终极版)', site: SITE_URL, cookie: SITE_COOKIE,
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } }, { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } }, { name: '教程/书籍', ext: { id: 'forum-8.htm' } }
    ],
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  let url = `${SITE_URL}/${id}`;
  if (parseInt(page) > 1) url = url.replace('.htm', `-${page}.htm`);
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
          return jsonify({ list: [{ title: '提示', tracks: [{ name: "正在回帖，请稍后刷新页面", pan: '', ext: {} }] }] });
      }
  }
  const $ = cheerio.load(html);
  const mainMessage = $(".message[isfirst='1']");
  const tracks = [];
  if (mainMessage.length) {
    log("页面内容已完全显示，开始使用【标准方案：V16智能关联引擎】解析...");
    const standardResultsMap = new Map();
    const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com', 'baidu.com'];
    const contentElements = mainMessage.children();
    let lastTitle = '';
    contentElements.each((_, element) => {
        const el = $(element);
        const text = el.text().trim();
        if (text === '夸克' || text === '阿里' || text === '百度') { lastTitle = text; return; }
        const childNodes = el.contents();
        let lastLinkNode = null;
        childNodes.each((_, node) => {
            const nodeType = node.type, nodeName = node.name, nodeText = $(node).text(), href = $(node).attr('href');
            if (nodeType === 'tag' && nodeName === 'a' && href && supportedHosts.some(host => href.includes(host))) {
                lastLinkNode = $(node);
                if (href.includes('pwd=')) {
                    const linkBase = href.split('?')[0];
                    if (!standardResultsMap.has(linkBase)) standardResultsMap.set(linkBase, { pureLink: href, accessCode: null, fileName: '百度/其他网盘' });
                } else {
                    if (!standardResultsMap.has(href)) {
                        let fileName = lastTitle || (href.includes('quark.cn') ? '夸克' : '阿里');
                        standardResultsMap.set(href, { pureLink: href, accessCode: '', fileName });
                    }
                }
            } else if (nodeType === 'text' && nodeText.includes('提取码') && lastLinkNode && !lastLinkNode.attr('href').includes('pwd=')) {
                const passMatch = nodeText.match(/提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
                if (passMatch && passMatch[1]) {
                    const accessCode = passMatch[1].trim();
                    const existingRecord = standardResultsMap.get(lastLinkNode.attr('href'));
                    if (existingRecord) { existingRecord.accessCode = accessCode; log(`成功为 ${lastLinkNode.attr('href')} 关联到提取码: ${accessCode}`); }
                    lastLinkNode = null;
                }
            }
        });
        if (el.find('a').length > 0) lastTitle = '';
    });
    standardResultsMap.forEach(record => {
        let finalPan = record.pureLink;
        if (record.accessCode) finalPan += (finalPan.includes('?') ? '&' : '?') + `pwd=${record.accessCode}`;
        tracks.push({ name: record.fileName, pan: finalPan, ext: {} });
    });
    if (tracks.length === 0) {
        log("🟡 标准方案未能提取到资源，自动启动【备用方案：文本正则引擎】...");
        const mainText = mainMessage.text();
        const linkAndCodeRegex = /(https?:\/\/(?:pan\.quark\.cn|aliyundrive\.com )\/s\/[a-zA-Z0-9]+)[\s\S]*?提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/gi;
        let match;
        while ((match = linkAndCodeRegex.exec(mainText)) !== null) {
            const pureLink = match[1], accessCode = match[2];
            if (pureLink && accessCode) {
                const finalPan = `${pureLink}?pwd=${accessCode}`;
                if (!tracks.some(r => r.pan.startsWith(pureLink))) tracks.push({ name: "夸克/阿里网盘", pan: finalPan, ext: {}, "来源": "备用方案A" });
            }
        }
        mainMessage.find('a').each((_, a) => {
            const link = $(a).attr('href');
            if (link && link.includes('pwd=')) {
                const linkBase = link.split('?')[0];
                if (!tracks.some(r => r.pan.startsWith(linkBase))) tracks.push({ name: "百度/其他网盘", pan: link, ext: {}, "来源": "备用方案B" });
            }
        });
    }
  }
  if (tracks.length === 0) {
    let message = '获取资源失败或帖子无内容';
    if (isContentHidden) message = '自动回帖后请刷新查看资源';
    tracks.push({ name: message, pan: '', ext: {} });
  }
  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

// =================================================================================
// ====================【新增区域：带缓存的搜索功能】================================
// =================================================================================

// 定义一个全局的缓存对象
const searchCache = {};

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  const page = ext.page || 1;

  if (!text) return jsonify({ list: [] });

  // 1. 切换关键词时，清空旧缓存
  if (searchCache.keyword !== text) {
    log(`新关键词 "${text}"，清空旧缓存。`);
    searchCache.keyword = text;
    searchCache.resultsByPage = {}; // 使用对象存储每一页的结果
    searchCache.pageCount = 0; // 总页数
  }

  // 2. 如果请求的页码已在缓存中，直接返回
  if (searchCache.resultsByPage[page]) {
    log(`从缓存中获取搜索结果，关键词: "${text}", 页码: ${page}`);
    return jsonify({ list: searchCache.resultsByPage[page], pagecount: searchCache.pageCount });
  }

  // 3. 如果请求页码超出已知总页数，直接返回空
  if (searchCache.pageCount > 0 && page > searchCache.pageCount) {
    log(`请求页码 ${page} 超出总页数 ${searchCache.pageCount}，返回空列表。`);
    return jsonify({ list: [], pagecount: searchCache.pageCount });
  }

  // 4. 发起网络请求
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
  log(`缓存未命中，开始网络搜索，关键词: "${text}", 页码: ${page}`);

  try {
    const { data: html } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
    const cards = parseListHtml(html);

    // 5. 提取总页数（仅在第一页时执行一次，提高效率）
    if (page === 1) {
        const $ = cheerio.load(html);
        const lastPageLink = $('ul.pagination li.page-item:last-child a.page-link').attr('href');
        if (lastPageLink) {
            const pageMatch = lastPageLink.match(/page=(\d+)/);
            searchCache.pageCount = pageMatch ? parseInt(pageMatch[1]) : 1;
        } else {
            searchCache.pageCount = cards.length > 0 ? 1 : 0;
        }
        log(`总页数已更新为: ${searchCache.pageCount}`);
    }

    // 6. 更新缓存
    searchCache.resultsByPage[page] = cards;
    log(`搜索完成，关键词: "${text}", 页码: ${page}, 找到 ${cards.length} 条结果。`);
    
    return jsonify({ list: cards, pagecount: searchCache.pageCount });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 兼容旧版接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg, filter, ext) { const id = ext.id || tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id, flags) { return jsonify({ url: id }); }
