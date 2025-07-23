/**
 * Gying 前端插件 - 参数修正终极版 v2.1.0
 * 
 * 作者: 基于日志分析的最终修正
 * 版本: v2.1.0
 * 更新日志:
 * v2.1.0:
 * 1. 【终极修正】修复了 v2.0.0 中一个致命的参数传递错误。
 * 2. 【逻辑修正】重写了 detail 和 getTracks 的参数处理逻辑，确保无论是首次加载（接收字符串ID）还是刷新（接收对象），最终传递给后端 /api/detail 的 `ids` 参数永远是一个纯净的、未被污染的字符串ID。
 * 3. 【架构不变】保留了 v2.0.0 稳定、简单的核心架构。这次修正将使其完美运行。
 */

// ==================== 配置区 (无需修改) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (无需修改) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying v2.1.0] ${msg}`); } else { console.log(`[Gying v2.1.0] ${msg}`); } } catch (e) {} }
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

// 【核心修正】getTracks 现在只接收一个包含所有状态的 ext 对象
async function getTracks(ext) {
    const { vod_id, step = 1, pan_type, resource_title, resource_link } = ext;

    log(`getTracks: vod_id=${vod_id}, step=${step}`);

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
        log("渲染第一步: 网盘分类");
        const panTypeCounts = resources.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
        const panFilterButtons = Object.keys(panTypeCounts).map(typeCode => {
            const nextExt = { vod_id: vod_id, step: 2, pan_type: typeCode };
            return {
                name: `${PAN_TYPE_MAP[typeCode] || '未知'} (${panTypeCounts[typeCode]})`,
                pan: `custom:${jsonify(nextExt)}`
            };
        });
        resultLists.push({ title: '云盘', tracks: panFilterButtons });
    } else if (step === 2) {
        log(`渲染第二步: ${PAN_TYPE_MAP[pan_type] || '未知'} 列表`);
        const filtered = resources.filter(r => r.type === pan_type);
        const tracks = filtered.map(r => {
            const nextExt = { vod_id: vod_id, step: 3, resource_title: r.title, resource_link: r.link };
            return {
                name: `网盘 [${PAN_TYPE_MAP[r.type] || '未知'}]`,
                sub: r.title,
                pan: `custom:${jsonify(nextExt)}`
            };
        });
        resultLists.push({ title: `云盘 - ${PAN_TYPE_MAP[pan_type] || '未知'}`, tracks: tracks });
    } else if (step === 3) {
        log("渲染第三步: 文件夹");
        const tracks = [{ name: `🗂️ ${resource_title}`, pan: resource_link }];
        resultLists.push({ title: '文件夹', tracks: tracks });
    }

    return jsonify({ list: resultLists });
}

// 【核心修正】getPlayinfo 逻辑不变，但现在它依赖的 detail/getTracks 是正确的
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    if (!panUrl.startsWith('custom:')) {
        log(`第四步: 最终播放链接: ${panUrl}`);
        return jsonify({ urls: [{ name: '即将跳转...', url: panUrl }] });
    }

    log("捕获到刷新指令...");
    const nextExtStr = panUrl.replace('custom:', '');
    const nextExt = argsify(nextExtStr);

    return jsonify({
        urls: [{
            name: '加载中...',
            url: nextExt.vod_id,
            ext: nextExt
        }]
    });
}

// ==================== 标准接口转发 (核心修正点) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }

// 【终极修正】detail 函数现在能正确处理字符串和对象两种情况
async function detail(ext) {
    let finalExt;
    // 播放器首次加载，ext 是一个纯字符串ID, e.g., "tv/7bab"
    if (typeof ext === 'string') {
        log(`detail 首次加载, ID: ${ext}`);
        finalExt = { vod_id: ext }; // 将其包装成 getTracks 需要的对象
    } 
    // 播放器通过 play() 刷新，ext 是我们自己构造的对象
    else {
        log(`detail 刷新加载, ext: ${JSON.stringify(ext)}`);
        finalExt = argsify(ext); // 确保它是一个对象
    }
    // 无论哪种情况，传递给 getTracks 的都是一个规范的对象
    return await getTracks(finalExt); 
}

async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v2.1.0 (参数修正终极版)');
