/**
 * 观影网脚本 - v17.1 (混合架构前端)
 *
 * --- 核心思想 ---
 * 这是与v9.0后端配套使用的前端脚本。
 * 它保留了v17版本绝对稳定的框架，仅修改了海报图片的生成逻辑。
 *
 * --- 更新日志 ---
 *  - v17.1 (混合架构):
 *    - 【海报修复】不再尝试直接拼接海报URL，为确保100%成功率，所有海报URL都统一生成为指向后端/getPoster接口的代理地址。
 *    - 【架构升级】与v9.0后端配套使用，实现“前端解析+后端代理”的高效混合模式。
 *    - 【正则修正】修正了search函数中可能导致ID匹配不全的正则表达式。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★★★ 请确保这里的IP和端口与你的后端服务完全一致 ★★★
const BACKEND_URL = 'http://192.168.10.111:5000'; 

const appConfig = {
    ver: 17.1, // 混合架构前端版本
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
// 注意：这里的缓存键可以保持不变 ，因为Cookie的获取逻辑没有变
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache'; 
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (与v17一致) ==================

function log(msg) { try { $log(`[观影网 V17.1] ${msg}`); } catch (_) { console.log(`[观影网 V17.1] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// ensureGlobalCookie 函数完全复用v17的逻辑，从后端/getCookie获取
async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) {
        return GLOBAL_COOKIE;
    }
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            log("✅ 从本地缓存中恢复了Cookie！");
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) {
        log(`⚠️ 读取本地缓存失败 (可能是冷启动): ${e.message}`);
    }
    
    log("缓存未命中，正在从后端获取...");
    try {
        // ★★★ 请求后端的 /getCookie 接口 ★★★
        const response = await $fetch.get(`${BACKEND_URL}/getCookie`);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
            try {
                $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); 
            } catch (e) {
                log(`⚠️ 写入本地缓存失败: ${e.message}`);
            }
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

async function init(ext) {
    return jsonify({});
}

async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【混合架构的核心修改点】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

        if (!scriptContent) throw new Error("未能找到包含'_obj.header'的关键script标签。");

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) throw new Error("在script标签中未能匹配到'_obj.inlist'数据。");

        const inlistData = JSON.parse(inlistMatch[1]);
        if (inlistData && inlistData.i) {
            inlistData.i.forEach((item, index) => {
                const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                
                // ★★★ 核心修改：所有海报都通过后端代理获取 ★★★
                const picUrl = `${BACKEND_URL}/getPoster?type=${inlistData.ty}&vodId=${item}`;

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: picUrl, // 使用指向我们后端的代理URL
                    vod_remarks: inlistData.g[index],
                    ext: { url: detailApiUrl },
                });
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
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;

            // ★★★ 修正正则，确保能匹配字母和数字ID ★★★
            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            // ★★★ 核心修改：所有海报都通过后端代理获取 ★★★
            const picUrl = `${BACKEND_URL}/getPoster?type=${type}&vodId=${vodId}`;

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl,
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

// --- getTracks 和 getPlayinfo (与v17完全一致) ---
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
