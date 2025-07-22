/**
 * Gying 前端插件 - v5.0 终极觉悟版
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v5.0
 * 更新日志:
 * v5.0: 最终版。在经历了所有失败后，终于领悟到最核心的错误。
 * 1. 【致命错误修正】彻底删除所有自定义的 jsonify 函数，完全依赖播放器环境提供的同名函数。
 * 2. 【结构回归】完全、逐字地采用“完美代码”的函数结构和接口规范。
 * 3. 【逻辑替换】在正确的结构中，填入我们自己的API和二级钻取逻辑。
 * 4. 这次，我们用播放器自己的语言和它对话。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
// 【核心修正】完全依赖播放器环境提供的 $log, $fetch, jsonify 等函数，不再自己定义
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';

// ==================== XPTV App 标准接口 (遵循旧版规范) ====================
async function init() {
    $log(`[Gying] 插件初始化，后端地址: ${API_BASE_URL}`);
    const config = {
        ver: 1,
        title: 'Gying观影 (钻取筛选版)',
        site: 'gying.org',
        class: [ // 【规范】分类使用 class 字段
            { type_name: '剧集', type_id: 'tv' },
            { type_name: '电影', type_id: 'mv' },
            { type_name: '动漫', type_id: 'ac' }
        ],
        filters: {} // 【规范】筛选器字段
    };
    return JSON.stringify(config); // 【规范】返回最原始的JSON字符串
}

async function home() {
    return await init();
}

async function category(tid, pg, filter, ext) {
    $log(`[Gying] 获取分类: tid=${tid}, pg=${pg}`);
    const url = `${API_BASE_URL}/vod?id=${tid}&page=${pg}`;
    const res = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);
    return JSON.stringify({ list: data.list || [] });
}

async function search(wd, quick) {
    $log(`[Gying] 搜索: ${wd}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(wd)}`;
    const res = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);
    return JSON.stringify({ list: data.list || [] });
}

// 【核心】detail 函数是获取和展示二级钻取UI的唯一入口
async function detail(id) {
    $log(`[Gying] detail函数首次加载详情, ID: ${id}`);
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(id)}`;
    const res = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const data = JSON.parse(res.data);

    if (data.error || !data.list || data.list.length === 0) {
        return JSON.stringify({ list: [{ vod_name: '获取资源失败', vod_play_from: '错误', vod_play_url: 'pan$#', vod_id: id }] });
    }
    const detailItem = data.list[0];
    const playUrlString = detailItem.vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return JSON.stringify({ list: [{ vod_name: '暂无任何网盘资源', vod_play_from: '提示', vod_play_url: 'pan$#', vod_id: id }] });
    }

    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: (parts[0] || '').trim(), link: (parts[1] || '').trim() };
    }).filter(item => item !== null);
    $log(`[Gying] 资源解析完成，共 ${fullResourceCache.length} 条有效资源`);

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
    
    return JSON.stringify({ list: [detailItem] });
}

// 【核心】play 函数只负责根据筛选条件返回新的资源列表，或返回最终播放链接
async function play(flag, id, flags) {
    $log(`[Gying] play函数被调用: flag=${flag}, id=${id}`);
    
    if (id.startsWith('pan$')) {
        const filterValue = id.split('$')[1];
        $log(`[Gying] 处理筛选指令: flag=${flag}, value=${filterValue}`);

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
        
        return JSON.stringify({ parse: 0, url: urls });
    }

    $log(`[Gying] 准备播放: ${id}`);
    return JSON.stringify({ parse: 0, url: id });
}
