/**
 * 观影网脚本 - v17.1 (海报终极修复版)
 *
 * --- 核心思想 ---
 * 采用“HTML主导，JS补充”的协同作战策略，完美适配网站的混合渲染模式。
 * 1. 主体循环遍历HTML中的`.v5d`元素，确保列表完整性。
 * 2. 从每个`.v5d`的`<img>`标签中精准提取海报URL，解决海报丢失问题。
 * 3. 将`_obj.inlist`作为补充数据库，为影片增加HTML中没有的备注信息。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: 17.1,
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

// ================== 核心函数(与v17.0一致 ) ==================
function log(msg ) { try { $log(`[观影网 V17.1] ${msg}`); } catch (_) { console.log(`[观影网 V17.1] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【海报终极修复核心逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- 【全新】getCards 函数 ---
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        const { data } = await fetchWithCookie(url); 
        const $ = cheerio.load(data);

        // 步骤1: 尝试解析页面中的JS变量作为“补充信息数据库”
        let inlistData = null;
        try {
            const scriptContent = $('script').filter((_, script) => $(script).html().includes('_obj.inlist')).html();
            const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
            if (inlistMatch && inlistMatch[1]) {
                inlistData = JSON.parse(inlistMatch[1]);
                log("✅ 成功解析JS变量，作为补充信息库。");
            }
        } catch(e) {
            log(`⚠️ 解析JS补充信息失败: ${e.message}`);
        }

        // 步骤2: 主循环，遍历HTML中的每个影片元素
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const path = $element.find('a').attr('href');
            if (!path || !name) return;

            // 步骤2.1: 从 <img> 标签精准提取海报URL
            let picUrl = $element.find('img').attr('data-src');
            if (!picUrl) picUrl = $element.find('img').attr('src'); // 备用规则

            // 步骤2.2: 提取影片ID等信息
            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;

            // 步骤2.3: 【协同作战】去JS数据库里查找补充信息
            let remarks = $element.find('p').text().trim(); // 默认备注
            if (inlistData && inlistData.t && inlistData.g) {
                const index = inlistData.t.findIndex(title => title === name);
                if (index !== -1 && inlistData.g[index]) {
                    remarks = inlistData.g[index]; // 使用JS变量里更详细的备注
                }
            }

            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl || FALLBACK_PIC, // 使用提取到的URL，失败则用默认图
                vod_remarks: remarks,
                ext: { url: detailApiUrl },
            });
        });

        if (cards.length === 0) {
            log("警告：在页面上未能解析到任何影片列表项 (.v5d)。");
        } else {
            log(`✅ 成功从HTML中解析到 ${cards.length} 个项目。`);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- 【全新】search 函数，逻辑与 getCards 保持高度一致 ---
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

        // 搜索页没有 _obj.inlist，所以直接解析HTML即可
        $('.v5d').each((_, element) => {
            const $element = $(element);
            const name = $element.find('b').text().trim();
            const remarks = $element.find('p').text().trim();
            const path = $element.find('a').attr('href');
            if (!path || !name) return;

            let picUrl = $element.find('img').attr('data-src');
            if (!picUrl) picUrl = $element.find('img').attr('src');

            const match = path.match(/\/([a-z]+)\/(\d+)/);
            if (!match) return;
            const type = match[1];
            const vodId = match[2];
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            
            cards.push({
                vod_id: detailApiUrl,
                vod_name: name,
                vod_pic: picUrl || FALLBACK_PIC,
                vod_remarks: remarks,
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
