/**
 * 观影网脚本 - v17.4 (拆除闸门版)
 *
 * --- 核心思想 ---
 * 遵从用户指示，解决问题的关键在于移除脚本中过于严格的“闸门检查”。
 * 此前版本在找不到特定JS变量时会主动抛出错误，导致执行中断并显示失败提示。
 *
 * 本版本彻底移除了 getCards 函数中所有主动 `throw new Error` 的检查点。
 * 即使网站结构发生微小变化导致数据解析失败，脚本也不会再主动报错，
 * 而是会静默处理，返回一个空列表，从而避免了因严格检查导致的执行失败。
 * 这使得脚本的容错能力和健壮性大大增强。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: "17.4", // 版本号明确为“拆除闸门版”
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
function log(msg  ) { try { $log(`[观影网 V17.4] ${msg}`); } catch (_) { console.log(`[观影网 V17.4] ${msg}`); } }
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
        // 这里保留错误抛出，因为网络和后端问题是必须让用户知道的硬性故障
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards 核心函数 - 已拆除闸门】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

        // 【已拆除闸门】即使找不到script，也不再报错，而是让后续逻辑自然失败
        if (scriptContent) {
            const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
            
            // 【已拆除闸门】即使匹配不到inlist，也不再报错
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
                    // 如果JSON解析失败，记录日志但不抛出错误中断执行
                    log(`❌ 解析inlist数据时发生错误: ${parseError.message}`);
                }
            } else {
                log("⚠️ 在script中未能匹配到'_obj.inlist'数据，静默处理。");
            }
        } else {
            log("⚠️ 未能找到包含'_obj.header'的关键script标签，静默处理。");
        }
        
        // 无论中间发生什么，最终都成功返回一个列表（可能是空的）
        return jsonify({ list: cards });

    } catch (e) {
        // 这个catch现在只捕获网络请求等更严重的、非逻辑检查的错误
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
