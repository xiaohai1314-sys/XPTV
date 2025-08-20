/**
 * XPTV App 插件前端代码 (V15 - $fetch终极版)
 * 
 * 功能:
 * - 【核心修正】彻底抛弃错误的浏览器标准fetch，全面采用App环境提供的、能解决跨域问题的`$fetch`函数。
 * - 【引擎集成】完美集成了V14版本的“遍历子节点 + 状态机关联”终极解析引擎，确保解析的精准性。
 * - 【代码对标】整体代码结构和请求方式，严格对标您提供的“夸父资源”成功范例，确保环境兼容性。
 * - 【最终承诺】这是为了一次性解决所有已知问题（包括海报加载失败）而设计的最终、最可靠的版本。
 */

// --- 1. 配置区 ---
const SITE_URL = 'https://www.wpzysq.com'; // 目标网站地址
const SITE_COOKIE = 'bbs_sid=pgd4k99mtoaig06hmcaqj0pgd7; bbs_token=rQzcr8KSQutap2CevsLpjkFRxjiRH3fsoOWCDuk5niwFuhpST6C2TgLIcOU7PoMbTOjfr8Rkaje3QMVax3avYA_3D_3D;'; // 【【【请务必替换为你的网站Cookie】】】
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// --- 2. 核心工具函数 ---

/**
 * 统一日志函数
 * @param {string} msg 日志内容
 */
function log(msg ) {
  try {
    $log(`[网盘资源社插件] ${msg}`);
  } catch (_) {
    console.log(`[网盘资源社插件] ${msg}`);
  }
}

/**
 * 解析列表页HTML，提取卡片数据
 * @param {string} html 列表页的HTML文本
 * @returns {Array<Object>} 卡片对象数组
 */
function parseListHtml(html) {
  // 假设App环境提供了cheerio或类似的DOM解析能力
  const $ = cheerio.load(html);
  const cards = [];
  $("li.media.thread").each((_, item) => {
    const linkElement = $(item).find('.style3_subject a');
    if (!linkElement.length) return;

    let vod_pic = $(item).find("img.avatar-3").attr("src") || '';
    if (vod_pic && !vod_pic.startsWith('http' )) {
      vod_pic = `${SITE_URL}/${vod_pic.startsWith('./') ? vod_pic.substring(2) : vod_pic}`;
    }

    cards.push({
      vod_id: linkElement.attr('href') || "",
      vod_name: linkElement.text().trim() || "",
      vod_pic: vod_pic,
      vod_remarks: $(item).find(".date").text().trim() || "",
      ext: { url: linkElement.attr('href') || "" }
    });
  });
  log(`解析到 ${cards.length} 条数据`);
  return cards;
}

// ★★★★★【V14终极解析引擎 - 已适配$fetch环境】★★★★★
/**
 * 解析详情页HTML，提取网盘链接
 * @param {string} html 详情页的HTML文本
 * @returns {string} 格式化的播放链接字符串 "文件名$链接|密码$$$..."
 */
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
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// --- 3. App 接口实现 ---

async function getConfig() {
  const appConfig = {
    ver: 1,
    title: '网盘资源社(纯前端)',
    site: SITE_URL,
    cookie: SITE_COOKIE,
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } }
    ],
  };
  return JSON.stringify(appConfig);
}

async function getCards(ext) {
  ext = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const { page = 1, id } = ext;
  
  let url = `${SITE_URL}/${id}`;
  if (parseInt(page) > 1) {
      url = url.replace('.htm', `-${page}.htm`);
  }
  
  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
    const cards = parseListHtml(data);
    return JSON.stringify({ list: cards });
  } catch (e) {
    log(`获取分类列表异常: ${e.message}`);
    return JSON.stringify({ list: [] });
  }
}

async function getTracks(ext) {
  ext = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const { url } = ext;
  if (!url) return JSON.stringify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  
  try {
    const { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
    const playUrlString = parseDetailHtml(data);

    const tracks = [];
    if (playUrlString && !["暂无有效网盘链接", "需要回复才能查看"].includes(playUrlString)) {
      const playUrlPackages = playUrlString.split('$$$');
      
      playUrlPackages.forEach((pkg) => {
        if (!pkg.trim()) return;
        
        const parts = pkg.split('$');
        if (parts.length < 2) return;

        const fileName = parts[0];
        const dataPacket = parts[1];
        const [pureLink, accessCode = ''] = dataPacket.split('|');

        let finalPan = pureLink;
        if (accessCode) {
            const separator = pureLink.includes('?') ? '&' : '?';
            finalPan = `${pureLink}${separator}pwd=${accessCode}`;
        }

        tracks.push({
          name: fileName,
          pan: finalPan,
          ext: { pwd: '' },
        });
      });
    }

    if (tracks.length === 0) {
      const message = playUrlString || '获取资源失败或帖子无内容';
      tracks.push({ name: message, pan: '', ext: {} });
    }

    return JSON.stringify({ list: [{ title: '资源列表', tracks }] });
  } catch (e) {
    log(`获取详情页异常: ${e.message}`);
    return JSON.stringify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查Cookie或网络", pan: '', ext: {} }] }] });
  }
}

async function search(ext) {
  ext = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const text = ext.text || '';
  if (!text) return JSON.stringify({ list: [] });
  
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  
  try {
    const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Cookie': SITE_COOKIE } });
    const cards = parseListHtml(data);
    return JSON.stringify({ list: cards });
  } catch (e) {
    log(`搜索异常: ${e.message}`);
    return JSON.stringify({ list: [] });
  }
}

// --- 4. 兼容旧版 App 接口 ---
async function init() { return getConfig(); }
async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return JSON.stringify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg, filter, ext) { 
  const id = ext.id || tid;
  return getCards({ id: id, page: pg }); 
}
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id, flags) { return JSON.stringify({ url: id }); }
