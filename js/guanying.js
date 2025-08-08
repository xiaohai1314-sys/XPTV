/**
 * 观影网脚本 - v36.0 (数据对象解析版)
 *
 * --- 核心思想 ---
 * 经过分析，确认了列表页为空和海报丢失的根源在于网站页面结构的变更。
 * 旧的解析方式依赖于HTML中的 .v5d 元素，而新版页面已将数据全部移入
 * <script> 标签内的 _obj.inlist JavaScript对象中。
 * 本版本重写了核心解析函数 parsePage，使其直接从该JS对象提取数据，
 * 从而根本上解决了问题。所有其他部分，特别是网络通信逻辑，保持不变。
 *
 * --- 更新日志 ---
 *  - v36.0 (数据对象解析):
 *    - 【核心修复】重写 parsePage 函数，改为使用正则表达式匹配并解析 _obj.inlist 数据对象，替代了无效的 .v5d 元素查找。
 *    - 【功能恢复】现在可以正确解析到影视列表，列表页不再为空。
 *    - 【海报修复】基于从 _obj.inlist 中获取的 type 和 vodId，直接拼接生成正确的的海报地址，海报正常显示。
 *    - 【保持兼容】所有后端通信逻辑 (ensureGlobalCookie, fetchWithCookie) 均保持原样，完美兼容现有后端服务。
 */

// ================== 配置区 (原封不动) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 36.0, // 数据对象解析版
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
const COOKIE_CACHE_KEY = 'gying_v36_cookie_cache'; // 更新版本号避免缓存冲突
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (通信部分原封不动) ==================

function log(msg) { try { $log(`[观影网 V36.0] ${msg}`); } catch (_) { console.log(`[观影网 V36.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 后端通信部分，完全保持原样 ---
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
 * 统一的页面解析函数 (全新逻辑)
 * @param {string} html 网页的HTML源码
 * @returns {Array} 卡片对象数组
 */
function parsePage(html) {
    // 1. 使用正则表达式从HTML中精准提取 _obj.inlist 的JSON字符串
    const scriptContentMatch = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!scriptContentMatch || !scriptContentMatch[1]) {
        log("❌ 在HTML中未找到 _obj.inlist 数据块，页面结构可能已改变。");
        return [];
    }

    try {
        // 2. 将提取到的字符串解析为JSON对象
        const inlistData = JSON.parse(scriptContentMatch[1]);
        const cards = [];
        const vodType = inlistData.ty; // 获取影片类型，如 'mv', 'tv'

        // 3. 检查关键数据数组是否存在
        if (!inlistData.t || !inlistData.i || !inlistData.q) {
            log("❌ _obj.inlist 数据不完整，缺少t, i, 或 q 数组。");
            return [];
        }

        // 4. 遍历数据并组装成卡片对象
        inlistData.t.forEach((name, index) => {
            const vodId = inlistData.i[index]; // 影片ID，例如 'zmza'
            if (!vodId) return; // 如果没有ID，则跳过此条目

            // 详情页API地址
            const detailApiUrl = `${appConfig.site}res/downurl/${vodType}/${vodId}`;
            
            // 智能拼接海报URL，使用@符号连接主备地址
            const picUrl1 = `https://s.tutu.pm/img/${vodType}/${vodId}/220.webp`;
            const picUrl2 = `https://s.tutu.pm/img/${vodType}/${vodId}.webp`;
            const picUrl = `${picUrl1}@${picUrl2}`;

            // 将清晰度标签数组（如["4K"] ）转换为空格分隔的字符串
            const remarks = inlistData.q[index] ? inlistData.q[index].join(' ') : '';

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl,
                vod_remarks: remarks,
                ext: { url: detailApiUrl },
            });
        });

        return cards;

    } catch (e) {
        log(`❌ 解析 _obj.inlist JSON数据时发生错误: ${e.message}`);
        return []; // 解析失败返回空数组，保证健壮性
    }
}


async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        // ★★★ 使用新的解析函数 ★★★
        const cards = parsePage(data);
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
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
        // ★★★ 使用新的解析函数 ★★★
        const cards = parsePage(data);
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
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
