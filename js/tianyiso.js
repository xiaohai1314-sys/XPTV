/**
 * 阿里资源搜索前端插件 - V1.0 (纯前端版)
 * 核心特性: 无后端依赖，直接提取阿里云盘直链，本地过滤资源
 */
// --- 配置区 ---
const SITE_URL = "https://stp.ezyro.com/al/"; // 阿里资源搜索地址
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio(); // 若环境不支持cheerio，可替换为原生DOM解析
const FALLBACK_PIC = "https://www.aliyundrive.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;

// --- 辅助函数 ---
function log(msg) { const logMsg = `[阿里资源搜索-纯前端] ${msg}`; if (DEBUG) console.log(logMsg); }
function argsify(ext) { try { return typeof ext === 'string' ? JSON.parse(ext) : ext; } catch (e) { return {}; } }
function jsonify(data) { return JSON.stringify(data); }
// 校验阿里云盘链接
function isAliyunDriveUrl(url) {
  return url.includes('aliyundrive.com/s/') || url.includes('aliyundrive.com/share/');
}

// --- 插件入口 ---
async function getConfig() {
  log("==== 纯前端插件初始化 ====");
  const CATEGORIES = [{ name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } }];
  return jsonify({ ver: 1, title: '阿里资源搜索', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页资源提取 (纯前端DOM解析) ---
async function getCards(ext) {
  ext = argsify(ext);
  const { id: category, page = 1 } = ext;
  try {
    const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
    const $ = cheerio.load(data);
    const cards = [];
    
    // 提取所有阿里云盘资源卡片
    $('div.result-card').each((_, item) => {
      const link = $(item).find('.result-url a').attr('href') || "";
      const title = $(item).find('.result-name').text().trim() || "";
      const time = $(item).find('.result-time').text().trim() || "";
      
      if (isAliyunDriveUrl(link) && title) {
        cards.push({
          vod_id: link,
          vod_name: title,
          vod_pic: FALLBACK_PIC,
          vod_remarks: `[阿里云盘] ${time}`,
          ext: { url: link }
        });
      }
    });
    
    // 分页处理
    const start = (page - 1) * PAGE_SIZE;
    const pageData = cards.slice(start, start + PAGE_SIZE);
    log(`[首页] 分类${category}：共${cards.length}个资源，第${page}页返回${pageData.length}个`);
    return jsonify({ list: pageData });
  } catch (e) {
    log(`[首页] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 搜索功能 (纯前端表单提交) ---
async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  if (!text) return jsonify({ list: [] });
  
  try {
    // 纯前端POST提交搜索（模拟原页面表单）
    const { data } = await $fetch.post(SITE_URL, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: `csrf_token=c850dbe1c635b5791f06c7773af530ca9e707552fc5ecff16230cc51d1ee6b3e&q=${encodeURIComponent(text)}`
    });
    
    const $ = cheerio.load(data);
    const cards = [];
    $('div.result-card').each((_, item) => {
      const link = $(item).find('.result-url a').attr('href') || "";
      const title = $(item).find('.result-name').text().trim() || "";
      const time = $(item).find('.result-time').text().trim() || "";
      
      if (isAliyunDriveUrl(link) && title) {
        cards.push({
          vod_id: link,
          vod_name: title,
          vod_pic: FALLBACK_PIC,
          vod_remarks: `[阿里云盘] ${time}`,
          ext: { url: link }
        });
      }
    });
    
    log(`[搜索] 关键词${text}：共${cards.length}个资源，第${page}页返回${cards.slice(0, PAGE_SIZE).length}个`);
    return jsonify({ list: cards.slice(0, PAGE_SIZE) });
  } catch (e) {
    log(`[搜索] 异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}

// --- 详情页 (直接返回阿里云盘直链) ---
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!isAliyunDriveUrl(url)) {
    return jsonify({ list: [{ title: '无效链接', tracks: [{ name: '请检查链接', pan: '', ext: {} }] }] });
  }
  
  // 纯前端直接返回直链，无需后端解析
  return jsonify({
    list: [{
      title: '阿里云盘资源',
      tracks: [{ name: '阿里云盘', pan: url, ext: {} }]
    }]
  });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const cfg = JSON.parse(await getConfig()); return jsonify({ class: cfg.tabs }); }
async function category(tid, pg) { return getCards({ id: tid, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(_, id) { return jsonify({ url: id }); }

log('==== 纯前端插件加载完成 ====');
