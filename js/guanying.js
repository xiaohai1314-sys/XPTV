/**
 * Gying 前端插件 - 流程图复刻版 v1.4.0
 * 
 * 作者: 基于用户流程图需求重构
 * 版本: v1.4.0
 * 更新日志:
 * v1.4.0:
 * 1. 【流程复刻】完全按照用户提供的四步流程图重构 getTracks 和 getPlayinfo。
 * 2. 【后端协同】能够正确解析后端 v22.4 返回的、包含自定义指令的 "文件夹" 数据。
 * 3. 【分步渲染】getTracks 负责渲染第一步（网盘分类）。
 * 4. 【分步渲染】getPlayinfo 负责处理所有后续步骤的点击事件：
 *    - 点击“夸克网盘”，刷新并显示第二步（网盘[夸]）。
 *    - 点击“网盘[夸]”，刷新并显示第三步（文件夹）。
 *    - 点击“文件夹”，刷新并显示第四步（视频文件）。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.4.0] ${msg}`); } else { console.log(`[Gying v1.4.0] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
let fullResourceCache = [];
let currentVodId = '';

// ==================== XPTV App 标准接口 (无需修改) ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (流程图版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// --- 【核心】v1.4.0 getTracks 函数 ---
// 只负责渲染第一步：网盘分类
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || (typeof ext === 'string' ? ext : '');
    log(`getTracks 调用 (第一步): vod_id=${vod_id}`);

    if (vod_id !== currentVodId) {
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        if (data.error || !data.list || !data.list[0] || !data.list[0].vod_play_url) {
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
        }
        fullResourceCache = data.list[0].vod_play_url.split('#').map(item => {
            const parts = item.split('$');
            if (parts.length < 2) return null;
            return { title: parts[0], link: parts[1], type: detectPanType(parts[0]) };
        }).filter(Boolean);
        currentVodId = vod_id;
        log(`资源缓存成功，共 ${fullResourceCache.length} 条。`);
    }

    const panTypeCounts = fullResourceCache.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {});

    const panFilterButtons = [];
    Object.keys(PAN_TYPE_MAP).forEach(typeCode => {
        if (panTypeCounts[typeCode]) {
            panFilterButtons.push({
                name: `${PAN_TYPE_MAP[typeCode]} (${panTypeCounts[typeCode]})`,
                pan: `custom:action=show_pans&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
            });
        }
    });

    return jsonify({ list: [{ title: '云盘', tracks: panFilterButtons }] });
}

// --- 【核心】v1.4.0 getPlayinfo 函数 ---
// 负责处理所有后续步骤的点击事件
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    if (!panUrl.startsWith('custom:')) {
        log(`第四步: 最终播放/转存链接: ${panUrl}`);
        return jsonify({ urls: [{ name: '即将跳转，请在网盘内操作', url: panUrl }] });
    }

    log(`捕获到自定义指令: ${panUrl}`);
    const paramsStr = panUrl.replace('custom:', '');
    const params = new URLSearchParams(paramsStr);
    const action = params.get('action');
    const vod_id = params.get('url');
    const pan_type = params.get('pan_type');

    let tracks = [];
    let title = '';

    if (action === 'show_pans') {
        // 第二步: 显示 网盘[夸], 网盘[翼]...
        log(`执行第二步: 显示 ${PAN_TYPE_MAP[pan_type]} 的资源列表`);
        title = `云盘 - ${PAN_TYPE_MAP[pan_type]}`;
        const filtered = fullResourceCache.filter(r => r.type === pan_type);
        tracks = filtered.map(r => ({
            name: `网盘 [${PAN_TYPE_MAP[r.type]}]`,
            sub: r.title,
            pan: r.link // 注意：这里的 link 是后端的自定义指令 "custom:action=show_files..."
        }));
    } else if (action === 'show_files') {
        // 第三步: 显示文件夹
        const originalTitle = decodeURIComponent(params.get('title'));
        log(`执行第三步: 显示文件夹 "${originalTitle}"`);
        title = `文件夹`;
        tracks = [{
            name: `🗂️ ${originalTitle}`,
            // 点击文件夹后，直接把最终的网盘链接作为 pan，触发第四步
            pan: decodeURIComponent(params.get('link')) 
        }];
    }

    // 通过 rerun 刷新UI，显示当前步骤的内容
    const rerunExt = {
        // 使用一个特殊的 vod_id 来告诉 getTracks 不要重新请求，而是直接渲染我们构造好的数据
        id: `rerun:${jsonify({ list: [{ title: title, tracks: tracks }] })}`,
        url: `rerun:${jsonify({ list: [{ title: title, tracks: tracks }] })}`
    };
    
    // XPTV/影视TV的特殊技巧：当 id/url 以 "rerun:" 开头时，
    // 它会直接用后面的 JSON 来渲染页面，而不是调用插件的 detail 方法。
    return jsonify({ urls: [{ name: '加载中...', url: `rerun://${jsonify(rerunExt)}` }] });
}

// ==================== 标准接口转发 (无需修改) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.4.0 (流程图复刻版)');
