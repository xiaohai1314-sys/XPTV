/**
 * Gying 前端插件 - 最终分步实现版 v1.2.0
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.2.0 (最终分步实现版)
 * 更新日志:
 * v1.2.0: 
 * 1. 【核心】重构 getTracks 和 getPlayinfo 函数，以实现纯粹的、逐级展开的四步钻取流程。
 * 2. 【简化】完全移除了关键字筛选功能，专注于核心的分步交互逻辑。
 * 3. 【状态】引入新的全局状态变量 (selectedPanType, selectedResourceLink) 来控制和管理用户的选择步骤。
 * 4. 【兼容】每次交互只返回一个UI分组，以最大化兼容特定APP的渲染机制。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ★【修改】引入新的状态控制变量
let fullResourceCache = [];
let currentVodId = '';
let selectedPanType = null;     // 新增：用户选择的网盘类型, e.g., '0' for 百度
let selectedResourceLink = null; // 新增：用户选择的具体资源链接

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (分步版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); }
    log(`搜索: ${text}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards });
}

// --- 【最终简化版: 纯粹的四步钻取流程】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let vod_id = ext.url || ext.id || ext;
    if (typeof ext === 'string') { vod_id = ext; }

    // 解析指令, action 决定当前处于哪个步骤
    const { action = 'init', pan_type, resource_link } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}`);

    // --- 步骤0: 初始化或更换影片 ---
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
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
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

    // 根据 action 更新当前状态
    if (action === 'select_pan_type') {
        log(`步骤2: 用户选择了网盘类型 [${PAN_TYPE_MAP[pan_type]}]`);
        selectedPanType = pan_type;
        selectedResourceLink = null; // 重置下一级的选择
    } else if (action === 'select_resource') {
        log(`步骤3: 用户选择了具体资源`);
        // resource_link 是经过 Base64 编码的, 防止特殊字符干扰
        selectedResourceLink = Buffer.from(resource_link, 'base64').toString('utf-8');
    }

    const resultLists = [];

    // --- 步骤1: 如果还没选网盘，就渲染网盘分类按钮 ---
    if (!selectedPanType) {
        const panTypeCounts = {};
        fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
        const panTypeButtons = Object.keys(panTypeCounts).map(typeCode => {
            const count = panTypeCounts[typeCode];
            const name = `${PAN_TYPE_MAP[typeCode] || '未知'} (${count})`;
            return {
                name: name,
                pan: `custom:action=select_pan_type&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
            };
        });
        resultLists.push({ title: '第一步：请选择网盘', tracks: panTypeButtons });
        log('UI构建完成: 显示第一步');
        return jsonify({ list: resultLists });
    }

    // --- 步骤2: 如果已选择网盘，但还没选资源，就渲染该网盘下的所有资源按钮 ---
    if (selectedPanType && !selectedResourceLink) {
        const resourcesOfSelectedType = fullResourceCache.filter(r => r.type === selectedPanType);
        const resourceButtons = resourcesOfSelectedType.map(r => {
            const cleanTitle = r.title.replace(/【.*?】|\[.*?\]/g, '').trim();
            const displayName = `网盘[${PAN_TYPE_MAP[selectedPanType][0]}] ${cleanTitle}`;
            const encodedLink = Buffer.from(r.link).toString('base64');
            return {
                name: displayName,
                pan: `custom:action=select_resource&resource_link=${encodedLink}&pan_type=${selectedPanType}&url=${encodeURIComponent(vod_id)}`
            };
        });
        resultLists.push({ title: `第二步：请选择资源 (${PAN_TYPE_MAP[selectedPanType]})`, tracks: resourceButtons });
        log('UI构建完成: 显示第二步');
        return jsonify({ list: resultLists });
    }

    // --- 步骤3: 如果已选择具体资源，渲染文件夹按钮 ---
    if (selectedResourceLink) {
        const selectedResource = fullResourceCache.find(r => r.link === selectedResourceLink);
        if (selectedResource) {
            const folderName = `文件夹：${selectedResource.title}`;
            const folderButton = {
                name: folderName,
                pan: selectedResource.link 
            };
            resultLists.push({ title: '第三步：请点击文件夹播放', tracks: [folderButton] });
            log('UI构建完成: 显示第三步');
            return jsonify({ list: resultLists });
        }
    }

    // 如果出现意外情况，返回一个空列表
    return jsonify({ list: [] });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    // 如果是自定义指令 (custom:...)，则重新调用 getTracks 刷新UI
    if (panUrl.startsWith('custom:')) {
        log(`处理UI指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        
        setTimeout(() => { getTracks(filterExt); }, 100);

        return jsonify({ urls: [] });
    }

    // --- 步骤4: 点击文件夹/最终链接，准备播放 ---
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}


// ==================== 标准接口转发 (保持原样) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.2.0 (最终分步实现版)');
