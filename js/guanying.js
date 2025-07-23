/**
 * Gying 前端插件 - 多层钻取版 v1.2.0
 * 
 * 作者: 基于用户需求和参考图重构
 * 版本: v1.2.0
 * 更新日志:
 * v1.2.0:
 * 1. 【核心重构】完全重写 getTracks 函数，以实现“顶部分类筛选 -> 底部列表联动”的多层钻取UI。
 * 2. 【UI优化】筛选按钮会动态显示资源数量，并高亮当前选中的筛选器。
 * 3. 【逻辑修正】修复了之前版本中 getPlayinfo 与 getTracks 交互的异步刷新问题，采用播放器标准的 rerun 协议。
 * 4. 【状态管理】引入了更清晰的状态变量来管理当前的筛选条件。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.2.0] ${msg}`); } else { console.log(`[Gying v1.2.0] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// --- 状态管理 ---
let fullResourceCache = []; // 缓存当前影片的全部资源
let currentVodId = '';      // 缓存当前影片ID，防止重复请求

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying (多层钻取)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
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
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【核心】重构后的 getTracks 函数 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || (typeof ext === 'string' ? ext : '');
    const { pan_type = 'all' } = ext; // 从 ext 中获取筛选类型，默认为 'all'

    log(`getTracks 调用: vod_id=${vod_id}, pan_type=${pan_type}`);

    // 步骤1: 获取并缓存全量资源 (仅在首次加载或切换影片时)
    if (vod_id !== currentVodId) {
        log(`新影片，正在从后端获取详情: ${vod_id}`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);

        if (data.error || !data.list || data.list.length === 0) {
            log(`详情获取失败: ${data.error || '数据为空'}`);
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败，请检查网络', pan: '' }] }] });
        }

        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString.startsWith("抓取失败")) {
            log('无有效资源链接');
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
        }

        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            if (parts.length < 2 || !parts[0] || !parts[1]) return null;
            return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim() };
        }).filter(Boolean);
        
        currentVodId = vod_id; // 更新当前影片ID
        log(`资源缓存成功，共 ${fullResourceCache.length} 条。`);
    } else {
        log("使用已缓存的资源。");
    }

    // 步骤2: 构建UI - 分为“分类筛选”和“资源列表”两个部分
    const resultLists = [];

    // --- Part 1: 构建“网盘分类”筛选行 ---
    const panTypeCounts = fullResourceCache.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {});

    const panFilterButtons = [{
        // "全部" 按钮
        name: pan_type === 'all' ? `✅ 全部 (${fullResourceCache.length})` : `全部 (${fullResourceCache.length})`,
        pan: `custom:action=filter&pan_type=all&url=${encodeURIComponent(vod_id)}`
    }];
    
    Object.keys(PAN_TYPE_MAP).forEach(typeCode => {
        if (panTypeCounts[typeCode]) {
            const typeName = PAN_TYPE_MAP[typeCode];
            const count = panTypeCounts[typeCode];
            panFilterButtons.push({
                // 其他分类按钮，如果当前选中，则加上 ✅
                name: pan_type === typeCode ? `✅ ${typeName} (${count})` : `${typeName} (${count})`,
                pan: `custom:action=filter&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
            });
        }
    });
    
    resultLists.push({ title: '🗂️ 网盘分类', tracks: panFilterButtons });

    // --- Part 2: 构建“资源列表”行 (根据 pan_type 筛选) ---
    const filteredResources = pan_type === 'all'
        ? fullResourceCache
        : fullResourceCache.filter(r => r.type === pan_type);

    if (filteredResources.length > 0) {
        const resourceTracks = filteredResources.map(r => {
            const panTypeName = PAN_TYPE_MAP[r.type] || '未知';
            return {
                name: `[${panTypeName}] ${r.title}`, // 格式如: [夸克] 敦刻尔克.4K.REMUX
                pan: r.link // 直接是可播放/转存的链接
            };
        });
        resultLists.push({ title: `📁 资源列表 (${filteredResources.length}条)`, tracks: resourceTracks });
    } else {
        resultLists.push({ title: '📁 资源列表', tracks: [{ name: '当前筛选条件下无结果', pan: '' }] });
    }

    log(`UI构建完成: 当前筛选='${PAN_TYPE_MAP[pan_type] || '全部'}', 显示${filteredResources.length}条资源。`);
    return jsonify({ list: resultLists });
}

// --- 【核心】修正后的 getPlayinfo 函数 ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    // 判断是否为自定义的筛选指令
    if (panUrl.startsWith('custom:')) {
        log(`处理筛选指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        
        // 从指令中解析出下一次 getTracks 需要的参数
        const filterExt = {
            url: params.get('url'), // 必须传递 vod_id
            pan_type: params.get('pan_type') // 传递新的筛选类型
        };

        // 构建 rerun 指令，让播放器用新参数重新调用 detail() -> getTracks()
        const reloadUrl = `rerun://${jsonify(filterExt)}`;
        log(`生成刷新指令: ${reloadUrl}`);
        
        // 返回这个特殊指令，触发UI刷新
        return jsonify({ urls: [{ name: '正在筛选...', url: reloadUrl }] });
    }

    // 如果不是筛选指令，就是真实的播放链接
    log(`准备播放/转存: ${panUrl}`);
    return jsonify({ urls: [{ name: '即将跳转，请在网盘内操作', url: panUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.2.0 (多层钻取版)');
