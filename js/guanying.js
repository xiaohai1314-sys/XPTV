/**
 * Gying 前端插件 - 返璞归真版 v1.8.0
 * 
 * 作者: 基于所有尝试失败后的最终回归
 * 版本: v1.8.0
 * 更新日志:
 * v1.8.0:
 * 1. 【返璞归真】放弃所有分步、分层、状态管理、自定义指令和需要多次请求的复杂逻辑。
 * 2. 【一次性加载】getTracks 函数现在只做一件事：从后端获取所有资源，然后按“网盘类型”分组，一次性全部渲染到屏幕上。
 * 3. 【最简化】getPlayinfo 函数回归本源，只负责返回真实的、可播放的网盘链接。
 * 4. 【后端解耦】此版本不再需要后端的 /api/ui 接口，只依赖最基础的 /api/detail 接口。
 * 5. 【目标】首要目标是确保能成功显示出资源列表。这是所有后续优化的基础。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.8.0] ${msg}`); } else { console.log(`[Gying v1.8.0] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (基础版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards }); }

// 【核心】返璞归真的 getTracks 函数
async function getTracks(ext) {
    const vod_id = typeof ext === 'string' ? ext : (ext.vod_id || ext.url || ext.id);
    if (!vod_id) {
        log("错误：getTracks 未能获取到 vod_id");
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '缺少影片ID', pan: '' }] }] });
    }

    log(`getTracks 调用，请求后端 detail: vod_id=${vod_id}`);
    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.vod_play_url) {
        log(`获取详情失败或无资源: ${data.error || 'vod_play_url为空'}`);
        return jsonify({ list: [{ title: '在线', tracks: [{ name: '暂无任何有效网盘资源', pan: '' }] }] });
    }

    const resources = data.vod_play_url.split('#').map(item => {
        const parts = item.split('$');
        if (parts.length < 2) return null;
        return { title: parts[0], link: parts[1], type: detectPanType(parts[0]) };
    }).filter(Boolean);

    if (resources.length === 0) {
        return jsonify({ list: [{ title: '在线', tracks: [{ name: '暂无任何有效网盘资源', pan: '' }] }] });
    }

    // 按网盘类型对所有资源进行分组
    const groupedResources = resources.reduce((acc, r) => {
        if (!acc[r.type]) {
            acc[r.type] = [];
        }
        acc[r.type].push(r);
        return acc;
    }, {});

    // 为每个分组创建一个播放列表
    const resultLists = Object.keys(groupedResources).map(typeCode => {
        const typeName = PAN_TYPE_MAP[typeCode] || '未知';
        const tracks = groupedResources[typeCode].map(r => ({
            name: r.title,
            pan: r.link // 直接是最终播放链接
        }));
        return {
            title: `🗂️ ${typeName} (${tracks.length})`,
            tracks: tracks
        };
    });

    log(`UI构建完成，共 ${resultLists.length} 个播放列表。`);
    return jsonify({ list: resultLists });
}

// 【核心】返璞归真的 getPlayinfo 函数
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    log(`请求播放链接: ${panUrl}`);
    // 直接返回播放链接，不做任何其他操作
    return jsonify({ urls: [{ name: '即将跳转...', url: panUrl }] });
}

// ==================== 标准接口转发 (无需修改) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.8.0 (返璞归真版)');
