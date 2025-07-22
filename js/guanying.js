/**
 * Gying 前端插件 - v4.0 规范回归最终版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v4.0
 * 更新日志:
 * v4.0: 最终版。彻底推翻之前所有错误假设，完全遵循“完美代码”所揭示的旧版插件规范。
 * 1. 确认了 play 函数只负责返回播放链接，不负责UI渲染。
 * 2. 确认了 detail 函数是获取和展示二级钻取UI的唯一入口。
 * 3. 确认了所有接口的核心参数是简单的字符串ID，而不是ext对象。
 * 4. 这次，我们用正确的钥匙，开正确的锁。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (与之前版本完全相同) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';
let currentVodId = '';

// ==================== XPTV App 标准接口 (遵循旧版规范) ====================
async function init() {
    log(`插件初始化，后端地址: ${API_BASE_URL}`);
    const config = {
        ver: 1,
        title: 'Gying观影 (钻取筛选版)',
        site: 'gying.org',
        tabs: [
            { name: '剧集', id: 'tv' },
            { name: '电影', id: 'mv' },
            { name: '动漫', id: 'ac' }
        ],
    };
    return jsonify({ class: config.tabs, filters: {} });
}

async function home() {
    return await init();
}

async function category(tid, pg, filter, ext) {
    log(`获取分类: tid=${tid}, pg=${pg}`);
    const url = `${API_BASE_URL}/vod?id=${tid}&page=${pg}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [] });
    return jsonify({ list: data.list || [] });
}

async function search(wd, quick) {
    log(`搜索: ${wd}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(wd)}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [] });
    return jsonify({ list: data.list || [] });
}

// 【核心】detail 函数现在是获取和展示二级钻取UI的唯一入口
async function detail(id) {
    log(`detail函数首次加载详情, ID: ${id}`);
    currentVodId = id;
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ vod_name: '获取资源失败', vod_play_from: '错误', vod_play_url: 'pan$#', vod_id: id }] });
    }
    const detailItem = data.list[0];
    const playUrlString = detailItem.vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ vod_name: '暂无任何网盘资源', vod_play_from: '提示', vod_play_url: 'pan$#', vod_id: id }] });
    }

    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
    }).filter(item => item !== null);
    log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);

    // 构建二级钻取UI
    const froms = [];
    const panTypeCounts = {};
    fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });

    const panTypeUrls = [];
    panTypeUrls.push(`全部 (${fullResourceCache.length})$pan$all`);
    Object.keys(panTypeCounts).forEach(typeCode => {
        panTypeUrls.push(`${PAN_TYPE_MAP[typeCode] || `类型${typeCode}`} (${panTypeCounts[typeCode]})$pan$${typeCode}`);
    });
    froms.push({ name: '🗂️ 网盘分类', urls: panTypeUrls.join('#') });

    const keywordUrls = [];
    keywordUrls.push(`全部$pan$all`);
    KEYWORD_FILTERS.forEach(kw => {
        keywordUrls.push(`${kw}$pan$${kw}`);
    });
    froms.push({ name: '🔍 关键字筛选', urls: keywordUrls.join('#') });

    // 默认显示所有资源
    const allResourceUrls = fullResourceCache.map(r => `[${PAN_TYPE_MAP[r.type]}] ${r.title}$${r.link}`).join('#');
    froms.push({ name: `📁 资源列表 (${fullResourceCache.length}条)`, urls: allResourceUrls });

    detailItem.vod_play_from = froms.map(f => f.name).join('$$$');
    detailItem.vod_play_url = froms.map(f => f.urls).join('$$$');
    
    return jsonify({ list: [detailItem] });
}

// 【核心】play 函数只负责根据筛选条件返回新的资源列表，或返回最终播放链接
async function play(flag, id, flags) {
    log(`play函数被调用: flag=${flag}, id=${id}`);
    
    // flag 是播放源的名称，比如 "🗂️ 网盘分类"
    // id 是对应播放源下的具体项目，比如 "pan$2" (夸克) 或一个真实的播放链接
    
    if (id.startsWith('pan$')) {
        // 这是筛选指令
        const filterValue = id.split('$')[1];
        log(`处理筛选指令: flag=${flag}, value=${filterValue}`);

        if (flag.includes('网盘分类')) {
            currentPanTypeFilter = filterValue;
        } else if (flag.includes('关键字筛选')) {
            currentKeywordFilter = filterValue;
        }

        let filteredResources = [...fullResourceCache];
        if (currentPanTypeFilter !== 'all') { filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter); }
        if (currentKeywordFilter !== 'all') {
            const lowerKeyword = currentKeywordFilter.toLowerCase();
            if (lowerKeyword === '其他') { filteredResources = filteredResources.filter(r => !KEYWORD_FILTERS.slice(0, -1).some(kw => r.title.toLowerCase().includes(kw.toLowerCase()))); } 
            else { filteredResources = filteredResources.filter(r => r.title.toLowerCase().includes(lowerKeyword)); }
        }
        
        const urls = filteredResources.map(r => `[${PAN_TYPE_MAP[r.type]}] ${r.title}$${r.link}`).join('#');
        
        // 返回一个新的播放列表，让播放器刷新 "资源列表" 这个播放源
        return jsonify({
            parse: 0,
            url: urls,
        });
    }

    // 这是真实的播放链接
    log(`准备播放: ${id}`);
    return jsonify({
        parse: 0,
        url: id,
    });
}
