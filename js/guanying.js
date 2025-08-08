/**
 * 观影网脚本 - v47.0 (隔离与重生版)
 *
 * --- 核心思想 ---
 * 彻底废弃v45.1中引发“Cookie风暴”的、错误的全局fetchWithCookie设计。
 * 回归最简单、最可靠的架构：getCards和getTracks的功能完全隔离，
 * getTracks在需要时独立获取Cookie，互不干扰，从根本上杜绝后台资源耗尽和APP假死问题。
 *
 * --- 更新日志 ---
 *  - v47.0 (隔离与重生版):
 *    - 【彻底移除】删除了所有全局的Cookie缓存变量和错误的fetchWithCookie函数。
 *    - 【功能隔离】getCards只负责请求列表API，不触碰任何Cookie逻辑。
 *    - 【独立工作】getTracks在被调用时，才独立、一次性地去请求Cookie，并用于当次的详情页访问。
 *    - 【拨乱反正】这是对之前所有错误设计的一次彻底清算，旨在实现一个真正稳定、可靠的系统。
 */

// ================== 配置区 ==================
const LIST_API_URL = 'http://192.168.1.4:5000/api/movies'; 
const COOKIE_API_URL = 'http://192.168.1.4:5000/getCookie';

const appConfig = {
    ver: "47.0 (隔离重生 )",
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg ) { try { $log(`[观影网 V47.0] ${msg}`); } catch (_) { console.log(`[观影网 V47.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 列表获取 (纯净版) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const page = ext.page || 1;
    const category = ext.id || 'mv';

    const url = `${LIST_API_URL}?category=${category}&page=${page}`;
    log(`请求列表API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        log(`✅ 成功从后端获取到列表数据。`);
        return data; 
    } catch (e) {
        log(`❌ 请求列表API失败: ${e.message}`);
        $utils.toastError(`加载失败: 无法连接数据中心`, 4000);
        return jsonify({ list: [] });
    }
}

async function search(ext) {
    $utils.toast("搜索功能正在开发中...", 2000);
    return jsonify({ list: [] });
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 详情获取 (独立版) ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    
    let detailApiUrl = ext.vod_id; 
    if (!detailApiUrl) { return jsonify({ list: [] }); }

    log(`准备请求详情数据: ${detailApiUrl}`);
    try {
        // 1. 独立、一次性地获取Cookie
        log("正在为详情页独立获取Cookie...");
        let cookie = "";
        try {
            const { data: cookieData } = await $fetch.get(COOKIE_API_URL);
            const result = JSON.parse(cookieData);
            if (result.status === "success" && result.cookie) {
                cookie = result.cookie;
                log("✅ 成功获取到当次有效的Cookie。");
            }
        } catch (cookieError) {
            log(`⚠️ 获取Cookie失败: ${cookieError.message}，将尝试无Cookie访问...`);
        }

        // 2. 使用获取到的Cookie，请求详情API
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 
            'Cookie': cookie, 
            'Referer': appConfig.site 
        };
        const { data } = await $fetch.get(detailApiUrl, { headers });

        // 3. 解析网盘资源
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
            log(`✅ 成功解析到 ${tracks.length} 条网盘链接。`);
        } else if (respstr.hasOwnProperty('file')) {
            $utils.toastError('网盘验证掉签，请前往主站完成验证或更新Cookie');
        } else {
            $utils.toastError('没有找到网盘资源');
        }
        return jsonify({ list: [{ title: '默认分组', tracks }] });

    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`详情加载失败: ${e.message}`);
        return jsonify({ list: [] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
