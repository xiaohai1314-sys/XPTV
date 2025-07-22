/**
 * Gying 前端插件 - 调试终极版 v1.0.9
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.0.9 (信标匹配终极版)
 * 
 * --- 更新日志 ---
 * v1.0.9: 终极解决方案。列表页通过setTimeout异步写入$storage，避免渲染阻塞。同时在ext中存入vod_name作为信标。详情页通过信标从$storage中匹配到正确的vod_id，解决所有已知问题。
 * v1.0.8: 尝试异步存储，但ID匹配逻辑可能仍不健壮。
 * v1.0.7: 移除了$storage，解决了列表页空白，但无法传递ID。
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

// ---【核心修正 v1.0.9】---
const CACHE_KEY = 'gying_vod_list_cache';
// ---【修正结束】---

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (钻取筛选版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

function processList(list) {
    if (!list || list.length === 0) return [];
    // 异步写入$storage
    setTimeout(() => {
        log(`异步将 ${list.length} 条影片信息写入LocalStorage...`);
        $storage.put(CACHE_KEY, jsonify(list));
    }, 10);
    // 为每一项添加ext信标
    return list.map(item => {
        item.ext = { vod_name: item.vod_name };
        return item;
    });
}

async function getCards(ext) { 
    ext = argsify(ext); 
    const { id, page = 1 } = ext; 
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); } 
    log(`获取分类: ${id}, 页码: ${page}`); 
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; 
    const data = await request(url); 
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }
    
    const processedList = processList(data.list);
    return jsonify({ list: processedList, total: data.total || 0 }); 
}

async function search(ext) { 
    ext = argsify(ext); 
    const { text } = ext; 
    if (!text) { log('搜索关键词为空'); return jsonify({ list: [] }); } 
    log(`搜索: ${text}`); 
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; 
    const data = await request(url); 
    if (data.error) { log(`搜索失败: ${data.error}`); return jsonify({ list: [] }); } 
    
    const processedList = processList(data.list);
    return jsonify({ list: processedList }); 
}

async function getTracks(ext) {
    ext = argsify(ext);

    // ---【核心修正 v1.0.9】---
    let vod_id;
    const targetName = ext.vod_name; // 从APP传来的信标中获取影片名称

    if (!targetName) {
        log('错误: APP未传递vod_name信标。');
    } else {
        log(`收到信标，目标影片名称: "${targetName}"`);
        try {
            const cachedListStr = $storage.get(CACHE_KEY);
            if (cachedListStr) {
                const cachedList = JSON.parse(cachedListStr);
                const found = cachedList.find(item => item.vod_name === targetName);
                if (found) {
                    vod_id = found.vod_id;
                    log(`成功从LocalStorage缓存中匹配到ID: ${vod_id}`);
                } else {
                    log('错误: 在LocalStorage缓存中未找到匹配的影片。');
                }
            } else {
                log('错误: LocalStorage中没有缓存数据。请先访问一次列表页。');
            }
        } catch (e) {
            log('从LocalStorage查找ID时出错: ' + e.message);
        }
    }

    if (!vod_id) {
        const error_msg = '插件错误: 无法获取影片ID。请确保先从列表页进入。';
        return jsonify({ list: [{ title: '错误', tracks: [{ name: error_msg, pan: '' }] }] });
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

log('Gying前端插件加载完成 v1.0.9');
