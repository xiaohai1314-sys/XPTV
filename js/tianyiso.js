/**
 * 阿里资源搜索前端插件 - V1.2 (纯前端版)
 * 说明：
 *  - 针对 https://stp.ezyro.com/al/ 的表单结构优化（POST, q, csrf_token）
 *  - 增强 getCards/getTracks 的解析兼容性
 *  - 保持原有外部接口：init/home/category/detail/play
 */

// --- 配置区 ---
const SITE_URL = "https://stp.ezyro.com/al/"; // 阿里资源搜索地址（注意末尾 / 保持一致）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio ? createCheerio() : null; // 宿主环境的 cheerio
const FALLBACK_PIC = "https://www.aliyundrive.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;

// --- 辅助函数 ---
function log(msg) { const logMsg = `[阿里资源搜索-纯前端] ${msg}`; if (DEBUG) console.log(logMsg); }
function argsify(ext) { try { return typeof ext === 'string' ? JSON.parse(ext) : ext || {}; } catch (e) { return {}; } }
function jsonify(data) { return JSON.stringify(data); }
// 校验阿里云盘链接
function isAliyunDriveUrl(url) {
  return typeof url === 'string' && (
    url.includes('aliyundrive.com/s/') ||
    url.includes('aliyundrive.com/share/') ||
    url.includes('pan.aliyun.com/s/')
  );
}
function joinUrl(base, path) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

// --- 插件入口 ---
async function getConfig() {
  log("==== 纯前端插件初始化 ====");
  const CATEGORIES = [{ name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } }];
  return jsonify({ ver: 1, title: '阿里资源搜索', site: SITE_URL, tabs: CATEGORIES });
}

// --- 首页资源提取 (兼容 .results 容器) ---
async function getCards(ext) {
  ext = argsify(ext);
  const { id: category, page = 1 } = ext;
  try {
    const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA, 'Referer': SITE_URL } });
    const $ = cheerio.load(data);
    const cards = [];

    // 优先在 .results 节点下查找条目
    const container = $('.results').length ? $('.results') : $.root();
    const selectors = ['.result-card', '.search-item', 'li.result', '.item', '.result'];

    for (const sel of selectors) {
      const items = container.find(sel);
      if (items && items.length) {
        items.each((_, it) => {
          const el = $(it);
          let link = el.find('.result-url a').attr('href') || el.find('a').attr('href') || "";
          const title = (el.find('.result-name').text() || el.find('.title').text() || el.find('a').text()).trim() || "";
          const time = (el.find('.result-time').text() || el.find('.meta').text()).trim() || "";

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
        // 若该 selector 找到了条目，就不再继续检查后续 selector（减少重复）
        if (items.length) break;
      }
    }

    // 若仍然没有通过结构化解析到内容，尝试全文正则抓取 aliyundrive 链接（最后手段）
    if (!cards.length) {
      const raw = data || '';
      const urlRegex = /(https?:\/\/[^\s'"]*(aliyundrive\.com\/s\/[A-Za-z0-9\-_.]+|aliyundrive\.com\/share\/[A-Za-z0-9\-_.]+|pan\.aliyun\.com\/s\/[A-Za-z0-9\-_.]+))/ig;
      const seen = new Set();
      let m;
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

    // 分页
    const start = (page - 1) * PAGE_SIZE;
    const pageData = cards.slice(start, start + PAGE_SIZE);
    log(`[首页] 分类${category}：共${cards.length}个资源，第${page}页返回${pageData.length}个`);
    return jsonify({ list: pageData });
  } catch (e) {
    log(`[首页] 异常: ${e && e.message ? e.message : e}`);
    return jsonify({ list: [] });
  }
}

// --- 搜索功能 (针对 stp.ezyro.com/al 的精确实现) ---
async function search(ext) {
  ext = argsify(ext);
  const { text = '', page = 1 } = ext;
  if (!text) return jsonify({ list: [] });

  try {
    // 1) GET 首页，提取 csrf_token（页面中有 input[name="csrf_token"]）
    const { data: homeData } = await $fetch.get(SITE_URL, {
      headers: { 'User-Agent': UA, 'Referer': SITE_URL }
    });
    const $$ = cheerio.load(homeData || '');

    const dynamicToken = $$('input[name="csrf_token"]').attr('value') || '';
    if (!dynamicToken) {
      log('[搜索] 未能在首页找到 csrf_token（仍将尝试提交，但可能被拒绝）');
    } else {
      log('[搜索] 成功获取 csrf_token');
    }

    // 2) 构造 POST body（与页面 form 一致）
    const params = new URLSearchParams();
    if (dynamicToken) params.append('csrf_token', dynamicToken);
    params.append('q', text);
    if (page && page > 1) { params.append('page', page); params.append('p', page); }

    // 3) POST 到同一页面（form action="" 表示提交到当前 URL）
    log(`[搜索] 提交 POST 到 ${SITE_URL}，body=${params.toString().slice(0,200)}`);
    const { data: searchData } = await $fetch.post(SITE_URL, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Referer': SITE_URL
      },
      body: params.toString()
    });

    // 4) 解析返回 HTML
    const $ = cheerio.load(searchData || '');
    const cards = [];

    // 解析优先级：.results 下结构化条目 -> 常见 selectors -> 正则降级
    const container = $('.results').length ? $('.results') : $.root();
    const selectors = ['.result-card', '.search-item', 'li.result', '.item', '.result'];

    let found = false;
    for (const sel of selectors) {
      const items = container.find(sel);
      if (items && items.length) {
        items.each((_, it) => {
          const el = $(it);
          let link = el.find('.result-url a').attr('href') || el.find('a').attr('href') || "";
          const title = (el.find('.result-name').text() || el.find('.title').text() || el.find('a').text()).trim() || "";
          const time = (el.find('.result-time').text() || el.find('.meta').text()).trim() || "";

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
        if (items.length) { found = true; break; }
      }
    }

    // 降级正则匹配（裸链）
    if (!found) {
      const raw = searchData || '';
      const urlRegex = /(https?:\/\/[^\s'"]*(aliyundrive\.com\/s\/[A-Za-z0-9\-_.]+|aliyundrive\.com\/share\/[A-Za-z0-9\-_.]+|pan\.aliyun\.com\/s\/[A-Za-z0-9\-_.]+))/ig;
      const seen = new Set();
      let m;
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

    log(`[搜索] 关键词"${text}" 解析到 ${cards.length} 条（返回第 ${page} 页）`);
    return jsonify({ list: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) });

  } catch (e) {
    log('[搜索] 异常: ' + (e && e.message ? e.message : e));
    return jsonify({ list: [] });
  }
}

// --- 详情页 (直接返回阿里云盘直链，尝试提取访问码附近信息) ---
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url || !isAliyunDriveUrl(url)) {
    return jsonify({ list: [{ title: '无效链接', tracks: [{ name: '请检查链接', pan: '', ext: {} }] }] });
  }

  try {
    // 尝试 GET 详情页（若为站内链接），并在页面中查找访问码（例如：访问码：abcd）
    let code = '';
    let title = '阿里云盘资源';
    if (url.indexOf(SITE_URL) === 0) {
      // 站内详情页，抓取页面并尝试查找旁边的访问码文本
      const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA, 'Referer': SITE_URL } });
      const $ = cheerio.load(data || '');
      // 常见访问码附近文本匹配
      const txt = $.text() || '';
      const codeMatch = txt.match(/访问码[:：\s]*([A-Za-z0-9]{3,8})/);
      if (codeMatch) code = codeMatch[1];
      // 尝试提取更合适的标题
      title = ($('.post-title').text() || $('.title').text() || $('h1').text() || title).trim();
    }

    // 构造返回 track（若有访问码，放入 ext 方便宿主做拼接）
    const trackExt = {};
    if (code) trackExt.access_code = code;

    return jsonify({
      list: [{
        title: title,
        tracks: [{ name: '阿里云盘', pan: url, ext: trackExt }]
      }]
    });
  } catch (e) {
    log('[详情] 异常: ' + (e && e.message ? e.message : e));
    return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取详情失败', pan: url, ext: {} }] }] });
  }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const cfg = JSON.parse(await getConfig()); return jsonify({ class: cfg.tabs }); }
async function category(tid, pg) { return getCards({ id: tid, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(_, id) { return jsonify({ url: id }); }

log('==== 纯前端插件 V1.2 加载完成 ====');
