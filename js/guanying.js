/**
 * 观影网脚本 - v12.0 (严格遵循原版-后端驱动)
 * 
 * 本次修改严格遵循以下原则：
 * 1. 100% 基于用户提供的 v4.0 脚本进行修改。
 * 2. 唯一改动点：将写死的 `COOKIE` 替换为从后端动态获取的机制。
 * 3. 核心数据处理函数 `getCards`, `getTracks`, `search` 的内部逻辑，
 *    与原版保持完全一致，不做任何“优化”或改动。
 */

// ================== 配置区 (来自原版) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

const appConfig = {
    ver: 12.0, // 版本号更新以作区分
    title: '观影网 (后端版)', // 标题更新以作区分
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【请配置你的个人后端服务地址】★★★★★
// 这是唯一的配置项
const BACKEND_API_URL = 'http://192.168.10.111:5000/getCookie'; 
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

// --- 辅助函数 (来自原版 ，保持不变) ---
function log(msg) { try { $log(`[观影网 V12.0] ${msg}`); } catch (_) { console.log(`[观影网 V12.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 新增模块：用于从后端获取Cookie ---
let dynamicCookie = '';
let isBackendFailed = false;

async function getDynamicCookie() {
    if (dynamicCookie) return dynamicCookie;
    if (isBackendFailed) throw new Error('后端连接已失败，不再重试。');

    log(`正在从后端 (${BACKEND_API_URL}) 获取Cookie...`);
    try {
        const { data } = await $fetch.get(BACKEND_API_URL, { timeout: 15000 });
        const parsedData = JSON.parse(data);
        if (parsedData.status === 'success' && parsedData.cookie) {
            log('成功从后端获取Cookie！');
            dynamicCookie = parsedData.cookie;
            return dynamicCookie;
        }
        throw new Error(`后端返回错误: ${parsedData.message || '未知错误'}`);
    } catch (e) {
        isBackendFailed = true;
        log(`无法连接到后端服务: ${e.message}`);
        $utils.toastError(`无法连接到后端服务: ${e.message}`, 8000);
        throw e;
    }
}

/**
 * 【修改点】将原版的 fetchWithCookie 升级为 fetchWithDynamicCookie
 * 它会先获取动态Cookie，再发送请求。
 */
async function fetchWithDynamicCookie(url, options = {}) {
    const cookie = await getDynamicCookie(); // 获取动态Cookie
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}

// --- getConfig (来自原版，保持极简) ---
async function getConfig() {
    return jsonify(appConfig);
}

// --- getCards (逻辑与原版v4.0完全相同) ---
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);

    try {
        // 【唯一改动】调用新的网络请求函数
        const { data } = await fetchWithDynamicCookie(url);
        const $ = cheerio.load(data);

        // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        // 【100% 忠于原版】以下所有数据提取逻辑，与你给的v4.0脚本完全相同。
        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (!scriptContent) {
            throw new Error("未能找到包含'_obj.header'的关键script标签。");
        }

        const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!inlistMatch || !inlistMatch[1]) {
            throw new Error("在script标签中未能匹配到'_obj.inlist'数据。");
        }

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
            log(`成功从JS变量中解析到 ${cards.length} 个项目。`);
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`获取卡片列表异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks (逻辑与原版v4.0完全相同) ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);

    try {
        // 【唯一改动】调用新的网络请求函数
        const { data } = await fetchWithDynamicCookie(url);
        const respstr = JSON.parse(data);

        if (respstr.hasOwnProperty('panlist')) {
            const regex = { '中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g, '原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g };
            respstr.panlist.url.forEach((item, index) => {
                let name = '';
                for (const keyword in regex) {
                    const matches = (respstr.panlist.name[index] || '').match(regex[keyword]);
                    if (matches) {
                        name = `${name}${matches[0]}`;
                    }
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
        log(`获取详情数据异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- search (逻辑与原版v4.0完全相同) ---
async function search(ext) {
    ext = argsify(ext);
    let text = encodeURIComponent(ext.text);
    let page = ext.page || 1;
    let url = `${appConfig.site}/s/1---${page}/${text}`;
    log(`执行搜索: ${url}`);

    try {
        // 【唯一改动】调用新的网络请求函数
        const { data } = await fetchWithDynamicCookie(url);
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
        log(`搜索异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getPlayinfo (来自原版，保持不变) ---
async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] });
}
