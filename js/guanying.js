/**
 * Gying 前端插件 - 终极修正版 v2.3.0
 * 
 * 作者: 基于对核心错误 "Why not a clean URL?" 的最终反思。
 * 版本: v2.3.0
 * 更新日志:
 * v2.3.0:
 * 1. 【终极修正】彻底修复了导致后端接收到对象而不是字符串ID的致命错误。
 * 2. 【入口防御】重写了 detail 函数，使其成为一个坚不可摧的“ID提取器”。无论播放器以何种方式调用它，无论传入的参数是字符串、对象还是自定义协议，它都能且仅能提取出纯净的 vod_id 字符串。
 * 3. 【职责净化】getTracks 函数的输入被严格限定，它的第一个参数 `vod_id` 必须是一个字符串。这杜绝了任何数据类型污染的可能性。
 * 4. 【稳定架构】保留了 v2.2.0 的稳定交互模型，只修复错误，不引入任何新的不确定性。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v2.3.0] ${msg}`); } else { console.log(`[Gying v2.3.0] ${msg}`); } } catch (e) {} }
async function request(url) { try { log(`发起请求: ${url}`); const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { return { error: `HTTP ${status}` }; } return typeof data === 'object' ? data : JSON.parse(data); } catch (error) { return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };
let fullResourceCache = {};

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying (终极版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
async function getCards(ext) { ext = argsify(ext); const { id, page = 1 } = ext; if (!id) return jsonify({ list: [] }); const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`; const data = await request(url); if (data.error) return jsonify({ list: [], total: 0 }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards, total: data.total || 0 }); }
async function search(ext) { ext = argsify(ext); const { text } = ext; if (!text) return jsonify({ list: [] }); const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`; const data = await request(url); if (data.error) return jsonify({ list: [] }); const cards = (data.list || []).map(item => ({ vod_id: item.vod_id, vod_name: item.vod_name, vod_pic: item.vod_pic, vod_remarks: item.vod_remarks, ext: { vod_id: item.vod_id } })); return jsonify({ list: cards }); }

// 【净化】getTracks 函数现在只接收纯净的参数
async function getTracks(vod_id, step = 1, pan_type = null, resource_title = null, resource_link = null) {
    log(`getTracks 执行: vod_id=${vod_id} (类型: ${typeof vod_id}), step=${step}`);

    if (typeof vod_id !== 'string' || !vod_id) {
        log(`[致命错误] getTracks 接收到无效的 vod_id: ${vod_id}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '内部参数错误', pan: '' }] }] });
    }

    if (!fullResourceCache[vod_id]) {
        log(`缓存未命中，为 ${vod_id} 抓取新数据...`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        if (data.error || !data.list || !data.list[0] || !data.list[0].vod_play_url) {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '获取资源失败或无资源', pan: '' }] }] });
        }
        fullResourceCache[vod_id] = data.list[0].vod_play_url.split('#').map(item => {
            const parts = item.split('$');
            if (parts.length < 2) return null;
            return { title: parts[0], link: parts[1], type: detectPanType(parts[0]) };
        }).filter(Boolean);
    }

    const resources = fullResourceCache[vod_id];
    const resultLists = [];

    if (step === 1) {
        const panTypeCounts = resources.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
        const panFilterButtons = Object.keys(panTypeCounts).map(typeCode => {
            const nextState = { vod_id: vod_id, step: 2, pan_type: typeCode };
            return { name: `${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`, pan: `custom:${jsonify(nextState)}` };
        });
        resultLists.push({ title: '云盘', tracks: panFilterButtons });
    } else if (step === 2) {
        const filtered = resources.filter(r => r.type === pan_type);
        const tracks = filtered.map(r => {
            const nextState = { vod_id: vod_id, step: 3, resource_title: r.title, resource_link: r.link };
            return { name: `网盘 [${PAN_TYPE_MAP[r.type] || '未知'}]`, sub: r.title, pan: `custom:${jsonify(nextState)}` };
        });
        resultLists.push({ title: `云盘 - ${PAN_TYPE_MAP[pan_type] || '未知'}`, tracks: tracks });
    } else if (step === 3) {
        const tracks = [{ name: `🗂️ ${resource_title}`, pan: resource_link }];
        resultLists.push({ title: '文件夹', tracks: tracks });
    }

    return jsonify({ list: resultLists });
}

// 【净化】getPlayinfo 现在只负责解析指令
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (!panUrl.startsWith('custom:')) {
        return jsonify({ urls: [{ name: '即将跳转...', url: panUrl }] });
    }

    const nextStateStr = panUrl.replace('custom:', '');
    const nextState = argsify(nextStateStr);

    return jsonify({
        urls: [{
            name: '加载中...',
            url: `custom_detail://${jsonify(nextState)}`
        }]
    });
}

// ==================== 标准接口转发 (终极修正) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }

// 【终极防御】detail 函数现在是坚不可摧的“ID提取器”
async function detail(ext) {
    let vod_id, step, pan_type, resource_title, resource_link;

    // 场景1: 播放器通过 play() 刷新，我们自己构造的自定义协议
    if (typeof ext === 'string' && ext.startsWith('custom_detail://')) {
        log("detail 通过自定义协议刷新...");
        const stateStr = ext.replace('custom_detail://', '');
        const state = argsify(stateStr);
        vod_id = state.vod_id;
        step = state.step;
        pan_type = state.pan_type;
        resource_title = state.resource_title;
        resource_link = state.resource_link;
    } 
    // 场景2: 播放器首次加载，ext 就是纯字符串ID
    else if (typeof ext === 'string') {
        log(`detail 首次加载, ID: ${ext}`);
        vod_id = ext;
    }
    // 场景3: 播放器通过某种未知方式传递了对象 (兼容旧的刷新方式)
    else if (typeof ext === 'object' && ext !== null && ext.vod_id) {
        log("detail 通过 ext 对象刷新...");
        vod_id = ext.vod_id;
        step = ext.step;
        pan_type = ext.pan_type;
        resource_title = ext.resource_title;
        resource_link = ext.resource_link;
    }

    // 最终防线：如果 vod_id 仍然不是字符串，就彻底放弃
    if (typeof vod_id !== 'string' || !vod_id) {
        log(`[致命错误] detail 函数无法从参数中提取 vod_id: ${JSON.stringify(ext)}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '无法识别影片ID', pan: '' }] }] });
    }

    // 将纯净的参数传递给 getTracks
    return await getTracks(vod_id, step, pan_type, resource_title, resource_link);
}

async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v2.3.0 (终极修正版)');
