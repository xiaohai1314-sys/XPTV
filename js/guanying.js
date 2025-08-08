/**
 * 观影网脚本 - v25.0 (智能提取终极版)
 *
 * --- 核心思想 ---
 * 经历了所有问题的洗礼，我们回归问题的本质：海报URL规则不统一。
 * 本版本放弃了所有固定的URL拼接猜测，采用最可靠的“智能提取”方案。
 * 它会像浏览器一样，直接在实时的HTML内容中寻找真正的海报地址，
 * 从而一劳永逸地解决部分海报丢失的问题。
 *
 * --- 海报获取方案 (终极版) ---
 * 1. [首选-智能提取] 通过Cheerio解析HTML，优先查找并使用`data-srcset`或`data-src`属性中的URL。这是最准确的方案。
 * 2. [备用-拼接兼容] 如果HTML中实在找不到海报信息（极罕见），则启用`主站URL@图床URL`的双保险拼接作为最后防线。
 *
 * --- 更新日志 ---
 *  - v25.0 (AI集大成):
 *    - [终极方案] `parseFromPage`函数回归并修正了HTML解析逻辑，智能提取海报URL。
 *    - [多重查找] 能同时处理`<picture><source data-srcset>`和`<img> data-src`两种HTML结构。
 *    - [保留优化] 继承了v24版本的反爬虫延迟和Cookie缓存机制，确保稳定性。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 25.0, // 智能提取终极版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie与延迟管理】★★★★★
let GLOBAL_COOKIE = null;
let LAST_FETCH_TIME = 0;
const COOKIE_CACHE_DURATION = 10 * 60 * 1000; // 10分钟
const REQUEST_DELAY = 500; // 500毫秒
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V25.0] ${msg}`); } catch (_) { console.log(`[观影网 V25.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function ensureGlobalCookie() {
    const now = Date.now();
    if (GLOBAL_COOKIE && (now - LAST_FETCH_TIME < COOKIE_CACHE_DURATION)) {
        log("✅ 从内存缓存中恢复了Cookie！");
        return GLOBAL_COOKIE;
    }
    log("内存缓存失效或首次加载，将从后端获取Cookie...");
    try {
        const response = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(response.data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            LAST_FETCH_TIME = Date.now();
            log("✅ 成功从后端获取并缓存了全局Cookie！");
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【智能提取终极逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parseFromPage(html, cards) {
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return;
    }
    try {
        const inlist = JSON.parse(match[1]);
        if (!inlist.t || !inlist.i || !inlist.ty) { return; }

        const $ = cheerio.load(html);
        const type = inlist.ty;

        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return;

            const name = title;
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            
            // ★★★ 智能提取核心逻辑 ★★★
            let picUrl = '';
            
            // 定位到影片的链接元素<a>，它本身就是容器
            const $container = $(`a.v5d[href="/${type}/${vodId}"]`);

            if ($container.length > 0) {
                // 方案一: 尝试从 <picture><source> 获取
                picUrl = $container.find('picture source[data-srcset]').attr('data-srcset');
                // 方案二: 如果方案一失败，尝试从 <img> 获取
                if (!picUrl) {
                    picUrl = $container.find('img.lazy[data-src]').attr('data-src');
                }
            }
            
            // ★★★ 备用拼接方案 ★★★
            // 如果以上两种HTML解析都失败，则启用双保险拼接规则
            if (!picUrl) {
                log(`⚠️ [${name}] HTML提取失败, 启用备用拼接方案。`);
                const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`;
                const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
                picUrl = `${picUrl1}@${picUrl2}`;
            }
            
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarks, ext: { url: detailApiUrl } } );
        });
    } catch (e) { log(`❌ 解析过程异常: ${e.message}`); }
}

// getCards 和 search 函数调用最终的解析函数
async function getCards(ext) {
    ext = argsify(ext);
    let cards = [];
    let { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    log(`请求分类列表: ${url}`);
    try {
        await sleep(REQUEST_DELAY);
        const { data } = await fetchWithCookie(url); 
        parseFromPage(data, cards);
        log(`✅ 成功通过智能提取模式解析到 ${cards.length} 个项目。`);
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
        await sleep(REQUEST_DELAY);
        const { data } = await fetchWithCookie(url);
        let cards = [];
        parseFromPage(data, cards);
        log(`✅ 成功从搜索结果中解析到 ${cards.length} 个项目。`);
        return jsonify({ list: cards });
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
