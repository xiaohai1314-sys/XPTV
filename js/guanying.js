/**
 * 观影网脚本 - v39.0 (双模式兼容最终版)
 *
 * --- 核心思想 ---
 * 经过多次严谨的分析和确认，最终明确网站存在两种并存的页面渲染模式：
 * 1. API模式：主要数据通过 <script> 标签内的 _obj.inlist JavaScript对象提供。
 * 2. 直连/SEO模式：数据被直接完整地渲染在HTML的 <li> 元素中。
 * 
 * 本版本通过重构核心解析函数 parsePage，实现了对这两种模式的智能兼容。
 * 它会优先检查API模式，如果失败则自动切换到HTML元素解析模式，从而确保在任何情况下都能正确解析数据。
 * 同时，针对API模式下的海报问题，提供了一个包含所有已知格式的“全家桶”URL方案。
 *
 * --- 更新日志 ---
 *  - v39.0 (双模式兼容最终版):
 *    - 【核心重构】parsePage 函数实现双模式兼容。优先尝试解析 _obj.inlist，如果失败，则自动回退到使用Cheerio解析HTML的 <li> 元素。
 *    - 【海报全家桶】在解析 _obj.inlist 模式时，使用包含主站和图床共三种可能性的URL拼接方案，最大限度地解决海报丢失问题。
 *    - 【健壮性】无论服务器返回哪种页面结构，脚本都能自适应并正确解析，保证了最高的稳定性和兼容性。
 *    - 【保持兼容】所有后端通信逻辑保持不变。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 39.0, // 双模式兼容最终版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie缓存】(原封不动 ) ★★★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v39_cookie_cache'; // 更新版本号避免缓存冲突
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (通信部分原封不动) ==================

function log(msg) { try { $log(`[观影网 V39.0] ${msg}`); } catch (_) { console.log(`[观影网 V39.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            log("✅ 从本地缓存中恢复了Cookie！");
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) { log(`⚠️ 读取本地缓存失败 (可能是冷启动): ${e.message}`); }
    log("缓存未命中，正在从后端获取...");
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) { log(`⚠️ 写入本地缓存失败: ${e.message}`); }
            return GLOBAL_COOKIE;
        }
        throw new Error(`从后端获取Cookie失败: ${result.message || '未知错误'}`);
    } catch (e) {
        log(`❌ 网络请求后端失败: ${e.message}`);
        $utils.toastError(`无法连接Cookie后端: ${e.message}`, 5000);
        throw e;
    }
}

async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 核心修改区域 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

/**
 * 统一的、双模式兼容的页面解析函数
 * @param {string} html 网页的HTML源码
 * @returns {Array} 卡片对象数组
 */
function parsePage(html) {
    // --- 模式一：优先尝试解析 _obj.inlist (API模式) ---
    const scriptContentMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (scriptContentMatch && scriptContentMatch[1]) {
        log("检测到 API 模式 (_obj.inlist)，开始解析...");
        try {
            const inlistData = JSON.parse(scriptContentMatch[1]);
            const cards = [];
            const vodType = inlistData.ty;

            if (!inlistData.t || !inlistData.i) {
                log("❌ _obj.inlist 数据不完整。");
                return [];
            }

            inlistData.t.forEach((name, index) => {
                const vodId = inlistData.i[index];
                if (!vodId) return;

                const detailApiUrl = `${appConfig.site}res/downurl/${vodType}/${vodId}`;
                
                // ★★★ 海报URL全家桶方案 ★★★
                const picUrl1 = `${appConfig.site}img/${vodType}/${vodId}.webp`;
                const picUrl2 = `https://s.tutu.pm/img/${vodType}/${vodId}/220.webp`;
                const picUrl3 = `https://s.tutu.pm/img/${vodType}/${vodId}.webp`;
                const picUrl = `${picUrl1}@${picUrl2}@${picUrl3}`;

                const remarks = inlistData.q && inlistData.q[index] ? inlistData.q[index].join(' ' ) : '';

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: name,
                    vod_pic: picUrl,
                    vod_remarks: remarks,
                    ext: { url: detailApiUrl },
                });
            });
            
            log(`✅ API 模式解析成功，找到 ${cards.length} 个项目。`);
            return cards;

        } catch (e) {
            log(`⚠️ API 模式解析失败: ${e.message}。将尝试回退到HTML解析模式。`);
        }
    }

    // --- 模式二：回退到解析HTML元素 (直连/SEO模式) ---
    log("未检测到 _obj.inlist 或解析失败，回退到 HTML 元素解析模式...");
    const $ = cheerio.load(html);
    const cards = [];
    
    $('ul.content-list > li').each((_, element) => {
        const $li = $(element);
        const $anchor = $li.find('a').first();
        const path = $anchor.attr('href');
        const name = $anchor.attr('title');
        const $image = $li.find('img.lazy');
        const picUrl = $image.attr('data-src');
        const remarksText = $li.find('.li-bottom').text().trim();
        
        if (!path || !name || !picUrl) return;
        
        const match = path.match(/\/([a-z]+)\/(\w+)/);
        if (!match) return;
        const type = match[1];
        const vodId = match[2];
        
        const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
        
        cards.push({
            vod_id: detailApiUrl,
            vod_name: name,
            vod_pic: picUrl, // 直接使用最准确的地址
            vod_remarks: remarksText,
            ext: { url: detailApiUrl },
        });
    });
    
    if (cards.length > 0) {
        log(`✅ HTML 元素解析模式成功，找到 ${cards.length} 个项目。`);
    } else {
        log("❌ 两种解析模式均未找到任何项目。请检查网站结构是否再次发生变化。");
    }
    
    return cards;
}


async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data); // 使用我们全新的双模解析函数
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`请求搜索页: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data); // 使用我们全新的双模解析函数
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo 保持不变 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const respstr = JSON.parse(data);
        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) name = `${name}${matches[0]}`;
                }
                tracks.push({ name: name || respstr.panlist.name[index], pan: item, ext: { url: '' } });
            });
        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证或更新Cookie');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
