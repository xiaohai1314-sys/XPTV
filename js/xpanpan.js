/**
 * XPTV App 插件前端代码 (V14 - 节点遍历·终极版)
 * 
 * 功能:
 * - 无需后端，一个脚本搞定所有。
 * - 核心: 集成了V14版本的“遍历子节点 + 状态机关联”终极解析引擎，取代了旧的解析逻辑。
 * - 认证方式: 采用Cookie认证，需要用户手动填入有效的网站Cookie。
 * - 兼容性: 保持与原框架相同的输出格式，与App完美配合。
 * - 策略: 组合URL+提供豁免符，确保夸克等App能直接打开链接。
 */

// --- 1. 配置区 ---
const SITE_URL = 'https://www.wpzysq.com'; // 目标网站地址
const SITE_COOKIE = 'bbs_sid=pgd4k99mtoaig06hmcaqj0pgd7; bbs_token=rQzcr8KSQutap2CevsLpjkFRxjiRH3fsoOWCDuk5niwFuhpST6C2TgLIcOU7PoMbTOjfr8Rkaje3QMVax3avYA_3D_3D;'; // 【【【请务必替换为你的网站Cookie】】】

// --- 2. 核心工具函数 ---

/**
 * 统一日志函数
 * @param {string} msg 日志内容
 */
function log(msg  ) {
  try {
    $log(`[网盘资源社插件] ${msg}`);
  } catch (_) {
    console.log(`[网盘资源社插件] ${msg}`);
  }
}

/**
 * 封装的fetch请求函数
 * @param {string} url 请求的URL
 * @returns {Promise<string>} 返回HTML文本
 */
async function fetchHtml(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'Cookie': SITE_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
    return await response.text();
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return '<html><body></body></html>';
  }
}

/**
 * 解析列表页HTML，提取卡片数据
 * @param {string} html 列表页的HTML文本
 * @returns {Array<Object>} 卡片对象数组
 */
function parseListHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const cards = [];
  doc.querySelectorAll('.media.thread').forEach(el => {
    const subjectAnchor = el.querySelector('.style3_subject a');
    if (!subjectAnchor) return;

    const vod_id = subjectAnchor.getAttribute('href');
    let vod_pic = el.querySelector('a > img.avatar-3')?.getAttribute('src') || '';
    if (vod_pic && !vod_pic.startsWith('http'  )) {
      vod_pic = `${SITE_URL}/${vod_pic}`;
    }

    cards.push({
      vod_id: vod_id,
      vod_name: subjectAnchor.textContent.trim(),
      vod_pic: vod_pic,
      vod_remarks: el.querySelector('.date')?.textContent.trim() || '',
      ext: { url: vod_id },
    });
  });
  log(`解析到 ${cards.length} 条数据`);
  return cards;
}

// ★★★★★【V14终极解析引擎 - 已移植】★★★★★
/**
 * 解析详情页HTML，提取网盘链接
 * @param {string} html 详情页的HTML文本
 * @returns {string} 格式化的播放链接字符串 "文件名$链接|密码$$$..."
 */
function parseDetailHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const mainMessage = doc.querySelector(".message[isfirst='1']");
  if (!mainMessage) {
    log("❌ 错误：找不到主内容区域 .message[isfirst='1']");
    return "暂无有效网盘链接";
  }

  if (mainMessage.innerText.includes("回复")) {
      log("⚠️ 检测到需要回复才能查看内容。");
      return "需要回复才能查看";
  }

  log("页面内容已完全显示，开始使用V14终极引擎解析...");
  
  const supportedHosts = ['quark.cn', 'aliyundrive.com', 'alipan.com'];
  const finalResultsMap = new Map();
  const contentElements = Array.from(mainMessage.children);
  let lastTitle = '';

  contentElements.forEach(element => {
      const text = element.innerText.trim();
      
      if (text === '夸克' || text === '阿里') {
          lastTitle = text;
          log(`识别到上下文标题: ${lastTitle}`);
          return;
      }

      const childNodes = Array.from(element.childNodes);
      let lastLinkNode = null;

      childNodes.forEach(node => {
          if (node.nodeName === 'A' && supportedHosts.some(host => node.href.includes(host))) {
              lastLinkNode = node;
              if (!finalResultsMap.has(lastLinkNode.href)) {
                  let fileName = lastTitle || (lastLinkNode.href.includes('quark.cn') ? '夸克' : '阿里');
                  finalResultsMap.set(lastLinkNode.href, { pureLink: lastLinkNode.href, accessCode: '', fileName });
                  log(`初步识别链接: 文件名=${fileName}, 链接=${lastLinkNode.href}`);
              }
          }
          else if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('提取码')) {
              const passMatch = node.textContent.match(/提取码\s*[:：]?\s*([a-zA-Z0-9]{4,})/i);
              if (passMatch && passMatch[1] && lastLinkNode) {
                  const accessCode = passMatch[1].trim();
                  const existingRecord = finalResultsMap.get(lastLinkNode.href);
                  if (existingRecord) {
                      existingRecord.accessCode = accessCode;
                      log(`成功关联提取码: 链接=${lastLinkNode.href}, 提取码=${accessCode}`);
                  }
                  lastLinkNode = null;
              }
          }
      });

      if (element.querySelector('a')) {
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
  
  const html = await fetchHtml(url);
  const cards = parseListHtml(html);
  
  return JSON.stringify({ list: cards });
}

async function getTracks(ext) {
  ext = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const { url } = ext;
  if (!url) return JSON.stringify({ list: [] });

  const detailUrl = `${SITE_URL}/${url}`;
  const html = await fetchHtml(detailUrl);
  const playUrlString = parseDetailHtml(html);

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
}

async function search(ext) {
  ext = typeof ext === 'string' ? JSON.parse(ext) : ext;
  const text = ext.text || '';
  if (!text) return JSON.stringify({ list: [] });
  
  const url = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(text)}`;
  const html = await fetchHtml(url);
  const cards = parseListHtml(html);
  
  return JSON.stringify({ list: cards });
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

// --- 辅助函数 (在App环境中通常已提供) ---
// 为了在浏览器中测试，可能需要模拟这些函数
// JSON.stringify, JSON.parse, atob
