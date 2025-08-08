/**
 * 观影网脚本 - v36.0 (回归圣杯版)
 *
 * --- 核心思想 ---
 * 在经历了所有弯路后，我们最终回归了被证明是唯一稳定可靠的数据源：<script>标签内的_obj.inlist对象。
 * 之前的失败在于错误地抛弃了这个“数据金矿”，而去依赖不稳定的HTML元素。
 * 本版本将v17的稳定数据源逻辑，与我们后来打磨出的完美海报方案进行最终的、正确的融合。
 *
 * --- 更新日志 ---
 *  - v36.0 (回归圣杯):
 *    - [数据源回归] 100%恢复v17从<script>标签提取JSON的核心逻辑，确保数据源的绝对稳定。
 *    - [海报方案融合] 将最完善的“智能提取+备用拼接”海报方案，正确地应用在稳定的数据逻辑之上。
 *    - [健壮性] 即使HTML元素残缺不全，只要_obj.inlist存在，脚本就能正常工作。
 *    - 这，就是我们从一开始就应该抵达的终点。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 36.0, // 回归圣杯版
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
const COOKIE_CACHE_KEY = 'gying_v36_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V36.0] ${msg}`); } catch (_) { console.log(`[观影网 V36.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【最终的融合逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- getCards (基于v17的稳定数据源，并植入完美海报方案) ---
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
            inlistData.i.forEach((vodId, index) => {
                const type = inlistData.ty;
                const name = inlistData.t[index];
                // 从JSON数据中获取备注，这比从HTML中获取更可靠
                const remarks = inlistData.q && inlistData.q[index] ? inlistData.q[index].join(' ') : '';
                
                // ★★★ 完美海报方案植入点 ★★★
                // 即使HTML元素是残缺的，我们也要尝试从中提取海报，这是最好的情况
                let picUrl = '';
                const $container = $(`a.v5d[href="/${type}/${vodId}"]`);
                if ($container.length > 0) {
                    picUrl = $container.find('picture source[data-srcset]').attr('data-srcset');
                    if (!picUrl) { picUrl = $container.find('img.lazy[data-src]').attr('data-src'); }
                }
                // 如果从HTML中提取失败（因为HTML是残次品），我们启用最可靠的备用拼接方案
                if (!picUrl) {
                    const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`;
                    const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
                    picUrl = `${picUrl1}@${picUrl2}`;
                }
                
                const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: name,
                    vod_pic: picUrl,
                    vod_remarks: remarks,
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

// --- search (搜索页逻辑相对稳定，我们使用最健壮的HTML解析) ---
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
            const remarks = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;

            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];

            let picUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            if (!picUrl) { picUrl = $element.find('img.lazy[data-src]').attr('data-src'); }
            if (!picUrl) {
                const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`;
                const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
                picUrl = `${picUrl1}@${picUrl2}`;
            }

            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl,
                vod_remarks: remarks,
                ext: { url: detailApiUrl },
            } );
        });
        log(`✅ 成功从搜索页解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}


// --- getTracks 和 getPlayinfo (保持不变) ---
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
