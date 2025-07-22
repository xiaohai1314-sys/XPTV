/**
 * Gying 前端插件 - 完美复刻修正版 v1.0.3
 * 
 * 核心思路: 100% 保持原始 v1.0 的代码逻辑和结构，仅修正一个API参数名和一个ID获取逻辑。
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.0.3 (ID获取修正版)
 * 
 * --- 更新日志 ---
 * v1.0.3: 修正了 getTracks 函数中的ID获取逻辑，避免将整个对象作为ID传递，解决了无法加载详情页资源的问题。
 * v1.0.2: 修正了详情接口的参数名，从 'id' 改为 'ids' 以匹配后端。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (保持原样) ====================
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
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); } log(`获取分类: ${id}, 页码: ${page}`); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); } return jsonify({ list: data.list || [], total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); } log(`搜索: ${text}`); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); } return jsonify({ list: data.list || [] }); }

async function getTracks(ext) {
    ext = argsify(ext);

    // ---【核心修正点 v1.0.3】---
    // 修正ID的获取逻辑。APP通常在ext对象中通过 id 或 url 字段传递影片ID。
    // 我们需要明确地从这些字段中获取，如果它们不存在，再考虑ext本身是否为字符串ID。
    let vod_id;
    if (ext.id) {
        vod_id = ext.id;
    } else if (ext.url) {
        vod_id = ext.url;
    } else if (typeof ext === 'string') {
        vod_id = ext;
    } else {
        // 如果都找不到，记录错误并返回，避免向后端发送无效请求
        log('严重错误: 在getTracks中无法从传入的参数中解析出有效的vod_id。收到的参数: ' + JSON.stringify(ext));
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '插件内部错误：无法获取影片ID', pan: '' }] }] });
    }
    // ---【修正结束】---

    const { pan_type, keyword, action = 'init' } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        fullResourceCache = [];
        currentPanTypeFilter = 'all';
        currentKeywordFilter = 'all';
        currentVodId = vod_id;
        log(`首次加载详情: ${vod_id}`);
        
        // 【v1.0.2 修正】使用 'ids' 参数名以匹配后端
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        
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
    if (currentKeywordFilter !== 'all') { 
        const lowerKeyword = currentKeywordFilter.toLowerCase(); 
        if (lowerKeyword === '其他') { 
            filteredResources = filteredResources.filter(r => { 
                const lowerTitle = r.title.toLowerCase(); 
                return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase())); 
            }); 
        } else { 
            filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); 
        } 
    }
    
    const resultLists = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
    
    const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}` }];
    Object.keys(panTypeCounts).sort().forEach(typeCode => { 
        panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}` }); 
    });
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panTypeButtons });
    
    const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all&url=${encodeURIComponent(vod_id)}` }];
    KEYWORD_FILTERS.forEach(kw => { keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}&url=${encodeURIComponent(vod_id)}` }); });
    resultLists.push({ title: '🔍 关键字筛选', tracks: keywordButtons });
    
    if (filteredResources.length > 0) { 
        const resourceTracks = filteredResources.map(r => { 
            const panTypeName = PAN_TYPE_MAP[r.type] || '未知'; 
            return { name: `[${panTypeName}] ${r.title}`, pan: r.link }; 
        }); 
        resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks }); 
    } else { 
        resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] }); 
    }
    
    log(`UI构建完成: 网盘='${currentPanTypeFilter}', 关键字='${currentKeywordFilter}', 显示${filteredResources.length}/${fullResourceCache.length}条`);
    return jsonify({ list: resultLists });
}

async function getPlayinfo(ext) { 
    ext = argsify(ext); 
    const panUrl = ext.pan || ext.url || ''; 
    if (panUrl.startsWith('custom:')) { 
        log(`处理筛选指令: ${panUrl}`); 
        const paramsStr = panUrl.replace('custom:', ''); 
        const params = new URLSearchParams(paramsStr); 
        const filterExt = Object.fromEntries(params.entries()); 
        // 使用setTimeout确保UI有时间响应
        setTimeout(() => { getTracks(filterExt); }, 100); 
        return jsonify({ urls: [] }); 
    } 
    log(`准备播放: ${panUrl}`); 
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] }); 
}

// ==================== 标准入口函数映射 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.0.3');
