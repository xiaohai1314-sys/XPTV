/**
 * 观影网脚本 - v19.0 (数据源重构版)
 *
 * --- 核心思想 ---
 * 经过分析确认，观影网已改为通过JavaScript对象 `_obj.inlist` 动态渲染页面。
 * 旧的HTML解析方式 (`$('.v5d')`) 已完全失效。
 * 本版本放弃HTML解析，直接从页面脚本中提取 `_obj.inlist` JSON数据，从根源上解决问题。
 *
 * --- 更新日志 ---
 *  - v19.0 (AI重构):
 *    - [重大重构] `getCards` 和 `search` 函数放弃Cheerio的HTML解析。
 *    - [全新逻辑] 通过正则表达式直接从返回的HTML中捕获 `_obj.inlist` 的JSON字符串。
 *    - [数据提取] 直接从解析后的 `_obj.inlist` 对象中提取影片标题、ID等信息。
 *    - [海报修复] 放弃失效的 s.tutu.pm 图床，采用观影网官方的、可靠的海报拼接规则。
 *    - [稳定性] 新逻辑不再受前端HTML结构变化影响，只要数据源 `_obj.inlist` 存在就有效。
 */

// ================== 配置区 ==================
const cheerio = createCheerio(); // 虽然主要逻辑不用，但可能某些地方仍需保留
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 19.0, // 全新版本号
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie缓存】★★★★★
let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v19_cookie_cache'; // 更新缓存键
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V19.0] ${msg}`); } catch (_) { console.log(`[观影网 V19.0] ${msg}`); } }
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
    } catch (e) { log(`⚠️ 读取本地缓存失败: ${e.message}`); }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【全新数据源逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 新的核心解析函数
function parseDataFromInlist(html, cards) {
    // 1. 使用正则表达式从整个HTML文本中捕获 _obj.inlist 的内容
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return;
    }

    try {
        // 2. 将捕获到的字符串解析为JSON对象
        const inlist = JSON.parse(match[1]);
        
        // 3. 检查必要的数据数组是否存在
        if (!inlist.t || !inlist.i || !inlist.ty) {
            log("❌ _obj.inlist 数据结构不完整。");
            return;
        }

        const type = inlist.ty; // 获取影片类型，如 'mv', 'tv'

        // 4. 遍历数据并组装成卡片
        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return; // 如果没有ID，跳过

            const name = title;
            // 备注信息：尝试从 'q' 数组获取，如果没有则为空
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            
            // ★★★ 修复后的海报URL拼接规则 ★★★
            const picUrl = `${appConfig.site}img/${type}/${vodId}.webp`;
            
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl,
                vod_remarks: remarks,
                ext: { url: detailApiUrl },
            });
        });

    } catch (e) {
        log(`❌ 解析 _obj.inlist JSON失败: ${e.message}`);
    }
}


// 重构后的 getCards 函数
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url); 
        parseDataFromInlist(data, cards); // 调用新的解析函数
        log(`✅ 成功通过数据源解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// 重构后的 search 函数
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        let cards = [];
        parseDataFromInlist(data, cards); // 调用新的解析函数
        log(`✅ 成功从搜索结果中解析到 ${cards.length} 个项目。`);
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
