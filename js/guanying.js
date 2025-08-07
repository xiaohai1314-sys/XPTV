/**
 * 观影网脚本 - v15.5 (完整最终修复版)
 *
 * --- 架构 ---
 * 【代码完整性修复】基于v15.0版本，修复了之前因疏忽导致函数代码丢失的严重错误。
 * 【根源修复】集成了已加固的getCards函数，以应对网站HTML结构变化。
 * 【体验保留】集成了稳定可靠的前端缓存逻辑，保证App启动速度。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【请务必修改这里】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲【请务必修改这里】▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const appConfig = {
    ver: 15.5,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

let GLOBAL_COOKIE = null;
let IS_FETCHING_COOKIE = false;
const COOKIE_CACHE_KEY = 'gying_v15_cookie_cache';

// ================== 核心函数 (来自v15.2稳定版 ) ==================

function log(msg ) { try { $log(`[观影网 V15.5] ${msg}`); } catch (_) { console.log(`[观影网 V15.5] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    if (IS_FETCHING_COOKIE) {
        log("检测到正在获取Cookie，请稍候...");
        while(IS_FETCHING_COOKIE) { await new Promise(resolve => setTimeout(resolve, 200)); }
        return GLOBAL_COOKIE;
    }
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            log("✅ 从本地缓存中恢复了Cookie！");
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) { log(`⚠️ 读取本地缓存失败: ${e.message}`); }
    log("缓存未命中，正在从后端获取...");
    IS_FETCHING_COOKIE = true;
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功获取并缓存了新的全局Cookie！");
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch(e) { log(`⚠️ 写入本地缓存失败: ${e.message}`); }
            return GLOBAL_COOKIE;
        }
        throw new Error(`从后端获取Cookie失败: ${result.message || '未知错误'}`);
    } catch (e) {
        log(`❌ 网络请求后端失败: ${e.message}`);
        $utils.toastError(`无法连接Cookie后端: ${e.message}`, 5000);
        throw e;
    } finally {
        IS_FETCHING_COOKIE = false;
    }
}

async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

async function init(ext) {
    log("脚本初始化，开始预热全局Cookie...");
    await ensureGlobalCookie().catch(e => log(`❌ Cookie预热失败: ${e.message}`));
    return jsonify({});
}

async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards 最终修复版】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url);
        if (!data) {
            throw new Error("请求成功，但未返回任何HTML数据。");
        }

        const $ = cheerio.load(data);
        const scriptContent = $('script').filter((_, script) => {
            const html = $(script).html();
            return html && html.includes('_obj.header');
        }).html();

        if (!scriptContent) {
            log("【解析失败】关键错误：未能找到包含'_obj.header'的script标签。请检查网站HTML结构是否已变更。");
            $utils.toastError("解析失败：找不到关键script", 4000);
            return jsonify({ list: [] });
        }

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            log("【解析失败】关键错误：在script标签中未能匹配到'_obj.inlist'数据。变量名可能已更改。");
            $utils.toastError("解析失败：找不到inlist数据", 4000);
            return jsonify({ list: [] });
        }

        const inlistData = JSON.parse(inlistMatch[1]);
        let cards = [];
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
            log(`✅ 成功解析到 ${cards.length} 个项目。`);
        } else {
            log("警告：inlist数据中没有找到 'i' 数组，列表为空。");
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表时发生未知异常: ${e.message}`);
        $utils.toastError(`加载异常: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【100%保留的原始函数】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

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

async function getPlayinfo(ext) {
    ext = argsify(ext);
    // 从 getTracks 的结果中获取 pan 链接
    const panLink = ext.pan;
    // 直接返回这个链接，让App调用系统浏览器或特定网盘App打开
    return jsonify({ urls: [panLink] });
}
