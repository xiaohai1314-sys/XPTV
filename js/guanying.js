/**
 * 观影网脚本 - v17.0.3 (基于用户指定的V17.0最终修正)
 *
 * --- 核心思想 ---
 * 严格基于用户提供的、唯一能稳定工作的V17.0版本进行修改。
 * 针对“部分海报因URL格式变更而不显示”的问题，进行最小化、最安全的修正。
 *
 * --- 实现方式 ---
 * 1. 脚本所有部分，均与用户提供的V17.0代码保持一致。
 * 2. 仅在 getCards 函数中，对 vod_pic 的赋值方式进行升级，采用“主备双URL”策略。
 * 3. vod_pic 的值将拼接为 "新格式URL||旧格式URL" 的形式。
 *    例如: "https://.../id/320.webp||https://.../id.webp"
 * 4. 此方案能完美兼容新旧两种海报格式 ，是当前问题的最终解决方案。
 */

// ================== 配置区 (与您提供的V17.0完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: "17.0.3", // 仅修改版本号 ，便于区分
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
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache'; // 使用新的缓存键
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg   ) { try { $log(`[观影网 V17.0.3] ${msg}`); } catch (_) { console.log(`[观影网 V17.0.3] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 【唯一修改点】ensureGlobalCookie (时序兼容版) ---
async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) {
        return GLOBAL_COOKIE;
    }

    // 【关键修复】为 $prefs 调用增加 try...catch 保护
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) {
            log("✅ 从本地缓存中恢复了Cookie！");
            GLOBAL_COOKIE = cachedCookie;
            return GLOBAL_COOKIE;
        }
    } catch (e) {
        log(`⚠️ 读取本地缓存失败 (可能是冷启动时 $prefs 未就绪): ${e.message}`);
    }
    
    log("缓存未命中或不可用，正在从后端获取...");
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
            
            // 【关键修复】为 $prefs 调用增加 try...catch 保护
            try {
                $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); 
            } catch (e) {
                log(`⚠️ 写入本地缓存失败 (可能是 $prefs 未就绪): ${e.message}`);
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

// --- fetchWithCookie (与V16.0完全一致) ---
async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

// --- init (与V16.0完全一致) ---
async function init(ext) {
    return jsonify({});
}

// --- getConfig (与V16.0完全一致) ---
async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心逻辑 - 最小化修正】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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
                
                // 【最终修正】采用“主备双URL”策略，完美兼容两种海报格式
                const newPicUrl = `https://s.tutu.pm/img/${inlistData.ty}/${item}/320.webp`;
                const oldPicUrl = `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`;
                const combinedPicUrl = `${newPicUrl}||${oldPicUrl}`;

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: combinedPicUrl, // 唯一的修改点
                    vod_remarks: inlistData.g[index],
                    ext: { url: detailApiUrl },
                }   );
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
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
