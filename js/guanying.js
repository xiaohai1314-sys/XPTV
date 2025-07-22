/**
 * Gying 前端插件 - URL编码终极版 v1.0.10
 * 
 * --- 更新日志 ---
 * v1.0.10: 终极解决方案。后端将真实ID和名称编码进vod_id。前端在详情页解码vod_id，拿到真实ID后再请求详情。此方案完全不依赖APP的任何传递机制。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';
let currentVodId = '';

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (钻取筛选版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) { 
    ext = argsify(ext); 
    const { id, page = 1 } = ext; 
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); } 
    log(`获取分类: ${id}, 页码: ${page}`); 
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; 
    const data = await request(url); 
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }
    return jsonify({ list: data.list || [], total: data.total || 0 }); 
}

async function search(ext) { 
    ext = argsify(ext); 
    const { text } = ext; 
    if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); } 
    log(`搜索: ${text}`); 
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; 
    const data = await request(url); 
    if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); } 
    return jsonify({ list: data.list || [] }); 
}

async function getTracks(ext) {
    ext = argsify(ext);

    // ---【前端修改点】---
    // APP会将列表项的整个对象作为ext传入，我们从ext.vod_id中解码
    const encoded_id = ext.vod_id;
    if (!encoded_id || !encoded_id.includes('||')) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的影片ID格式', pan: '' }] }] });
    }

    const parts = encoded_id.split('||');
    const real_vod_id = parts[0];
    const vod_name = parts[1];
    log(`解码成功: 真实ID=${real_vod_id}, 名称=${vod_name}`);
    // ---【修改结束】---

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${real_vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== real_vod_id) {
        fullResourceCache = [];
        currentPanTypeFilter = 'all';
        currentKeywordFilter = 'all';
        currentVodId = real_vod_id;
        log(`首次加载详情: ${real_vod_id}`);
        
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(real_vod_id)}`;
        
        const data = await request(detailUrl);
        if (data.error) { log(`详情获取失败: ${data.error}`); return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败，请检查网络连接', pan: '' }] }] }); }
        if (!data.list || data.list.length === 0) { log('详情数据为空'); return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到相关资源', pan: '' }] }] }); }
        
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString.startsWith("抓取失败")) {
            log(`无有效资源链接或抓取失败: ${playUrlString}`);
            return jsonify({ list: [{ title: '提示', tracks: [{ name: playUrlString || '暂无任何网盘资源', pan: '' }] }] });
        }
        
        log(`开始解析资源字符串，长度: ${playUrlString.length}`);
        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            const title = parts[0] || '';
            const link = parts[1] || '';
            if (!title || !link) { return null; }
            return { type: detectPanType(title), title: title.trim(), link: link.trim() };
        }).filter(item => item !== null);
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }
    
    // --- 后续UI构建逻辑 (保持原样) ---
    if (pan_type !== undefined) { currentPanTypeFilter = pan_type; }
    if (keyword !== undefined) { currentKeywordFilter = keyword; }
    
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
    if (currentKeywordFilter !==
