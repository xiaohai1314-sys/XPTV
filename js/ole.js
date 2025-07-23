/**
 * Gying 前端插件 - 终极版 (二级钻取·智能UI)
 *
 * 目标: 结合所有讨论成果，实现一个能在Apple TV上运行的、拥有二级钻取功能、
 *       且UI细节优雅的最终方案。
 * 架构: 前后端分离。
 * 交互: 先按网盘分类，再展示智能标题的资源列表。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://YOUR_SERVER_IP:3001/api';
// ===============================================

// 全局缓存 ，用于存储从后端获取的完整资源列表
let detailCache = {
    vod_id: '',
    resources: []
};

// ... 其他工具函数和配置保持不变 ...
function log(msg) { try { if (typeof $log === 'function') { $log(`[GyingFE] ${msg}`); } else { console.log(`[GyingFE] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': "Mozilla/5.0 (AppleTV...)" }, timeout: 15000 }); if (status !== 200) return { error: `HTTP ${status}` }; return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '夸克盘', '1': '迅雷盘', '2': '夸克盘', '3': '阿里盘', '4': '天翼盘', '5': '115盘', '6': 'UC盘', 'unknown': '未知盘' };
const PAN_TYPE_MAP_SHORT = { '0': '百', '1': '迅', '2': '夸', '3': '阿', '4': '天', '5': '115', '6': 'UC', 'unknown': '?' };
const KEYWORD_REGEX = { '4K': /4K/i, '2160p': /2160p/i, '1080p': /1080p/i, '720p': /720p/i, 'Remux': /Remux/i, '原盘': /原盘/i, '杜比': /杜比/i };

// ==================== XPTV App 标准接口 ====================
async function getConfig() { return jsonify({ ver: 1, title: 'Gying (终极版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// --- 【第一步】进入详情页，获取数据并显示分类入口 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`详情页加载(第一步): ${vod_id}`);

    if (!vod_id) return jsonify({ list: [] });

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || !data.list[0].vod_play_url) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }

    const playUrlString = data.list[0].vod_play_url;
    
    // 1. 解析并缓存所有资源
    const allResources = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (parts.length < 2) return null;
        return { title: parts[0].trim(), link: parts[1].trim(), type: detectPanType(parts[0]) };
    }).filter(Boolean);

    detailCache.vod_id = vod_id;
    detailCache.resources = allResources;

    // 2. 按网盘类型聚合，统计数量
    const resourcesByType = allResources.reduce((acc, res) => {
        if (!acc[res.type]) acc[res.type] = [];
        acc[res.type].push(res);
        return acc;
    }, {});

    // 3. 生成分类入口按钮
    const tracks = Object.keys(resourcesByType).map(typeCode => {
        const count = resourcesByType[typeCode].length;
        const typeName = PAN_TYPE_MAP[typeCode] || '未知盘';
        // 关键：按钮绑定一个 custom 指令，用于触发第二步
        return {
            name: `${typeName} (${count}个资源)`,
            pan: `custom:action=show_list&type=${typeCode}&vod_id=${encodeURIComponent(vod_id)}`
        };
    });

    if (tracks.length === 0) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '无有效资源', pan: '' }] }] });
    }

    return jsonify({ list: [{ title: '选择网盘类型', tracks: tracks }] });
}

// --- 【第二步】处理指令，显示特定分类下的、带智能标题的资源列表 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const { type: panType, vod_id } = ext;
    log(`钻取(第二步): 显示类型为 ${panType} 的资源`);

    // 安全检查：确保缓存是当前影片的
    if (detailCache.vod_id !== vod_id) {
        log('缓存不匹配，需要重新加载详情页');
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '缓存失效，请返回重试', pan: '' }] }] });
    }

    // 1. 从缓存中筛选出指定类型的资源
    const filteredResources = detailCache.resources.filter(r => r.type === panType);

    // 2. 为这些资源生成最终的、可播放的按钮列表（使用智能短标题）
    const tracks = filteredResources.map(r => {
        let smartName = '';
        for (const keyword in KEYWORD_REGEX) {
            if (KEYWORD_REGEX[keyword].test(r.title)) {
                smartName += `${keyword} `;
            }
        }
        if (smartName === '') smartName = '资源';
        const shortTypeName = PAN_TYPE_MAP_SHORT[r.type] || '?';
        
        return { name: `${smartName.trim()} [${shortTypeName}]`, pan: r.link };
    });

    const fullTypeName = PAN_TYPE_MAP[panType] || '资源';
    return jsonify({ list: [{ title: `${fullTypeName} - 资源列表`, tracks: tracks }] });
}

// --- play函数，现在是指令分发器 ---
async function play(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';

    if (panUrl.startsWith('custom:')) {
        log(`接收到指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const actionExt = {};
        for (const [key, value] of params.entries()) {
            actionExt[key] = decodeURIComponent(value);
        }
        // 调用 getTracks 来处理指令并刷新UI
        return await getTracks(actionExt);
    } else {
        // 如果不是指令，就是真实的播放链接
        log(`准备播放: ${panUrl}`);
        return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
    }
}

async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
