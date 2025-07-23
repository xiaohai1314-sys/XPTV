/**
 * Gying 前端插件 - 无状态前端版 v1.7.0
 * 
 * 作者: 基于兼容性问题的最终解决方案
 * 版本: v1.7.0
 * 更新日志:
 * v1.7.0:
 * 1. 【最终架构】彻底放弃了所有前端状态管理和刷新机制 (rerun, $xgext)。
 * 2. 【无状态化】前端插件不再管理 step，只负责将用户的操作转换成对后端新接口 /api/ui 的请求。
 * 3. 【后端驱动】所有UI渲染逻辑和状态管理完全转移到后端，前端只负责展示后端返回的JSON。
 * 4. 【兼容性保证】此架构不依赖任何播放器特殊协议，仅使用标准HTTP请求，兼容性达到最大化。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.7.0] ${msg}`); } else { console.log(`[Gying v1.7.0] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (稳定版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards }); }

// 【核心】getTracks 现在只负责调用后端的 /api/ui 接口
async function getTracks(ext) {
    const vod_id = typeof ext === 'string' ? ext : (ext.vod_id || ext.url || ext.id);
    if (!vod_id) {
        log("错误：getTracks 未能获取到 vod_id");
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '缺少影片ID', pan: '' }] }] });
    }
    log(`getTracks 调用，请求后端UI: vod_id=${vod_id}`);
    // 直接请求后端 /api/ui 接口，让后端处理第一步的渲染
    const uiUrl = `${API_BASE_URL}/ui?step=1&vod_id=${encodeURIComponent(vod_id)}`;
    const data = await request(uiUrl);
    return jsonify(data);
}

// 【核心】getPlayinfo 现在也只负责调用后端的 /api/ui 接口
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    // 如果是最终播放链接，直接返回
    if (!panUrl.startsWith('custom:')) {
        log(`第四步: 最终播放/转存链接: ${panUrl}`);
        return jsonify({ urls: [{ name: '即将跳转，请在网盘内操作', url: panUrl }] });
    }

    log(`捕获到自定义指令: ${panUrl}`);
    const paramsStr = panUrl.replace('custom:', '');
    
    // 将指令中的所有参数，原封不动地拼接到 /api/ui 的请求URL上
    const uiUrl = `${API_BASE_URL}/ui?${paramsStr}`;
    log(`准备请求后端UI: ${uiUrl}`);

    // 【重要】返回一个特殊的URL，让播放器去请求我们的后端UI接口
    // 播放器请求这个URL后，会得到一个JSON，它会用这个JSON来渲染详情页
    return jsonify({
        "list": [
            {
                "title": "加载中...",
                "tracks": [
                    {
                        "name": "请稍候...",
                        "pan": `json:${uiUrl}` // 使用 json: 协议，兼容性非常好
                    }
                ]
            }
        ]
    });
}

// ==================== 标准接口转发 (无需修改) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.7.0 (无状态前端版)');
