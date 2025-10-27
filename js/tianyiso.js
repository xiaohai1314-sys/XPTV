/**
 * 阿里资源搜索前端插件 - V1.1 (纯前端版) - 改进版
 * 改动点：
 *  - search()：自动检测 <form> 的 action、method、输入 name；支持 GET/POST；
 *  - 在没有 form 时尝试几个常见搜索端点（search.php, index.php?s=, ?q= 等）；
 *  - 更强的日志和容错（token 可选），以及分页参数传递；
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
  return typeof url === 'string' && (url.includes('aliyundrive.com/s/') || url.includes('aliyundrive.com/share/') || url.includes('pan.aliyun.com/'));
}
function joinUrl(base, path) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  // remove trailing slash from base, leading from path
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
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
    
    // 提取所有阿里云盘资源卡片 - 兼容几种常见结构
    const candidates = $('div.result-card, .result-card, li.result, .search-item');
    candidates.each((_, item) => {
      const el = $(item);
      let link = el.find('.result-url a').attr('href') || el.find('a').attr('href') || "";
      const title = el.find('.result-name').text().trim() || el.find('.title').text().trim() || el.find('a').text().trim() || "";
      const time = el.find('.result-time').text().trim() || el.find('.meta').text().trim() || "";

      // 有些站点提供相对链接或直接显示短链接，需要 join
      if (link && !/^https?:\/\//i.test(link)) {
        link = joinUrl(SITE_URL, link);
      }

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
    log(`[首页] 异常: ${e && e.message ? e.message : e}`);
    return jsonify({ list: [] });
  }
}

// --- 搜索功能 (增强检测与多路径兼容) ---
async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  if (!text) return jsonify({ list: [] });

  try {
    // 1) GET 首页，尝试提取 form 行为、输入名和 token
    const { data: homeData } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA, 'Referer': SITE_URL } });
    const $$ = cheerio.load(homeData);

    // 尝试寻找首个带有搜索相关输入的 form
    let form = null;
    $$('form').each((i, f) => {
      const $f = $$(f);
      // heuristics: 包含 text 或 search 类型 input 的 form
      const hasTextInput = $f.find('input[type="text"], input[type="search"], input[name*="q"], input[name*="kw"], input[name*="keyword"]').length > 0;
      if (hasTextInput && !form) form = $f;
    });

    // fallback: 取页面第一个 form
    if (!form) {
      const firstForm = $$('form').first();
      if (firstForm && firstForm.length) form = firstForm;
    }

    // 提取 info
    let formAction = form && form.attr ? form.attr('action') : null;
    let formMethod = form && form.attr ? (form.attr('method') || 'GET') : 'GET';
    // 尝试找到搜索输入 name
    let inputName = null;
    if (form) {
      const textInput = form.find('input[type="text"], input[type="search"], input[name*="q"], input[name*="kw"], input[name*="keyword"]').first();
      if (textInput && textInput.length) inputName = textInput.attr('name');
    }
    // 常见默认名
    if (!inputName) inputName = 'q';

    // csrf token detection (可选)
    const dynamicToken = $$('input[name="csrf_token"], input[name*="token"], input[name="_token"]').attr('value') || '';

    // 构造可能的 searchUrl 列表（按优先级）
    const possibleUrls = [];
    if (formAction) {
      const act = formAction.trim();
      if (/^https?:\/\//i.test(act)) possibleUrls.push(act);
      else possibleUrls.push(joinUrl(SITE_URL, act));
    }
    // 常见备选端点（不覆盖已存在的）
    const fallbackCandidates = [
      joinUrl(SITE_URL, 'search.php'),
      joinUrl(SITE_URL, 'index.php'),
      joinUrl(SITE_URL, '?s='),
      joinUrl(SITE_URL, '?q='),
      joinUrl(SITE_URL, 'search'),
      joinUrl(SITE_URL, 'index.php?s=search')
    ];
    fallbackCandidates.forEach(u => { if (possibleUrls.indexOf(u) === -1) possibleUrls.push(u); });

    log(`[搜索] text="${text}" method=${formMethod} inputName=${inputName} token=${dynamicToken ? 'yes' : 'no'}`);
    log(`[搜索] 尝试端点: ${possibleUrls.join(' | ')}`);

    let searchHtml = null;
    let usedUrl = null;
    let usedMethod = null;

    // helper to try GET
    const tryGet = async (urlToTry) => {
      const urlWithQuery = (urlToTry.indexOf('?') === -1) ? `${urlToTry}?${encodeURIComponent(inputName)}=${encodeURIComponent(text)}` : `${urlToTry}&${encodeURIComponent(inputName)}=${encodeURIComponent(text)}`;
      log(`[搜索-GET] 尝试 ${urlWithQuery}`);
      try {
        const res = await $fetch.get(urlWithQuery, { headers: { 'User-Agent': UA, 'Referer': SITE_URL } });
        return res && res.data ? res.data : null;
      } catch (err) {
        log(`[搜索-GET] 错误: ${err && err.message ? err.message : err}`);
        return null;
      }
    };

    // helper to try POST
    const tryPost = async (urlToTry) => {
      const params = new URLSearchParams();
      if (dynamicToken) params.append('csrf_token', dynamicToken);
      params.append(inputName, text);
      // page 可能需要传递，尝试以 page 或 p
      if (page && page > 1) { params.append('page', page); params.append('p', page); }

      log(`[搜索-POST] 尝试 ${urlToTry} body=${params.toString().slice(0,200)}`);
      try {
        const res = await $fetch.post(urlToTry, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA,
            'Referer': SITE_URL
          },
          body: params.toString()
        });
        return res && res.data ? res.data : null;
      } catch (err) {
        log(`[搜索-POST] 错误: ${err && err.message ? err.message : err}`);
        return null;
      }
    };

    // 根据 formMethod 优先尝试
    for (let i = 0; i < possibleUrls.length; i++) {
      const urlTry = possibleUrls[i];
      // 如果 formMethod 是 POST 或 urlTry 看起来像需要 POST，先试 POST
      if ((formMethod || '').toLowerCase() === 'post') {
        const html = await tryPost(urlTry);
        if (html && html.indexOf('result-card') !== -1) { searchHtml = html; usedUrl = urlTry; usedMethod = 'POST'; break; }
      }
      // 再试 GET（有些站点用 GET）
      const htmlGet = await tryGet(urlTry);
      if (htmlGet && htmlGet.indexOf('result-card') !== -1) { searchHtml = htmlGet; usedUrl = urlTry; usedMethod = 'GET'; break; }
      // 如果还没找到且没有尝试过 POST，尝试 POST as fallback
      if ((formMethod || '').toLowerCase() !== 'post') {
        const htmlPostFallback = await tryPost(urlTry);
        if (htmlPostFallback && htmlPostFallback.indexOf('result-card') !== -1) { searchHtml = htmlPostFallback; usedUrl = urlTry; usedMethod = 'POST'; break; }
      }
    }

    // 如果仍无结果，但拿到任何响应，还是尝试解析（有可能 class 名不同）
    if (!searchHtml) {
      log(`[搜索] 未直接命中 result-card，尝试解析第一个非空响应作为降级解析`);
      // 尝试逐个请求，取第一个非空响应
      for (let i = 0; i < possibleUrls.length; i++) {
        const urlTry = possibleUrls[i];
        let resp = null;
        if ((formMethod || '').toLowerCase() === 'post') resp = await tryPost(urlTry);
        if (!resp) resp = await tryGet(urlTry);
        if (resp) { searchHtml = resp; usedUrl = urlTry; usedMethod = (formMethod || 'GET').toUpperCase(); break; }
      }
    }

    if (!searchHtml) {
      log(`[搜索] 所有尝试均失败，未获取到搜索结果页面`);
      return jsonify({ list: [] });
    }

    log(`[搜索] 使用 ${usedMethod || '?'} -> ${usedUrl || 'unknown'}`);

    // 解析 searchHtml（兼容多种 class 名）
    const $ = cheerio.load(searchHtml);
    const cards = [];

    // 优先识别 result-card，然后识别通用条目
    const cardSelectors = ['div.result-card', '.result-card', '.search-item', 'li.result', '.item'];
    let foundAny = false;
    for (const sel of cardSelectors) {
      const items = $(sel);
      if (items && items.length) {
        items.each((_, item) => {
          const el = $(item);
          let link = el.find('.result-url a').attr('href') || el.find('a').attr('href') || "";
          const title = el.find('.result-name').text().trim() || el.find('.title').text().trim() || el.find('a').text().trim() || "";
          const time = el.find('.result-time').text().trim() || el.find('.meta').text().trim() || "";

          if (link && !/^https?:\/\//i.test(link)) link = joinUrl(SITE_URL, link);

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
        if (items.length) { foundAny = true; break; }
      }
    }

    // 如果上面都没找到，尝试在全文中直接匹配 aliyundrive 链接（裸文本）
    if (!foundAny) {
      const raw = searchHtml || '';
      const urlRegex = /(https?:\/\/[^\s'"]*(aliyundrive\.com\/s\/[A-Za-z0-9\-_.]+|pan\.aliyun\.com\/s\/[A-Za-z0-9\-_.]+|aliyundrive\.com\/share\/[A-Za-z0-9\-_.]+))/ig;
      let m;
      const seen = new Set();
      while ((m = urlRegex.exec(raw)) !== null) {
        const lnk = m[0];
        if (!seen.has(lnk)) {
          seen.add(lnk);
          cards.push({
            vod_id: lnk,
            vod_name: lnk,
            vod_pic: FALLBACK_PIC,
            vod_remarks: `[阿里云盘 - 直接匹配]`,
            ext: { url: lnk }
          });
        }
      }
    }

    log(`[搜索] 关键词${text}：解析到 ${cards.length} 个匹配`);
    return jsonify({ list: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) });

  } catch (e) {
    log(`[搜索] 异常: ${e && e.message ? e.message : e}`);
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
