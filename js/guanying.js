/**
 * Gying 前端插件 - 高兼容性修复版 v1.3.0
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.3.0 (高兼容性修复版)
 * 更新日志:
 * v1.3.0: 
 * 1. 【核心修复】移除了对 Node.js `Buffer` 对象的依赖，使用纯 JavaScript 实现 Base64 编解码，以解决在部分APP环境中脚本崩溃的问题。
 * 2. 【健壮性】增强了错误处理和数据校验，确保在任何情况下都有明确的JSON返回，避免APP因收到空响应而显示空白。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ★【新增】纯JS Base64编解码函数，替代Buffer
const Base64 = {
    encode: function(str) {
        try {
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        } catch (e) {
            log('btoa ailed: ' + e);
            return str; // Fallback
        }
    },
    decode: function(str) {
        try {
            return decodeURIComponent(atob(str).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch (e) {
            log('atob failed: ' + e);
            return str; // Fallback
        }
    }
};

// 状态控制变量
let fullResourceCache = [];
let currentVodId = '';
let selectedPanType = null;
let selectedResourceLink = null;

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (修复版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

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

// --- 【高兼容性修复版】 ---
async function getTracks(ext) {
    try {
        ext = argsify(ext);
        let vod_id = ext.url || ext.id || ext;
        if (typeof ext === 'string') { vod_id = ext; }

        const { action = 'init', pan_type, resource_link } = ext;
        log(`getTracks调用: vod_id=${vod_id}, action=${action}`);

        if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
            log(`首次加载或重置: ${vod_id}`);
            currentVodId = vod_id;
            selectedPanType = null;
            selectedResourceLink = null;
            fullResourceCache = [];

            const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
            const data = await request(detailUrl);
            if (data.error || !data.list || data.list.length === 0) {
                log(`详情获取失败或无数据: ${data.error || 'empty list'}`);
                return jsonify({ list: [{ title: '提示', tracks: [{ name: `获取资源失败: ${data.error || '无数据'}`, pan: '' }] }] });
            }
            
            const playUrlString = data.list[0].vod_play_url;
            if (!playUrlString || playUrlString === '暂无任何网盘资源') {
                return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
            }
            
            fullResourceCache = playUrlString.split('#').map(item => {
                const parts = item.split('$');
                if (!parts[0] || !parts[1]) return null;
                return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim() };
            }).filter(Boolean);
            log(`资源解析完成，共 ${fullResourceCache.length} 条`);
        }

        if (action === 'select_pan_type') {
            selectedPanType = pan_type;
            selectedResourceLink = null;
        } else if (action === 'select_resource') {
            // ★【修复】使用我们自己的Base64解码
            selectedResourceLink = Base64.decode(resource_link);
        }

        const resultLists = [];

        if (!selectedPanType) {
            const panTypeCounts = {};
            fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
            const panTypeButtons = Object.keys(panTypeCounts).map(typeCode => ({
                name: `${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`,
                pan: `custom:action=select_pan_type&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
            }));
            resultLists.push({ title: '第一步：请选择网盘', tracks: panTypeButtons });
            return jsonify({ list: resultLists });
        }

        if (selectedPanType && !selectedResourceLink) {
            const resourcesOfSelectedType = fullResourceCache.filter(r => r.type === selectedPanType);
            const resourceButtons = resourcesOfSelectedType.map(r => {
                const cleanTitle = r.title.replace(/【.*?】|\[.*?\]/g, '').trim();
                // ★【修复】使用我们自己的Base64编码
                const encodedLink = Base64.encode(r.link);
                return {
                    name: `网盘[${PAN_TYPE_MAP[selectedPanType][0]}] ${cleanTitle}`,
                    pan: `custom:action=select_resource&resource_link=${encodedLink}&pan_type=${selectedPanType}&url=${encodeURIComponent(vod_id)}`
                };
            });
            resultLists.push({ title: `第二步：请选择资源 (${PAN_TYPE_MAP[selectedPanType]})`, tracks: resourceButtons });
            return jsonify({ list: resultLists });
        }

        if (selectedResourceLink) {
            const selectedResource = fullResourceCache.find(r => r.link === selectedResourceLink);
            if (selectedResource) {
                resultLists.push({
                    title: '第三步：请点击文件夹播放',
                    tracks: [{ name: `文件夹：${selectedResource.title}`, pan: selectedResource.link }]
                });
                return jsonify({ list: resultLists });
            }
        }
        
        // ★【修复】如果所有逻辑都没匹配上，返回一个明确的提示，而不是空数组
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '逻辑异常，请返回重试', pan: '' }] }] });

    } catch (e) {
        log('getTracks 发生严重错误: ' + e);
        // ★【修复】即使脚本崩溃，也要返回一个错误信息
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '插件脚本执行失败: ' + e.message, pan: '' }] }] });
    }
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (panUrl.startsWith('custom:')) {
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        // 尝试直接调用，看是否能解决问题
        getTracks(filterExt);
        return jsonify({ urls: [] });
    }

    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.3.0 (高兼容性修复版)');
