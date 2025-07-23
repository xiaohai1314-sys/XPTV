/**
 * Gying 前端插件 - 无状态全列表版 v4.0.0
 * 
 * 作者: 基于用户反馈和所有失败尝试后的最终方案
 * 版本: v4.0.0 (无状态全列表版)
 * 更新日志:
 * v4.0.0: 
 * 1. 【彻底重构】放弃所有“有状态”、“分步刷新”的逻辑，因为APP环境可能不支持。
 * 2. 【回归无状态】一次性获取所有数据，并为每种网盘类型都生成一个独立的分组。
 * 3. 【UI模拟分步】将所有分组一次性返回给APP，寄希望于APP的UI能以某种方式（如锚点跳转、折叠面板）来模拟分步效果。
 * 4. 这是解决“逻辑正确但无法显示”问题的最终尝试，将渲染的决定权完全交还给APP。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数与配置 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying观影 (全列表)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [], total: 0 }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards, total: data.total || 0 });
}
async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { return jsonify({ list: [] }); }
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { return jsonify({ list: [] }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【核心实现：v4.0 无状态全列表版】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let vod_id = ext.url || ext.id || ext;
    if (typeof ext === 'string') { vod_id = ext; }

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);
    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    const fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim() };
    }).filter(Boolean);

    const resultLists = [];
    const resourcesByType = {};

    // 1. 将所有资源按网盘类型分组
    fullResourceCache.forEach(r => {
        if (!resourcesByType[r.type]) {
            resourcesByType[r.type] = [];
        }
        resourcesByType[r.type].push(r);
    });

    // 2. 创建第一步的“分类导航”分组
    const navigationTracks = Object.keys(resourcesByType).map(typeCode => ({
        name: `[跳转到] ${PAN_TYPE_MAP[typeCode] || '未知'} (${resourcesByType[typeCode].length})`,
        // pan里放一个锚点链接，寄希望于APP能识别
        pan: `#${PAN_TYPE_MAP[typeCode]}` 
    }));
    resultLists.push({ title: '第一步：选择网盘（跳转）', tracks: navigationTracks });

    // 3. 为每一种网盘类型，都创建一个独立的分组
    Object.keys(resourcesByType).forEach(typeCode => {
        const resources = resourcesByType[typeCode];
        const resourceTracks = resources.map(r => ({
            name: r.title,
            pan: r.link // pan里是最终的真实链接
        }));
        
        resultLists.push({
            // 分组标题带上特殊标记，寄希望于APP的锚点跳转能识别
            title: `↓ ${PAN_TYPE_MAP[typeCode]} 资源列表 ↓`,
            tracks: resourceTracks
        });
    });

    // 4. 一次性返回所有分组
    return jsonify({ list: resultLists });
}

async function getPlayinfo(ext) {
    // 在这个无状态模式下，play函数只负责播放，不承担任何逻辑
    ext = argsify(ext);
    const playUrl = ext.pan || ext.url;
    return jsonify({ urls: [{ name: '点击播放', url: playUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks({ id: id }); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v4.0.0 (无状态全列表版)');
