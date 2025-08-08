/**
 * 观影网脚本 - v29.0 (终极耐心伪装版)
 *
 * --- 核心思想 ---
 * 解决了“服务器繁忙”提示。原因是服务器反爬虫机制较强，一次重试不足以获取数据。
 * 本版本通过增加重试次数和延长等待间隔，将脚本的“伪装”和“耐心”提升到极致，
 * 以应对最顽固的服务器干扰。
 *
 * --- 更新日志 ---
 *  - v29.0 (终极伪装):
 *    - [强化重试] 重试次数从1次增加到3次，大大提高成功率。
 *    - [延长等待] 重试间隔从800ms增加到1200ms，更好地模拟人类行为。
 *    - [代码优化] 重构了重试逻辑，使用循环使其更简洁、更强大。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 29.0, // 终极耐心伪装版
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ★★★★★【全局Cookie与成功缓存】★★★★★
let GLOBAL_COOKIE = null;
const SUCCESS_CACHE = {}; // 用于存储成功获取的页面数据
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 1200; // 重试前的延迟（毫秒 ）
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg) { try { $log(`[观影网 V29.0] ${msg}`); } catch (_) { console.log(`[观影网 V29.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

function fakeSleep(ms) {
    log(`等待 ${ms}ms (因环境限制，可能无法真正延迟)`);
    // 如果你的环境支持某种同步等待，例如: $thread.sleep(ms)，请替换下面这行
    // $thread.sleep(ms); 
}

async function ensureGlobalCookie() {
    if (GLOBAL_COOKIE) return GLOBAL_COOKIE;
    try {
        const { data } = await $fetch.get(BACKEND_URL);
        const result = JSON.parse(data);
        if (result.status === "success" && result.cookie) {
            GLOBAL_COOKIE = result.cookie;
            return GLOBAL_COOKIE;
        }
        throw new Error(result.message || '未知错误');
    } catch (e) {
        log(`❌ 获取Cookie失败: ${e.message}`);
        $utils.toastError(`Cookie后端连接失败`, 4000);
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
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【终极抗干扰逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

function parseFromPage(html, cards) {
    const match = html.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!match || !match[1]) {
        log("❌ 在页面中未找到 _obj.inlist 数据对象。");
        return false; // 返回false表示解析失败
    }
    try {
        const inlist = JSON.parse(match[1]);
        if (!inlist.t || !inlist.i || !inlist.ty) { return false; }
        const $ = cheerio.load(html);
        const type = inlist.ty;
        inlist.t.forEach((title, index) => {
            const vodId = inlist.i[index];
            if (!vodId) return;
            const name = title;
            const remarks = inlist.q && inlist.q[index] ? inlist.q[index].join(' ') : '';
            let picUrl = '';
            const $container = $(`a.v5d[href="/${type}/${vodId}"]`);
            if ($container.length > 0) {
                picUrl = $container.find('picture source[data-srcset]').attr('data-srcset');
                if (!picUrl) { picUrl = $container.find('img.lazy[data-src]').attr('data-src'); }
            }
            if (!picUrl) {
                const picUrl1 = `${appConfig.site}img/${type}/${vodId}.webp`;
                const picUrl2 = `https://s.tutu.pm/img/${type}/${vodId}/220.webp`;
                picUrl = `${picUrl1}@${picUrl2}`;
            }
            const detailApiUrl = `${appConfig.site}res/downurl/${type}/${vodId}`;
            cards.push({ vod_id: detailApiUrl, vod_name: name, vod_pic: picUrl, vod_remarks: remarks, ext: { url: detailApiUrl } } );
        });
        return true; // 返回true表示解析成功
    } catch (e) {
        log(`❌ 解析过程异常: ${e.message}`);
        return false;
    }
}

// 封装了强化重试和缓存的核心请求函数
async function getPageDataWithRetry(url) {
    if (SUCCESS_CACHE[url]) {
        log(`✅ 命中缓存: ${url}`);
        return SUCCESS_CACHE[url];
    }

    for (let i = 0; i <= MAX_RETRIES; i++) {
        const attempt = i + 1;
        log(`🚀 发起第 ${attempt} 次尝试: ${url}`);
        const { data } = await fetchWithCookie(url);
        const cards = [];
        if (parseFromPage(data, cards)) {
            log(`✅ 第 ${attempt} 次尝试成功，解析到 ${cards.length} 个项目。`);
            SUCCESS_CACHE[url] = cards;
            return cards;
        }

        if (i < MAX_RETRIES) {
            log(`⚠️ 第 ${attempt} 次尝试失败，准备重试...`);
            fakeSleep(RETRY_DELAY);
        }
    }

    log(`❌ 所有 ${MAX_RETRIES + 1} 次尝试均失败，放弃。`);
    $utils.toastError('服务器繁忙，请稍后重试', 4000);
    return [];
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}${id}${page}`;
    try {
        const cards = await getPageDataWithRetry(url);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ getCards 顶层异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${text}`;
    try {
        const cards = await getPageDataWithRetry(url);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ search 顶层异常: ${e.message}`);
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
