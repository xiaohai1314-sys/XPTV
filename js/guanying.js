/**
 * 观影网脚本 - v35.0 (遵从原版结构最终修复版)
 *
 * --- 核心思想 ---
 * 深刻反省后，完全回归并遵从用户提供的、可正常通信的v35.0代码结构。
 * 经审视，确认问题出在我擅自修改了BACKEND_URL的定义和拼接方式，破坏了原有通信。
 * 本版本100%保留用户原有的网络请求函数和常量定义，仅对业务逻辑函数`parsePage`进行修复。
 */

// ================== 配置区 (完全遵从您的原版) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★★★ 核心修正：恢复您原版的URL定义方式 ★★★
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
// 为了海报代理 ，我们单独定义一个基础URL
const BACKEND_BASE_URL = 'http://192.168.10.111:5000';

const appConfig = {
    ver: '35.0 (遵从原版最终修复 )',
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v35_cookie_cache';

// ================== 核心函数 (100%使用您的原版 ，确保通信) ==================
function log(msg) { try { $log(`[观影网 V35最终修复] ${msg}`); } catch (_) { console.log(`[观影网 V35最终修复] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ★★★ 100% 使用您的原版函数，不做任何修改 ★★★
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
        const response = await $fetch.get(BACKEND_URL); // 直接使用您原版的 BACKEND_URL
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

// ★★★ 100% 使用您的原版函数，不做任何修改 ★★★
async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【唯一的修改点】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// ★★★ 唯一的修改：重写 parsePage 函数以正确解析数据 ★★★
function parsePage(html, pageType) {
    const cards = [];
    try {
        const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!match || !match[1]) { throw new Error("在HTML中未找到 _obj.inlist 数据。"); }
        
        const inlistData = JSON.parse(match[1]);
        if (!inlistData || !inlistData.t || !inlistData.i) { throw new Error("解析出的 _obj.inlist 格式不正确。"); }

        for (let i = 0; i < inlistData.t.length; i++) {
            const name = inlistData.t[i];
            const vodId = inlistData.i[i];
            const year = (inlistData.a[i] && inlistData.a[i][0]) ? inlistData.a[i][0] : '';
            const score = inlistData.d[i] ? `评分:${inlistData.d[i]}` : '';
            const remarks = [year, score].filter(Boolean).join(' | ');

            cards.push({
                vod_id: `${appConfig.site}res/downurl/${pageType}/${vodId}`,
                vod_name: name,
                vod_pic: `${BACKEND_BASE_URL}/getPoster?type=${pageType}&vodId=${vodId}`, // 使用新的基础URL来拼接海报地址
                vod_remarks: remarks,
                ext: { url: `${appConfig.site}res/downurl/${pageType}/${vodId}` },
            });
        }
    } catch (e) {
        log(`❌ 解析JS数据时发生错误: ${e.message}`);
        return [];
    }
    return cards;
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【以下代码保持您的原版结构】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const pageType = ext.id.split('?')[0];
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    log(`请求分类列表: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data, pageType);
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
        const cards = parsePage(data, 'mv');
        log(`✅ 成功解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo 保持您的原版 ---
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
