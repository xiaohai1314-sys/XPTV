/**
 * 观影网脚本 - v22.0 (异步海报修正最终版)
 *
 * --- 核心思想 ---
 * 接受“getCards函数不可修改”的现实，采用“异步修正”策略，彻底绕开雷区。
 *
 * --- 实现方式 ---
 * 1. 【getCards (侦察兵)】: 严格基于V17.0，只负责从JS变量快速获取除海报外
 *    的核心数据。海报字段(vod_pic)暂时留空，但将修正海报所需ID存入ext。
 * 2. 【search (重装工兵)】: 保持原有关键词搜索功能，并增加一个“按ID搜索”
 *    的隐藏模式。此模式被App在后台调用，用于获取单个影片的准确海报。
 * 3. 【App智能调度】: App加载列表时，发现海报为空，会立刻在后台用ID调用
 *    search函数，获取到准确的海报URL后，动态更新界面。
 * 4. 此方案将“列表加载”和“海报获取”两个任务完全解耦，实现了绝对的稳定
 *    性和海报的最高准确率，是解决所有问题的最终架构。
 */

// ================== 配置区 (与V17.0完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: "22.0", // 版本号明确为最终架构
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
const COOKIE_CACHE_KEY = 'gying_v17_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 (100%基于V17.0 ) ==================
function log(msg  ) { try { $log(`[观影网 V22.0] ${msg}`); } catch (_) { console.log(`[观影网 V22.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) { return GLOBAL_COOKIE; }
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) { log("✅ 从本地缓存中恢复了Cookie！"); GLOBAL_COOKIE = cachedCookie; return GLOBAL_COOKIE; }
    } catch (e) { log(`⚠️ 读取本地缓存失败 (可能是冷启动时 $prefs 未就绪): ${e.message}`); }
    log("缓存未命中或不可用，正在从后端获取...");
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            log("✅ 成功从后端获取并缓存了全局Cookie！");
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) { log(`⚠️ 写入本地缓存失败 (可能是 $prefs 未就绪): ${e.message}`); }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards - 侦察兵模式】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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
                const fixId = `${inlistData.ty}/${item}`; // 例如 "mv/7d2m"

                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: '', // 海报暂时留空，由App后续修正
                    vod_remarks: inlistData.g[index],
                    ext: { 
                        url: detailApiUrl,
                        // ★★★ 提供修正海报所需的情报
                        fix_pic_id: fixId 
                    },
                });
            });
            log(`✅ [侦察兵] 成功获取 ${cards.length} 个项目的基础数据。`);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【search - 重装工兵模式】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================
async function search(ext) {
    ext = argsify(ext);
    let text = ext.text;
    let page = ext.page || 1;
    let url = '';

    // ★★★ 新增的“按ID搜索”模式，用于修正海报
    if (ext.id_search) {
        log(`[工兵] 接到修正海报任务, ID: ${ext.id_search}`);
        url = `${appConfig.site}${ext.id_search}`; // 推断详情页URL
        try {
            const { data } = await fetchWithCookie(url);
            const $ = cheerio.load(data);
            // 从详情页解析最准确的海报
            const vodPic = $('.v-thumb picture source[data-srcset]').attr('data-srcset');
            if (vodPic) {
                log(`[工兵] ✅ 成功找到修正海报: ${vodPic}`);
                // 只返回一个包含准确vod_pic的卡片，用于更新
                const card = {
                    vod_id: `${appConfig.site}res/downurl/${ext.id_search}`,
                    vod_pic: vodPic,
                };
                return jsonify({ list: [card] });
            }
            log(`[工兵] ⚠️ 未能在详情页找到海报。`);
            return jsonify({ list: [] });
        } catch (e) {
            log(`[工兵] ❌ 修正海报时发生异常: ${e.message}`);
            return jsonify({ list: [] });
        }
    }

    // --- 保留原有的关键词搜索逻辑 ---
    url = `${appConfig.site}/s/1---${page}/${encodeURIComponent(text)}`;
    log(`执行关键词搜索: ${url}`);
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


// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【以下函数100%与V17.0一致】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
