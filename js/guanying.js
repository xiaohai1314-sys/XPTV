/**
 * 观影网脚本 - V21.0 (隔山打牛最终版)
 *
 * --- 核心思想 ---
 * 彻底接受V17.0是唯一能成功加载列表的“圣经版本”这一事实。
 * 之前所有对 getCards 函数的修改，无论多么微小，均告失败。
 * 
 * 本版本采用“隔山打牛”策略，将海报问题的解决战场从 getCards 彻底转移
 * 到 getTracks 函数，以保证 getCards 的绝对纯洁和稳定。
 *
 * --- 实现方式 ---
 * 1. 【getCards】: 100%恢复到最原始、最纯净的V17.0版本，确保列表加载万无一失。
 * 2. 【getTracks】: 功能升级。在获取播放列表的同时，增加解析详情页HTML的功能，
 *    从中提取最准确的海报图片URL。
 * 3. 【数据流】: getTracks 会将这个新找到的、正确的`vod_pic`返回给App。
 *    App在获取到播放列表后，会用这个新URL刷新并修正当前影片的海报。
 * 4. 此方案完美分离了“列表加载”和“海报修正”两个任务，互不干扰，兼顾了
 *    稳定性和功能完善性，是当前问题的最终解决方案。
 */

// ================== 配置区 (与V17.0完全一致) ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: "21.0", // 版本号明确为最终解决方案
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

// ================== 核心函数 (与V17.0完全一致 ) ==================
function log(msg  ) { try { $log(`[观影网 V21.0] ${msg}`); } catch (_) { console.log(`[观影网 V21.0] ${msg}`); } }
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards: 100%纯净的V17.0版本】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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
                cards.push({
                    vod_id: detailApiUrl,
                    vod_name: inlistData.t[index],
                    vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
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

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getTracks: 海报修正功能增强版】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.url; 
    log(`请求详情数据: ${url}`);
    
    // 初始化一个空的返回对象
    let result = {
        list: [{ title: '默认分组', tracks }],
        // ext: {} // 这里可以放额外信息，比如修正后的海报
    };

    try {
        // 【第一步】获取详情页的API数据（包含播放列表）
        const { data: apiData } = await fetchWithCookie(url);
        const respstr = JSON.parse(apiData);

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

        // 【第二步】获取详情页的HTML页面，用于修正海报
        // API URL: https://www.gying.org/res/downurl/mv/OLpg
        // 我们需要把 /res/downurl/ 替换掉 ，得到HTML页面URL
        const htmlUrl = url.replace('/res/downurl/', '/');
        log(`请求详情页HTML用于修正海报: ${htmlUrl}`);
        const { data: htmlData } = await fetchWithCookie(htmlUrl);
        const $ = cheerio.load(htmlData);
        
        // 从详情页HTML中找到真实的海报图
        const realPic = $('.v-thumb picture source[data-srcset]').attr('data-srcset');
        if (realPic) {
            log(`✅ 成功找到修正海报: ${realPic}`);
            // 将修正后的海报图放入返回结果的ext中
            result.ext = { vod_pic: realPic };
        }

        return jsonify(result);

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        // 即使发生错误，也返回已有的播放列表（如果解析成功的话）
        return jsonify(result);
    }
}

// ================== 其他函数 (与V17.0完全一致) ==================
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
