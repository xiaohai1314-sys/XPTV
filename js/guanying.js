/**
 * 观影网脚本 - v18.2 (终极完整版)
 *
 * --- 核心思想 ---
 * 将所有数据抓取、Cookie维护、HTML解析等复杂任务全部交由后端服务器处理。
 * 前端脚本变得极度轻量，只负责调用后端API并展示数据，从而实现最佳性能和稳定性。
 *
 * --- v18.2 更新日志 ---
 * 1. 【分页控制】search函数现在会处理并返回后端提供的 pagecount 字段，实现精准分页。
 * 2. 【分类修正】修正了 appConfig 中分类 id 的错误格式，确保分类页能正常加载。
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
// ★ 指向你的后端服务器地址
const BACKEND_URL = 'http://192.168.1.7:5000'; 

const appConfig = {
    ver: 18.2, // 版本号更新
    title: '观影网 (后端版 )',
    site: 'https://www.gying.org/',
    tabs: [
        // 【核心修改】id只保留纯粹的分类名
        { name: '电影', ext: { id: 'mv' } },
        { name: '剧集', ext: { id: 'tv' } },
        { name: '动漫', ext: { id: 'ac' } },
    ],
};

// ================== 核心函数 ==================

function log(msg  ) { try { $log(`[观影网 V18.2] ${msg}`); } catch (_) { console.log(`[观影网 V18.2] ${msg}`); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- init ---
async function init(ext) {
    return jsonify({});
}

// --- getConfig ---
async function getConfig() {
    return jsonify(appConfig);
}

// =======================================================================
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼【核心API调用逻辑】▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// =======================================================================

// --- getCards ---
async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        log(`✅ 成功从后端获取到 ${result.list.length} 个项目。`);
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 请求后端卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- getTracks ---
async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url; 
    const url = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(detailUrl)}`;
    log(`请求后端获取详情数据: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        if (result.message) {
            $utils.toastError(result.message, 4000);
        }
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- search ---
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text;
    const page = ext.page || 1;
    
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}&page=${page}`;
    log(`请求后端执行搜索: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data); // result 现在包含 list 和 pagecount
        
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        
        log(`✅ 成功从后端获取到 ${result.list.length} 个搜索结果。`);
        
        // 【核心修改】将后端返回的 list 和 pagecount 一起传递给App框架
        // App框架接收到 pagecount 后，会知道总页数，从而不再请求多余的页面。
        return jsonify({ 
            list: result.list,
            pagecount: result.pagecount || 0 // 如果后端没提供，默认为0，让App自行判断
        });
        
    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// --- getPlayinfo ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}
