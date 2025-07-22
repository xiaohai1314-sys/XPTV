/**
 * Gying 前端插件 - 详情页直出最终版 v2.0.0
 *
 * 作者: 基于用户反馈重构
 * 版本: v2.0.0 (详情页直出最终版)
 * 更新日志:
 * v2.0.0:
 * 1. 【重大重构】根据用户的APP实际工作模式，将所有资源获取和UI构建逻辑全部移入 detail 函数。
 * 2. detail 函数现在会一次性请求后端，并直接返回包含筛选按钮和资源列表的完整UI，不再有中间加载步骤。
 * 3. 废弃了 getTracks 函数和复杂的 play 函数指令逻辑，因为所有内容都在详情页生成。
 * 4. play 函数简化为只处理最终的播放链接。
 * 5. 这套新架构旨在完美适配在详情页直接展示所有内容的APP。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数与配置 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (直出版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

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

// --- 【核心重构】detail 函数现在负责所有事情 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`进入详情页(直出模式), ID: ${vod_id}`);

    if (!vod_id) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无效的影片ID', pan: '' }] }] });
    }

    // 1. 直接请求后端获取资源
    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error) { return jsonify({ list: [{ title: '错误', tracks: [{ name: `获取资源失败: ${data.error}`, pan: '' }] }] }); }
    if (!data.list || data.list.length === 0) { return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到相关资源', pan: '' }] }] }); }
    
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源' || playUrlString.startsWith('抓取失败')) {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: playUrlString || '暂无任何网盘资源', pan: '' }] }] });
    }

    // 2. 解析所有资源
    const allResources = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        const title = parts[0] || '';
        const link = parts[1] || '';
        if (!title || !link) { return null; }
        return { type: detectPanType(title), title: title.trim(), link: link.trim() };
    }).filter(item => item !== null);

    if (allResources.length === 0) {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '解析后无有效资源', pan: '' }] }] });
    }
    log(`资源解析完成，共 ${allResources.length} 条有效资源`);

    // 3. 构建UI - 直接生成所有资源列表
    const resultLists = [];
    const panTypeCounts = {};
    allResources.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });

    // 为每个网盘类型创建一个播放列表
    Object.keys(panTypeCounts).sort().forEach(typeCode => {
        const panTypeName = PAN_TYPE_MAP[typeCode] || '未知';
        const tracksForType = allResources
            .filter(r => r.type === typeCode)
            .map(r => ({ name: r.title, pan: r.link }));
        
        if (tracksForType.length > 0) {
            resultLists.push({
                title: `🗂️ ${panTypeName} (${tracksForType.length})`,
                tracks: tracksForType
            });
        }
    });
    
    log(`UI构建完成，共 ${resultLists.length} 个资源组`);
    return jsonify({ list: resultLists });
}

// --- 【简化】play 函数只处理播放链接 ---
async function play(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';
    log(`准备播放: ${panUrl}`);
    // 直接返回播放信息，因为不再有自定义指令
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// --- 【废弃】getTracks 函数不再需要 ---
// async function getTracks(ext) { ... }

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }

log('Gying前端插件加载完成 v2.0.0 (详情页直出最终版)');
