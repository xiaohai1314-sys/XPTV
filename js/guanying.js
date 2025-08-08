/**
 * 观影网脚本 - v23.0 (终极重构版)
 *
 * --- 核心思想 ---
 * 遵从用户最终指示，彻底抛弃对V17.0脆弱实现（依赖_obj.inlist）的拘泥，
 * 采用最直接、最可靠的方式重构核心功能，以求根本性解决问题。
 *
 * --- 实现方式 ---
 * 1. 【getCards彻底重构】: 废弃了所有基于JS变量(_obj.inlist)的解析逻辑。
 * 2. 【拥抱HTML解析】: getCards函数的核心解析引擎，被完全替换为与稳定可靠的
 *    search函数相同的“直接HTML解析”模式。它将直接遍历页面中的影片元素
 *    （如.v5d），一步到位地获取包括标题、备注和【最准确海报】在内的所有信息。
 * 3. 【一步到位】: 此方案不再有任何异步修正或复杂的备用逻辑，一次网络请求，
 *    一次HTML解析，直接输出最完整、最准确的数据。这从根本上解决了之前
 *    所有版本遇到的稳定性、海报准确性等一系列问题。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: "23.0", // 版本号明确为“终极重构版”
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

// ================== 核心函数 (基于V17.0的稳定框架 ) ==================
function log(msg  ) { try { $log(`[观影网 V23.0] ${msg}`); } catch (_) { console.log(`[观影网 V23.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards - 终极重构版】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

        // 【全新解析逻辑】像 search 函数一样，直接遍历页面上的 .v5d 元素
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            
            // 优先从<picture>的<source>获取现代化的webp图片
            let imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            // 如果找不到，则从<img>的data-src获取懒加载的图片
            if (!imgUrl) {
                imgUrl = $element.find('img').attr('data-src');
            }

            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');

            // 必须要有标题和链接才算是一个有效的影片卡片
            if (!path || !name) return; 

            const match = path.match(/\/([a-z]+)\/(\w+)/);
            if (!match) return; // 如果链接格式不符，则跳过

            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: imgUrl || FALLBACK_PIC, // 使用找到的图片，或备用图
                vod_remarks: additionalInfo,
                ext: { url: detailApiUrl },
            });
        });

        if (cards.length > 0) {
            log(`✅ 成功通过HTML解析引擎获取到 ${cards.length} 个项目。`);
        } else {
            log("⚠️ 未能在页面中解析到任何影片项目(.v5d)，请检查网站结构或Cookie是否有效。");
        }

        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表时发生严重异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【search函数保持一致的解析逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================
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
            let imgUrl = $element.find('picture source[data-srcset]').attr('data-srcset');
            if (!imgUrl) {
                imgUrl = $element.find('img').attr('data-src');
            }
            const additionalInfo = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path) return;
            const match = path.match(/\/([a-z]+)\/(\w+)/);
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
