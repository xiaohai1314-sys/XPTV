/**
 * 观影网脚本 - v37.0 (JS解析版)
 *
 * --- 核心思想 ---
 * 基于用户提供的真实网页源代码，确认了网站列表页是通过JavaScript动态生成。
 * 传统的HTML解析方式因此失效。本版本革命性地放弃HTML解析，转而直接从页面内联的
 * <script>标签中提取并解析包含所有列表数据的JavaScript对象（_obj.inlist）。
 * 这种方法精准、高效，且能完全避免因网站HTML结构变更导致的解析失败。
 *
 * --- 更新日志 ---
 *  - v37.0 (JS解析版):
 *    - 【核心重构】`parsePage`函数完全重写，不再使用Cheerio解析HTML元素。
 *    - 【精准提取】通过正则表达式从<script>标签中定位并提取`_obj.inlist`的JSON字符串。
 *    - 【数据解析】直接将提取到的JSON字符串转换为JavaScript对象，并遍历其中的数据数组来构建卡片列表。
 *    - 【稳定可靠】此方法直达数据源，不再受制于动态变化的HTML class name，是目前最稳定可靠的方案。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000'; 

const appConfig = {
    ver: '37.0', // JS解析版
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
const COOKIE_CACHE_KEY = 'gying_v37_cookie_cache';
// ★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V37.0] ${msg}`); } catch (_) { console.log(`[观影网 V37.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const cachedCookie = $prefs.get(COOKIE_CACHE_KEY);
        if (cachedCookie) { GLOBAL_COOKIE = cachedCookie; return GLOBAL_COOKIE; }
    } catch (e) {}
    try {
        const response = await $fetch.get(`${BACKEND_URL}/getCookie`);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            try { $prefs.set(COOKIE_CACHE_KEY, GLOBAL_COOKIE); } catch (e) {}
            return GLOBAL_COOKIE;
        }
        throw new Error(`从后端获取Cookie失败: ${result.message || '未知错误'}`);
    } catch (e) {
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【全新JS解析逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parsePage(html, pageType) {
    const cards = [];
    try {
        // 1. 使用正则表达式从整个HTML文本中匹配 `_obj.inlist={...};` 这部分内容
        const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
        if (!match || !match[1]) {
            throw new Error("在HTML中未找到 _obj.inlist 数据对象。");
        }
        
        // 2. 将匹配到的字符串解析为JSON对象
        const inlistData = JSON.parse(match[1]);

        // 3. 检查数据结构是否符合预期
        if (!inlistData || !inlistData.t || !inlistData.i) {
            throw new Error("解析出的 _obj.inlist 对象格式不正确。");
        }

        log(`✅ 成功提取并解析 _obj.inlist，共包含 ${inlistData.t.length} 个项目。`);

        // 4. 遍历数据数组，构建卡片列表
        for (let i = 0; i < inlistData.t.length; i++) {
            const name = inlistData.t[i];
            const vodId = inlistData.i[i];
            
            // 备注信息由年份和评分组成
            const year = (inlistData.a[i] && inlistData.a[i][0]) ? inlistData.a[i][0] : '';
            const score = inlistData.d[i] ? `评分:${inlistData.d[i]}` : '';
            const remarks = [year, score].filter(Boolean).join(' | ');

            cards.push({
                vod_id: `${appConfig.site}res/downurl/${pageType}/${vodId}`,
                vod_name: name,
                vod_pic: `${BACKEND_URL}/getPoster?type=${pageType}&vodId=${vodId}`, // 直接使用后端代理获取海报
                vod_remarks: remarks,
                ext: { url: `${appConfig.site}res/downurl/${pageType}/${vodId}` },
            });
        }
    } catch (e) {
        log(`❌ 解析JS数据时发生错误: ${e.message}`);
        // 如果解析失败，返回一个错误提示卡片
        return [{
            vod_id: 'error_card',
            vod_name: '列表加载失败',
            vod_pic: 'https://img.zcool.cn/community/01a79355434ab70000019ae97c8252.jpg@1280w_1l_2o_100sh.jpg',
            vod_remarks: `解析脚本错误: ${e.message}`,
        }];
    }
    
    return cards;
}

async function getCards(ext ) {
    ext = argsify(ext);
    const pageType = ext.id.split('?')[0]; // 从 'mv?page=' 中提取出 'mv'
    const url = `${appConfig.site}${ext.id}${ext.page || 1}`;
    try {
        const { data } = await fetchWithCookie(url);
        const cards = parsePage(data, pageType);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ getCards函数发生网络异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const url = `${appConfig.site}/s/1---${ext.page || 1}/${encodeURIComponent(ext.text)}`;
    try {
        const { data } = await fetchWithCookie(url);
        // 注意：搜索结果页的类型可能是混合的，这里我们暂时假定它返回的ID可以直接用
        // 搜索页的解析可能需要单独适配，但我们先用列表页的逻辑
        const cards = parsePage(data, 'mv'); // 搜索页默认类型为'mv'，可能需要调整
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ search函数发生网络异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- getTracks 和 getPlayinfo 保持不变 ---
async function getTracks(ext) { /* ...代码省略，与之前版本相同... */ }
async function getPlayinfo(ext) { /* ...代码省略，与之前版本相同... */ }

// 为了方便复制，附上无改动的函数
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
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
        return jsonify({ list: [] });
    }
}
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
