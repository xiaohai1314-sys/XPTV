/**
 * 观影网脚本 - v17.5 (通信兼容最终版)
 *
 * --- 核心思想 ---
 * 修复了V17.4及之前版本中，因对后端Cookie服务连接失败的处理方式过于激进
 * (在catch后重新throw错误)，导致整个脚本执行链崩溃的问题。
 *
 * 本版本将 ensureGlobalCookie 函数的错误处理机制完全恢复至与稳定可用的
 * V17.0版本一致的模式。即：当连接后端失败时，只记录日志和弹出提示，
 * 不再向上抛出错误，避免了整个应用的崩溃，显著提高了脚本的健壮性。
 * 同时，保留了V17.4中对 getCards 函数的“闸门拆除”改造。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: "17.5", // 版本号明确为“通信兼容最终版”
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

// ================== 核心函数 ==================
function log(msg  ) { try { $log(`[观影网 V17.5] ${msg}`); } catch (_) { console.log(`[观影网 V17.5] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【ensureGlobalCookie - 已修复通信错误处理】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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
        // 如果后端返回的不是success，只记录日志即可，不抛出错误
        log(`❌ 从后端获取Cookie失败: ${result.message || '未知错误'}`);
        $utils.toastError(`获取Cookie失败: ${result.message || '未知错误'}`, 4000);

    } catch (e) {
        // 【关键修复】与V17.0保持一致，只记录日志和提示，不再向上抛出错误 `throw e;`
        log(`❌ 网络请求后端失败: ${e.message}`);
        $utils.toastError(`无法连接Cookie后端: ${e.message}`, 5000);
    }
    // 如果所有尝试都失败，返回null或undefined，让后续逻辑去处理
    return null; 
}

async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    // 如果cookie获取失败，后续请求观影网时cookie就是null，这符合预期
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards 核心函数 - 保留已拆除闸门版本】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (scriptContent) {
            const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
            
            if (inlistMatch && inlistMatch[1]) {
                try {
                    const inlistData = JSON.parse(inlistMatch[1]);
                    if (inlistData && inlistData.i) {
                        inlistData.i.forEach((item, index) => {
                            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                            cards.push({
                                vod_id: detailApiUrl,
                                vod_name: inlistData.t[index],
                                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                                vod_remarks: inlistData.g[index],
                                ext: { url: detailApiUrl },
                            } );
                        });
                        log(`✅ 成功从JS变量中解析到 ${cards.length} 个项目。`);
                    }
                } catch (parseError) {
                    log(`❌ 解析inlist数据时发生错误: ${parseError.message}`);
                }
            } else {
                log("⚠️ 在script中未能匹配到'_obj.inlist'数据，静默处理。");
            }
        } else {
            log("⚠️ 未能找到包含'_obj.header'的关键script标签，静默处理。");
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表时发生严重异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// ================== 其他函数保持原封不动 ==================
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
                vod_pic: imgUrl || FALLBACK_PIC,
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
