/**
 * Gying 前端插件 - 兼容性修正版 v1.4.1
 * 
 * 作者: 基于用户反馈分析和修正
 * 版本: v1.4.1
 * 更新日志:
 * v1.4.1:
 * 1. 【核心修正】修复了 getTracks 函数在处理 'unknown' 或非标准网盘类型时，不显示任何分类按钮的致命BUG。
 * 2. 【逻辑优化】修改了分类按钮的生成逻辑，从遍历固定的 PAN_TYPE_MAP 改为遍历从数据中动态统计出的 panTypeCounts，确保所有存在的资源类型都会被展示。
 * 3. 【增强兼容】即使网盘类型未知，也能正确显示为 "未知网盘"，保证了界面的健壮性。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v1.4.1] ${msg}`); } else { console.log(`[Gying v1.4.1] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' }; // 'unknown' 现在是预设的一部分
let fullResourceCache = [];
let currentVodId = '';

// ==================== XPTV App 标准接口 (无需修改) ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (流程图版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { url: item.vod_id } })); return jsonify({ list: cards }); }

// --- 【核心】v1.4.1 修正版 getTracks 函数 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || (typeof ext === 'string' ? ext : '');
    log(`getTracks 调用 (第一步): vod_id=${vod_id}`);

    if (vod_id !== currentVodId) {
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
    
    if (fullResourceCache.length === 0) {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何有效网盘资源', pan: '' }] }] });
    }

    const panTypeCounts = fullResourceCache.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {});

    const panFilterButtons = [];
    // 【核心修正】遍历从数据中统计出来的 panTypeCounts 的键，而不是固定的 PAN_TYPE_MAP
    Object.keys(panTypeCounts).forEach(typeCode => {
        const count = panTypeCounts[typeCode];
        // 【兼容性】如果 PAN_TYPE_MAP 中没有这个类型，就用 "未知网盘"
        const typeName = PAN_TYPE_MAP[typeCode] || '未知网盘'; 
        
        panFilterButtons.push({
            name: `${typeName} (${count})`,
            pan: `custom:action=show_pans&pan_type=${typeCode}&url=${encodeURIComponent(vod_id)}`
        });
    });

    return jsonify({ list: [{ title: '云盘', tracks: panFilterButtons }] });
}

// --- getPlayinfo 函数 (与v1.4.0版本完全相同，无需修改) ---
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
    const action = params.get('action');
    const vod_id = params.get('url');
    const pan_type = params.get('pan_type');

    let tracks = [];
    let title = '';

    if (action === 'show_pans') {
        log(`执行第二步: 显示 ${PAN_TYPE_MAP[pan_type] || '未知'} 的资源列表`);
        title = `云盘 - ${PAN_TYPE_MAP[pan_type] || '未知'}`;
        const filtered = fullResourceCache.filter(r => r.type === pan_type);
        tracks = filtered.map(r => ({
            name: `网盘 [${PAN_TYPE_MAP[r.type] || '未知'}]`,
            sub: r.title,
            pan: r.link
        }));
    } else if (action === 'show_files') {
        const originalTitle = decodeURIComponent(params.get('title'));
        log(`执行第三步: 显示文件夹 "${originalTitle}"`);
        title = `文件夹`;
        tracks = [{
            name: `🗂️ ${originalTitle}`,
            pan: decodeURIComponent(params.get('link')) 
        }];
    }

    const rerunExt = {
        id: `rerun:${jsonify({ list: [{ title: title, tracks: tracks }] })}`,
        url: `rerun:${jsonify({ list: [{ title: title, tracks: tracks }] })}`
    };
    
    return jsonify({ urls: [{ name: '加载中...', url: `rerun://${jsonify(rerunExt)}` }] });
}

// ==================== 标准接口转发 (无需修改) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v1.4.1 (兼容性修正版)');
