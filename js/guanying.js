/**
 * 观影网脚本 - v28.0 (终极抗干扰版)
 *
 * --- 核心思想 ---
 * 解决了列表“时好时坏、突然消失”的终极问题。根源在于观影网高级的反爬虫机制，
 * 它会在用户请求频繁时，返回一个不包含关键数据(_obj.inlist)的“假”HTML。
 * 本版本引入“智能重试”和“成功缓存”两大核心机制，有效对抗服务器干扰。
 *
 * --- 更新日志 ---
 *  - v28.0 (终极抗干扰):
 *    - [智能重试] 当获取的HTML不含数据时，脚本会自动延迟并重试一次，大大提高成功率。
 *    - [成功缓存] 成功获取的页面数据会被缓存在内存中，避免因快速切换等操作重复请求，从根源上降低触发反爬虫的概率。
 *    - [代码重构] 对核心请求和解析逻辑进行了封装，使其更健壮、更清晰。
 *    - [兼容性] 继承v27的无延迟框架和智能海报提取方案。
 */

// ================== 配置区 ==================
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.111:5000/getCookie'; 

const appConfig = {
    ver: 28.0, // 终极抗干扰版
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
const RETRY_DELAY = 800; // 重试前的延迟（毫秒 ）
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★

// ================== 核心函数 ==================

function log(msg) { try { $log(`[观影网 V28.0] ${msg}`); } catch (_) { console.log(`[观影网 V28.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// 由于环境不支持setTimeout，我们用一个“假”的延迟函数占位，实际依赖于你的App环境可能存在的某种形式的阻塞或等待。
// 如果你的环境有同步sleep，可以替换这里。如果没有，重试机制会快速连续执行。
function fakeSleep(ms) {
    // 这是一个无奈之举，因为标准setTimeout不可用。
    // 在不支持任何形式延迟的环境中，重试会几乎立即发生。
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

// 封装了重试和缓存的核心请求函数
async function getPageDataWithRetry(url) {
    // 1. 检查缓存
    if (SUCCESS_CACHE[url]) {
        log(`✅ 命中缓存: ${url}`);
        return SUCCESS_CACHE[url];
    }

    // 2. 第一次尝试
    log(`🚀 发起请求: ${url}`);
    let { data } = await fetchWithCookie(url);
    let cards = [];
    if (parseFromPage(data, cards)) {
        log(`✅ 首次尝试成功，解析到 ${cards.length} 个项目。`);
        SUCCESS_CACHE[url] = cards; // 存入缓存
        return cards;
    }

    // 3. 如果失败，进行重试
    log(`⚠️ 首次尝试失败，准备重试...`);
    fakeSleep(RETRY_DELAY); // 等待
    log(`🚀 发起重试: ${url}`);
    let response = await fetchWithCookie(url);
    data = response.data;
    cards = [];
    if (parseFromPage(data, cards)) {
        log(`✅ 重试成功，解析到 ${cards.length} 个项目。`);
        SUCCESS_CACHE[url] = cards; // 存入缓存
        return cards;
    }

    // 4. 重试仍然失败
    log(`❌ 重试失败，放弃。`);
    $utils.toastError('服务器繁忙，请稍后重试', 4000);
    return []; // 返回空列表
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
