/**
 * Gying 前端插件 - 分组修正最终版 v7.1.0
 *
 * 目标: 实现您最核心的需求——将同类型资源聚合在各自的网盘按钮下。
 *
 * 工作原理:
 * 1. detail函数获取所有资源。
 * 2. 将资源按“夸克”、“阿里”、“迅雷”等类型进行分组。
 * 3. 为每一个有资源的分组，创建一个“播放源”对象。
 * 4. 这个对象的`title`是“网盘[夸]”，`tracks`数组里包含了所有夸克网盘的链接。
 * 5. 将所有这些“播放源”对象打包成一个`list`数组，一次性返回给APP。
 * 6. APP接收到这个数据后，应该会渲染出多个横向的蓝色按钮，点击每个按钮，会显示该按钮下所有的资源。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数与配置 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) return { error: `HTTP ${status}` }; return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百', '1': '迅', '2': '夸', '3': '阿', '4': '天', '5': '115', '6': 'UC', 'unknown': '?' }; // 使用单字，更简洁

// ==================== XPTV App 标准接口 ====================
async function getConfig() { return jsonify({ ver: 1, title: 'Gying (分组版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) return jsonify({ list: [] });
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [], total: 0 });
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards, total: data.total || 0 });
}

async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    if (!text) return jsonify({ list: [] });
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    if (data.error) return jsonify({ list: [] });
    const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } }));
    return jsonify({ list: cards });
}

// --- 【核心】detail函数，一次性生成两级列表 ---
async function detail(id) {
    const ext = argsify(id);
    const vod_id = ext.url;
    log(`detail(分组模式) for ID: ${vod_id}`);

    if (!vod_id) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '无效的影片ID', pan: '' }] }] });
    }

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0 || !data.list[0].vod_play_url || data.list[0].vod_play_url.startsWith('抓取失败')) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
    }

    const playUrlString = data.list[0].vod_play_url;
    
    // 【正确的分组逻辑】
    const resourcesByType = playUrlString.split('#').reduce((acc, item) => {
        const parts = item.split('$');
        if (parts.length < 2 || !parts[0] || !parts[1]) {
            return acc;
        }
        
        const title = parts[0].trim();
        const link = parts[1].trim();
        const type = detectPanType(title);

        if (!acc[type]) {
            acc[type] = [];
        }
        
        acc[type].push({ name: title, pan: link });
        
        return acc;
    }, {});

    const resultLists = [];
    Object.keys(resourcesByType).sort().forEach(typeCode => {
        const tracks = resourcesByType[typeCode];
        if (tracks.length > 0) {
            const panTypeName = PAN_TYPE_MAP[typeCode] || '?';
            resultLists.push({
                title: `网盘 [${panTypeName}]`, // 按钮标题
                tracks: tracks             // 按钮下的所有资源
            });
        }
    });

    if (resultLists.length === 0) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '解析后无有效资源', pan: '' }] }] });
    }
    
    log(`UI构建完成，共 ${resultLists.length} 个播放源分组`);
    return jsonify({ list: resultLists });
}

// --- play函数，只负责最终播放 ---
async function play(ext) {
    ext = argsify(ext);
    const panUrl = (ext && (ext.pan || ext.url)) || '';
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// --- 标准接口转发 ---
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
