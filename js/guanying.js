/**
 * Gying 前端插件 - 参数修正终极版 v1.5.1
 * 
 * 作者: 基于白屏问题根源分析修正
 * 版本: v1.5.1
 * 更新日志:
 * v1.5.1:
 * 1. 【根源修正】修复了 getTracks 函数在首次加载时，因参数处理不当导致 vod_id 为空、无法获取任何数据的致命BUG。
 * 2. 【逻辑强化】明确区分了首次加载（ext为字符串）和后续刷新（ext为对象）两种情况下的参数解析逻辑，确保 vod_id 和 step 等状态始终能被正确获取。
 * 3. 【保持稳定】除参数处理外，其他部分沿用 v1.5.0 成熟可靠的、兼容性优先的交互模型。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.5.1] ${msg}`); } else { console.log(`[Gying v1.5.1] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
let fullResourceCache = [];
let currentVodId = '';

// ==================== XPTV App 标准接口 (无需修改) ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (终极版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// --- 【核心】v1.5.1 getTracks 函数 ---
async function getTracks(ext) {
    // 【根源修正】明确处理首次加载和后续刷新的不同 ext 类型
    let vod_id, step, pan_type, resource_link, resource_title;

    if (typeof ext === 'string') {
        // 首次加载: ext 是一个字符串ID
        log("首次加载，ext 是字符串");
        vod_id = ext;
        step = 1; // 强制为第一步
    } else {
        // 后续刷新: ext 是一个对象
        log("刷新加载，ext 是对象");
        ext = argsify(ext);
        vod_id = ext.url || ext.id || '';
        step = ext.step || 1;
        pan_type = ext.pan_type;
        resource_link = ext.resource_link;
        resource_title = ext.resource_title;
    }

    log(`getTracks 解析后: vod_id=${vod_id}, step=${step}, pan_type=${pan_type}`);

    // 步骤1: 获取并缓存全量资源 (仅在首次加载或切换影片时)
    if (vod_id && vod_id !== currentVodId) {
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        if (data.error || !data.list || !data.list[0] || !data.list[0].vod_play_url) {
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        fullResourceCache = data.list[0].vod_play_url.split('#').map(item => {
            const parts = item.split('$');
            if (parts.length < 2) return null;
            return { title: parts[0], link: parts[1], type: detectPanType(parts[0]) };
        }).filter(Boolean);
        currentVodId = vod_id;
        log(`资源缓存成功，共 ${fullResourceCache.length} 条。`);
    }

    const resultLists = [];

    // 根据 step 参数决定渲染哪一步的UI
    if (step === 1) {
        log("渲染第一步: 网盘分类");
        if (fullResourceCache.length === 0) return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何有效网盘资源', pan: '' }] }] });
        
        const panTypeCounts = fullResourceCache.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
        const panFilterButtons = Object.keys(panTypeCounts).map(typeCode => ({
            name: `${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`,
            pan: `custom:step=2&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
        }));
        resultLists.push({ title: '云盘', tracks: panFilterButtons });

    } else if (step === 2) {
        log(`渲染第二步: ${PAN_TYPE_MAP[pan_type] || '未知'} 的资源列表`);
        const filtered = fullResourceCache.filter(r => r.type === pan_type);
        const tracks = filtered.map(r => ({
            name: `网盘 [${PAN_TYPE_MAP[r.type] || '未知'}]`,
            sub: r.title,
            pan: r.link
        }));
        resultLists.push({ title: `云盘 - ${PAN_TYPE_MAP[pan_type] || '未知'}`, tracks: tracks });

    } else if (step === 3) {
        log(`渲染第三步: 文件夹 "${resource_title}"`);
        const tracks = [{
            name: `🗂️ ${resource_title}`,
            pan: resource_link
        }];
        resultLists.push({ title: '文件夹', tracks: tracks });
    }

    return jsonify({ list: resultLists });
}

// --- getPlayinfo 函数 (与v1.5.0版本完全相同，无需修改) ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (!panUrl.startsWith('custom:')) {
        log(`第四步: 最终播放/转存链接: ${panUrl}`);
        return jsonify({ urls: [{ name: '即将跳转，请在网盘内操作', url: panUrl }] });
    }

    log(`捕获到自定义指令: ${panUrl}`);
    const paramsStr = panUrl.replace('custom:', '');
    const params = new URLSearchParams(paramsStr);
    
    const nextExt = {
        url: params.get('url'),
        step: parseInt(params.get('step') || '0', 10)
    };

    const action = params.get('action');
    if (action === 'show_files') {
        nextExt.step = 3;
        nextExt.resource_title = decodeURIComponent(params.get('title'));
        nextExt.resource_link = decodeURIComponent(params.get('link'));
    } else {
        nextExt.pan_type = params.get('pan_type');
    }
    
    log(`准备刷新页面，下一步参数: ${JSON.stringify(nextExt)}`);

    return jsonify({
        urls: [{
            name: '加载中...',
            url: `$xgext${jsonify(nextExt)}`
        }]
    });
}

// ==================== 标准接口转发 (无需修改) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.5.1 (参数修正终极版)');
