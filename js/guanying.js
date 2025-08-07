/**
 * 观影网脚本 - v17.0 (海报安全补丁版)
 *
 * --- 核心原则 ---
 * 绝对忠于V17.0的稳定逻辑，不动核心函数。
 * 仅在V17.0的 getCards 函数内部，对 vod_pic 的赋值方式进行外科手术式替换。
 * 采用“纯字符串查找”的模式，在函数开头一次性获取HTML文本，
 * 后续通过正则表达式进行海报URL的查找，完全避免与核心逻辑的冲突。
 */

// ================== 配置区 (与V17.0完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: "17.0_patch", // 版本号明确表示为补丁版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

let GLOBAL_COOKIE = null;
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache';

// ================== 核心函数(与v17.0完全一致 ) ==================
function log(msg ) { try { $log(`[观影网 V17.0_patch] ${msg}`); } catch (_) { console.log(`[观影网 V17.0_patch] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) { log("✅ 从本地缓存中恢复了Cookie！"); GLOBAL_COOKIE = cachedCookie; return GLOBAL_COOKIE; }
    } catch (e) { log(`⚠️ 读取本地缓存失败: ${e.message}`); }
    log("缓存未命中或不可用，正在从后端获取...");
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【V17.0 核心函数 - 安全补丁】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url); 
        const $ = cheerio.load(data);

        // 【补丁第一步】在开头一次性获取HTML纯文本，这是一个安全操作
        const htmlText = $.html();

        // 【V17.0核心逻辑】继续从JS变量获取数据
        const scriptContent = $('script').filter((_, script) => {
            return script.html().includes('_obj.inlist');
        }).html();

        if (!scriptContent) throw new Error("未能找到包含'_obj.inlist'的关键script标签。");

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("在script标签中未能匹配到'_obj.inlist'数据。");

        const inlistData = JSON.parse(inlistMatch[1]);
        if (inlistData && inlistData.i) {
            inlistData.i.forEach((item, index) => {
                const name = inlistData.t[index];
                const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                
                // 【补丁第二步】使用纯字符串和正则查找海报，不使用任何有风险的Cheerio操作
                let picUrl = '';
                try {
                    // 正则表达式：查找包含特定标题的.v5d块，并从中捕获data-src的内容
                    // 增加了对特殊字符的转义，增强鲁棒性
                    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`<div class="v5d"[^>]*>.*?<b>${escapedName}</b>.*?data-src="([^"]+)"`, 's');
                    const picMatch = htmlText.match(regex);
                    if (picMatch && picMatch[1]) {
                        picUrl = picMatch[1];
                    }
                } catch(e) {
                    // 正则表达式一般不会抛出严重错误，但以防万一
                }

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: name,
                    // 【补丁第三步】如果找到了，就用；找不到，就还用V17.0的老办法
                    vod_pic: picUrl || `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                    vod_remarks: inlistData.g[index],
                    ext: { url: detailApiUrl },
                } );
            });
            log(`✅ 成功从JS变量中解析到 ${cards.length} 个项目。`);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// search函数不受影响，因为它本来就是解析HTML的，保持原样
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);
    try {
        const { data } = await fetchWithCookie(url);
        const $ = cheerio.load(data);
        let cards = [];
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: imgUrl || '',
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 其他函数保持不变 ---
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
