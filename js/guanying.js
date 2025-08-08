/**
 * 观影网脚本 - v44.0 (纯展示版)
 *
 * --- 核心思想 ---
 * 采用全新的前后端分离架构。前端不再负责任何解析、处理数据的复杂工作。
 * 所有的数据请求都指向我们自己的、可靠的后端数据中心。
 * 前端脚本的任务被简化为：请求后端API -> 接收干净的JSON -> 渲染UI。
 * 这个版本应该极其稳定，未来几乎不需要再进行维护。
 *
 * --- 更新日志 ---
 *  - v44.0 (纯展示版):
 *    - 【架构革新】getCards/search函数不再请求观影网，而是请求我们自己的后端API (/api/movies)。
 *    - 【逻辑简化】彻底移除了所有前端解析逻辑（cheerio, parsePage），代码量大幅减少。
 *    - 【终极稳定】前端不再受目标网站前端变化的影响，只要后端API不变，前端就永远可用。
 */

// ================== 配置区 ==================
const BACKEND_API_URL = 'http://192.168.10.111:5000/api/movies'; 

const appConfig = {
    ver: 44.0, // 纯展示版
    title: '观影网',
    site: 'https://www.gying.org/', // site 字段可能仍需保留 ，以备后用
    tabs: [
        { name: '电影', ext: { category: 'mv' } }, // 参数改为 category
        { name: '剧集', ext: { category: 'tv' } },
        { name: '动漫', ext: { category: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg) { try { $log(`[观影网 V44.0] ${msg}`); } catch (_) { console.log(`[观影网 V44.0] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify(appConfig); }

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【★ 全新、简化的数据获取逻辑 ★】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, category } = ext;
    
    // 拼接请求我们自己后端的URL
    const url = `${BACKEND_API_URL}?category=${category}&page=${page}`;
    log(`请求后端API: ${url}`);
    
    try {
        const { data } = await $fetch.get(url);
        // 后端已经返回了完美的JSON，直接使用即可
        log(`✅ 成功从后端获取到 ${JSON.parse(data).list.length} 个项目。`);
        return data; 
    } catch (e) {
        log(`❌ 请求后端API失败: ${e.message}`);
        $utils.toastError(`加载失败: 无法连接数据中心`, 4000);
        return jsonify({ list: [] });
    }
}

// 搜索功能暂时未实现，返回空列表
async function search(ext) {
    $utils.toast("搜索功能正在开发中...", 2000);
    return jsonify({ list: [] });
}

// --- getTracks 和 getPlayinfo 保持不变，因为它们请求的详情API地址是后端拼好的 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let tracks = [];
    let url = ext.vod_id; // ★ 注意：现在从 vod_id 获取URL
    log(`请求详情数据: ${url}`);
    try {
        // ★ 注意：详情页请求可能仍需带Cookie，所以我们保留一个独立的fetchWithCookie
        const cookie = await $prefs.get('gying_v44_cookie_cache'); // 尝试获取一个有效的cookie
        const headers = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)', 'Cookie': cookie, 'Referer': appConfig.site };
        const { data } = await $fetch.get(url, { headers });

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
