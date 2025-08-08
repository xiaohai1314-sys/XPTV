/**
 * 观影网脚本 - v21.0 (三保险海报终极完美版)
 *
 * --- 核心思想 ---
 * 综合所有分析，确认观影网至少存在三种不同的海报HTML结构和URL规则。
 * 本版本构建了“三保险”海报获取机制，按优先级顺序尝试所有已知可能，
 * 旨在100%覆盖所有影片的海报，彻底解决空白问题。
 *
 * --- 海报获取优先级 ---
 * 1. [最高优] <picture> -> <source data-srcset> (最常见、最官方的结构)
 * 2. [次优] <a> -> <img data-src> (针对“暴露狂”这类影片的特殊结构)
 * 3. [备用] 拼接规则 `.../img/类型/ID.webp` (作为最后的防线)
 *
 * --- 更新日志 ---
 *  - v21.0 (AI重构):
 *    - [终极重构] `parseDataAndHtml` 函数升级为“三保险”海报获取逻辑。
 *    - [新增规则] 增加了对 `<img data-src="...">` 结构的海报提取逻辑。
 *    - [逻辑优化] 明确了三种海报获取方式的优先级，确保总是能用到最可靠的URL。
 *    - [兼容性] 此版本应能兼容观影网所有已知的前端海报展示方式。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 21.0, // 终极版本号
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
const COOKIE_CACHE_KEY = 'gying_v21_cookie_cache'; // 更新缓存键
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V21.0] ${msg}`); } catch (_) { console.log(`[观影网 V21.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【三保险终极逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// 终极版核心解析函数
function parseDataAndHtml(html, cards) {
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return;
    }

    try {
        const inlist = JSON.parse(match[1]);
        if (!inlist.t || !inlist.i || !inlist.ty) {
            log("❌ _obj.inlist 数据结构不完整。");
            return;
        }

        const $ = cheerio.load(html);
        const type = inlist.ty;

        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return;

            const name = title;
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            
            // ★★★ 三保险海报获取逻辑 ★★★
            let picUrl = '';
            
            // 定位到包含影片信息的父容器元素
            const $container = $(`a[href="/${type}/${vodId}"]`).closest('.v5d');

            if ($container.length > 0) {
                // 方案一 (最高优先级): 尝试从 <picture><source> 获取
                picUrl = $container.find('picture source[data-srcset]').attr('data-srcset');

                // 方案二 (次高优先级): 如果方案一失败，尝试从 <img> 获取
                if (!picUrl) {
                    picUrl = $container.find('img[data-src]').attr('data-src');
                }
            }
            
            // 方案三 (备用方案): 如果以上两种HTML解析都失败，则使用拼接规则
            if (!picUrl) {
                picUrl = `${appConfig.site}img/${type}/${vodId}.webp`;
                log(`⚠️ [${name}] HTML解析失败, 启用最终备用海报规则。`);
            }
            
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
        log(`❌ 解析过程异常: ${e.message}`);
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
        parseDataAndHtml(data, cards);
        log(`✅ 成功通过终极混合模式解析到 ${cards.length} 个项目。`);
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
        parseDataAndHtml(data, cards);
        log(`✅ 成功从搜索结果中解析到 ${cards.length} 个项目。`);
        return jsonify({ list: [] });
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
