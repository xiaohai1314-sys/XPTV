/**
 * 观影网脚本 - v19.0 (王者归来最终版)
 *
 * --- 核心思想 ---
 * 基于用户提供的最新HTML源码进行最终诊断：网站前端渲染方式已改变，
 * 页面不再直接输出HTML列表，而是将所有数据（包括列表）注入到一个
 * 名为 `_obj.inlist` 的JS变量中。
 *
 * 这证明了V17.0版本的核心解析逻辑是完全正确的。之前版本（V18.0）
 * 尝试解析HTML元素，因元素不存在而失败。
 *
 * 本版本是集大成者：
 * 1. 采用了V17.5中已验证稳定的后端通信和错误处理机制。
 * 2. 将 `getCards` 函数的解析引擎，完全恢复至V17.0的、与当前网站
 *    结构100%匹配的JS变量解析方案。
 * 3. 这是结合了所有修复和正确诊断的最终稳定版本。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 
const FALLBACK_PIC = 'https://img.zcool.cn/community/01a24459a334e0a801211d81792403.png';

const appConfig = {
    ver: "19.0", // 版本号明确为“王者归来最终版”
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

// ================== 核心函数 (保持V17.5的稳定状态 ) ==================
function log(msg ) { try { $log(`[观影网 V19.0] ${msg}`); } catch (_) { console.log(`[观影网 V19.0] ${msg}`); } }
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
        log(`❌ 从后端获取Cookie失败: ${result.message || '未知错误'}`);
        $utils.toastError(`获取Cookie失败: ${result.message || '未知错误'}`, 4000);
    } catch (e) {
        log(`❌ 网络请求后端失败: ${e.message}`);
        $utils.toastError(`无法连接Cookie后端: ${e.message}`, 5000);
    }
    return null; 
}
async function fetchWithCookie(url, options = {}) {
    const cookie = await ensureGlobalCookie();
    const headers = { 'User-Agent': UA, 'Cookie': cookie, 'Referer': appConfig.site, ...options.headers };
    return $fetch.get(url, { ...options, headers });
}
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【getCards 核心函数 - 回归V17.0正确解析引擎】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
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

        // 从HTML中找到那个独一无二的、包含所有数据的<script>标签
        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.inlist');
        }).html();

        if (scriptContent) {
            // 使用正则表达式从脚本内容中精确提取 _obj.inlist 的JSON数据
            const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
            
            if (inlistMatch && inlistMatch[1]) {
                try {
                    const inlistData = JSON.parse(inlistMatch[1]);
                    // 确认数据结构符合预期
                    if (inlistData && inlistData.i && inlistData.t) {
                        inlistData.i.forEach((item, index) => {
                            const detailApiUrl = `${appConfig.site}res/downurl/${inlistData.ty}/${item}`;
                            cards.push({
                                vod_id: detailApiUrl,
                                vod_name: inlistData.t[index],
                                // 继续使用稳定可靠的图片拼接方式
                                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                                // 备注信息现在在 inlistData.q 数组里
                                vod_remarks: (inlistData.q[index] && inlistData.q[index].join(' ' )) || '',
                                ext: { url: detailApiUrl },
                            });
                        });
                        log(`✅ 成功从JS变量中解析到 ${cards.length} 个项目。`);
                    }
                } catch (parseError) {
                    log(`❌ 解析inlist数据时发生错误: ${parseError.message}`);
                }
            } else {
                log("⚠️ 在script中未能用正则匹配到'_obj.inlist'数据。");
            }
        } else {
            log("⚠️ 未能找到包含'_obj.inlist'的关键script标签。");
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`❌ 获取卡片列表时发生严重异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// ================== 其他函数保持原封不动 ==================
// search 函数可能需要根据实际搜索页面的HTML结构进行调整，暂时保持原样
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
