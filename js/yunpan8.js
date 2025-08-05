/**
 * 海绵小站前端插件 - v51.0 (后端驱动版)
 * 
 * 更新日志:
 * - 【v51.0 后端驱动版】真正的最终版。前端不再进行任何解析。
 *   1. (前端无脑化): getTracks函数只负责一件事：请求后端解析接口。
 *   2. (后端全能化): 所有浏览器模拟、HTML获取、正则解析、JSON生成的工作，全部由后端完成。
 *   此方案彻底杜绝了因前端环境差异导致的所有问题。
 */

// --- 配置区 ---
const SITE_URL = "http://192.168.1.7:3000"; // ★★★ 指向您的电脑IP ★★★
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X   ) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://www.haimianxz.com/view/img/logo.png"; 

// ★★★ 前端不再需要Cookie ，已硬编码在后端 ★★★
const COOKIE = ""; 

// --- 核心辅助函数 (不变) ---
function log(msg  ) { try { $log(`[海绵小站 V51.0] ${msg}`); } catch (_) { console.log(`[海绵小站 V51.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 网络请求封装 (简化，不再需要Cookie) ---
async function fetchProxy(url) {
    return $fetch.get(url);
}

// =================================================================================
// =================== 【唯一修改区域】v51.0 后端驱动版 getTracks 函数 ===================
// =================================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext; // url就是 "thread-9445.htm"
    if (!url) return jsonify({ list: [] });

    // 构造指向后端解析接口的URL
    const parseUrl = `${SITE_URL}/parse?url=${url}`;
    log(`请求后端解析接口: ${parseUrl}`);
    
    try {
        // 直接请求后端，后端会返回处理好的一切
        const { data } = await fetchProxy(parseUrl);
        
        // 后端返回的已经是JSON字符串，我们直接返回即可
        // 如果后端返回的是对象，则需要jsonify
        return typeof data === 'string' ? data : jsonify(data);

    } catch (e) {
        log(`请求后端解析接口异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `请求代理失败: ${e.message}`, pan: '', ext: {} }] }] });
    }
}
// =================================================================================

// --- 其他函数保持不变，但为保持简洁，此处省略，您可从旧脚本复制 ---
// ... getConfig, getCorrectPicUrl, getCards, search, init, home, category, detail, play ...
// 注意：getCards等函数仍需使用旧的fetchWithCookie逻辑，因为它们不经过我们的/parse接口
// 为了避免混淆，下面提供完整的、可直接使用的脚本

// --- 完整版脚本所需的所有函数 ---
async function fetchWithCookie(url, options = {}) {
    const real_cookie = "_xn_accesscount_visited=1;bbs_sid=rd8nluq3qbcpg5e5sfb5e08pbg;bbs_token=BPFCD_2FVCweXKMKKJDFHNmqWWvmdFBhgpxoARcZD3zy5FoDMu;Hm_lvt_d8d486f5aec7b83ea1172477c2ecde4f=1754316688,1754316727,1754329315,1754403914;HMACCOUNT=CEAB3CBE53C875F2;Hm_lpvt_d8d486f5aec7b83ea1172477c2ecde4f=1754403929;";
    const headers = { 'User-Agent': UA, 'Cookie': real_cookie, ...options.headers };
    const finalOptions = { ...options, headers };
    if (options.method === 'POST') { return $fetch.post(url, options.body, finalOptions); }
    return $fetch.get(url, finalOptions);
}
async function getConfig() {
  log("插件初始化 (v51.0 - 后端驱动版)");
  return jsonify({ ver: 1, title: '海绵小站', site: "https://www.haimianxz.com", tabs: [ { name: '电影', ext: { id: 'forum-1' } }, { name: '剧集', ext: { id: 'forum-2' } }, { name: '动漫', ext: { id: 'forum-3' } }, { name: '综艺', ext: { id: 'forum-5' } }, ], } );
}
function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    const cleanPath = path.startsWith('./') ? path.substring(2) : path;
    return `https://www.haimianxz.com/${cleanPath}`;
}
async function getCards(ext ) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const listUrl = `https://www.haimianxz.com/${id}-${page}.htm`;
  try {
    const { data } = await fetchWithCookie(listUrl );
    const $ = cheerio.load(data);
    const cards = [];
    $("ul.threadlist > li.media.thread").each((_, item) => {
        const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src");
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
    });
    return jsonify({ list: cards });
  } catch(e) {
    log(`获取卡片列表异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) return jsonify({ list: [] });
  const searchUrl = `https://www.haimianxz.com/search-${encodeURIComponent(text )}.htm`;
  try {
    const { data } = await fetchWithCookie(searchUrl);
    const $ = cheerio.load(data);
    const cards = [];
    $("ul.threadlist > li.media.thread").each((_, item) => {
        const picPath = $(item).find("a:first-child > img.avatar-3")?.attr("src");
        cards.push({ vod_id: $(item).find(".subject a")?.attr("href") || "", vod_name: $(item).find(".subject a")?.text().trim() || "", vod_pic: getCorrectPicUrl(picPath), vod_remarks: $(item).find(".d-flex.justify-content-between.small .text-grey:last-child")?.trim() || "", ext: { url: $(item).find(".subject a")?.attr("href") || "" } });
    });
    return jsonify({ list: cards });
  } catch(e) {
    log(`搜索异常: ${e.message}`);
    return jsonify({ list: [] });
  }
}
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
log('海绵小站插件加载完成 (v51.0 - 后端驱动版)');
