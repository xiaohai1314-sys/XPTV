/**
 * Gying 前端插件 - 最终四步实现版 v2.0.0
 * 
 * 作者: 基于用户提供的脚本和参考代码整合优化
 * 版本: v2.0.0 (最终四步实现版)
 * 更新日志:
 * v2.0.0: 
 * 1. 【核心重构】学习 SeedHub 插件的成功经验，采用“伪装”模式，将分步逻辑隐藏在 pan 指令中，每次都返回APP能理解的简单列表结构。
 * 2. 【实现四步】通过在 pan 指令中编码 step 信息 (step1, step2, step3)，精确实现了用户描述的“选择分类 -> 选择资源 -> 显示文件夹 -> 播放”的四步流程。
 * 3. 【放弃刷新】不再依赖APP的UI刷新机制，每次点击都视为一次全新的 getTracks 调用，插件自身管理状态。
 * 4. 【高兼容性】移除了所有 Buffer 等潜在不兼容的API。
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
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying观影 (四步版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
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

// --- 【核心实现：伪装成三步的四步流程】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let vod_id = ext.url || ext.id || ext;
    if (typeof ext === 'string') { vod_id = ext; }

    // 从 ext 中解析出当前步骤和所需参数
    const { step = 'step1', pan_type, resource_index } = ext;
    log(`getTracks: step=${step}, pan_type=${pan_type}, resource_index=${resource_index}`);

    // 任何步骤都需要先获取全量数据
    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);
    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    const fullResourceCache = playUrlString.split('#').map((item, index) => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        return { type: detectPanType(parts[0]), title: parts[0].trim(), link: parts[1].trim(), index: index };
    }).filter(Boolean);

    let tracks = [];
    let title = 'Gying';

    // 步骤1: 显示网盘分类
    if (step === 'step1') {
        title = '第一步：请选择网盘';
        const panTypeCounts = {};
        fullResourceCache.forEach(r => { panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1; });
        tracks = Object.keys(panTypeCounts).map(typeCode => ({
            name: `[分类] ${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`,
            pan: jsonify({ step: 'step2', pan_type: typeCode, url: vod_id }) // pan里藏着下一步的指令
        }));
    }

    // 步骤2: 显示所选分类下的所有资源
    else if (step === 'step2') {
        title = `第二步：请选择资源 (${PAN_TYPE_MAP[pan_type]})`;
        const resourcesOfSelectedType = fullResourceCache.filter(r => r.type === pan_type);
        tracks = resourcesOfSelectedType.map(r => {
            const cleanTitle = r.title.replace(/【.*?】|\[.*?\]/g, '').trim();
            return {
                name: `[资源] ${cleanTitle}`,
                pan: jsonify({ step: 'step3', resource_index: r.index, url: vod_id }) // pan里藏着下一步的指令
            };
        });
    }

    // 步骤3: 显示所选资源的文件夹
    else if (step === 'step3') {
        title = '第三步：请点击文件夹播放';
        const selectedResource = fullResourceCache.find(r => r.index == resource_index);
        if (selectedResource) {
            tracks.push({
                name: `[文件夹] ${selectedResource.title}`,
                pan: selectedResource.link // pan里是最终的真实链接
            });
        }
    }

    // 统一返回APP能理解的简单结构
    return jsonify({
        list: [{
            title: title,
            tracks: tracks,
        }],
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    // 尝试将 ext.pan (可能是一个JSON字符串) 解析成对象
    let playInfo = argsify(ext.pan);

    // 如果解析失败，或者解析后没有 step 属性，说明它是一个真实的播放链接
    if (typeof playInfo !== 'object' || !playInfo.step) {
        log(`getPlayinfo: 收到真实播放链接: ${ext.pan}`);
        return jsonify({ urls: [{ name: '点击播放', url: ext.pan }] });
    }
    
    // 如果解析成功，说明它是一个分步指令，需要再次调用 getTracks
    log(`getPlayinfo: 收到分步指令，重新调用getTracks`);
    return await getTracks(playInfo);
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks({ id: id }); } // 初始调用
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v2.0.0 (最终四步实现版)');
