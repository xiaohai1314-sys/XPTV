/**
 * Gying 前端插件 - 纯三步交互版 v1.0.0
 * 
 * 作者: 基于用户能成功运行的脚本进行修改
 * 版本: v1.0.0
 * 更新日志:
 * v1.0.0: 
 * 1. 【回归初心】: 以用户最初能成功运行的脚本为基础，不做任何多余改动。
 * 2. 【核心修改】: 仅修改 getTracks 和 getPlayinfo 函数，以实现“选择网盘 -> 选择资源 -> 播放”的三步交互逻辑。
 * 3. 【状态管理】: 引入最简单的全局变量来跟踪用户当前的选择步骤。
 * 4. 【后端假设】: 严格假定后端能返回一个包含 "vod_play_url" 的、格式正确的 JSON。
 */

// ==================== 配置区 (与您原版一致) ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数、配置、缓存区 (与您原版一致) ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }
function detectPanType(title) { const lowerTitle = title.toLowerCase(); if (lowerTitle.includes('百度')) return '0'; if (lowerTitle.includes('迅雷')) return '1'; if (lowerTitle.includes('夸克')) return '2'; if (lowerTitle.includes('阿里')) return '3'; if (lowerTitle.includes('天翼')) return '4'; if (lowerTitle.includes('115')) return '5'; if (lowerTitle.includes('uc')) return '6'; return 'unknown'; }
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '未知' };

// 【核心】引入最简单的状态管理
let fullResourceCache = [];
let currentVodId = '';

// ==================== XPTV App 标准接口 (大部分与您原版一致) ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (三步版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    if (!id) { log('缺少分类ID参数'); return jsonify({ list: [] }); }
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    if (data.error) { log(`分类获取失败: ${data.error}`); return jsonify({ list: [], total: 0 }); }

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
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

    const cards = (data.list || []).map(item => ({
        vod_id: item.vod_id,
        vod_name: item.vod_name,
        vod_pic: item.vod_pic,
        vod_remarks: item.vod_remarks,
        ext: { url: item.vod_id }
    }));
    return jsonify({ list: cards });
}

// --- 【核心修改】getTracks 函数，负责第一步和第二步的显示 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || ext;
    const { step = 'step1', pan_type } = ext; // 默认是第一步
    log(`getTracks: vod_id=${vod_id}, step=${step}, pan_type=${pan_type}`);

    // 只有在第一次加载时才从后端请求数据
    if (step === 'step1' || currentVodId !== vod_id) {
        currentVodId = vod_id;
        log(`首次加载或刷新，请求后端数据: ${vod_id}`);
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);

        if (data.error || !data.list || data.list.length === 0) {
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
        }
        
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString === '暂无任何网盘资源') {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
        }
        
        // 解析并缓存所有资源
        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            return { title: (parts[0] || '').trim(), link: (parts[1] || '').trim(), type: detectPanType(parts[0] || '') };
        }).filter(item => item.link);
        log(`资源缓存成功，共 ${fullResourceCache.length} 条`);
    }

    // 【第一步：显示网盘分类】
    if (step === 'step1') {
        log('执行第一步：显示网盘分类');
        const panTypeCounts = {};
        fullResourceCache.forEach(r => {
            if (r.type !== 'unknown') {
                panTypeCounts[r.type] = (panTypeCounts[r.type] || 0) + 1;
            }
        });

        const panTypeButtons = Object.keys(panTypeCounts).map(typeCode => ({
            name: `${PAN_TYPE_MAP[typeCode]} (${panTypeCounts[typeCode]})`,
            // 点击按钮，将进入第二步，并把网盘类型传过去
            pan: `custom:step=step2&pan_type=${typeCode}&id=${encodeURIComponent(vod_id)}`
        }));

        if (panTypeButtons.length === 0) {
            return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到可分类的网盘资源', pan: '' }] }] });
        }

        return jsonify({ list: [{ title: '第一步：请选择网盘', tracks: panTypeButtons }] });
    }

    // 【第二步：显示所选网盘的所有资源】
    if (step === 'step2') {
        log(`执行第二步：显示网盘 [${PAN_TYPE_MAP[pan_type]}] 的资源`);
        const filteredResources = fullResourceCache.filter(r => r.type === pan_type);

        const resourceButtons = filteredResources.map(r => ({
            name: r.title,
            // 点击按钮，将进入第三步（播放）
            pan: r.link
        }));
        
        return jsonify({ list: [{ title: `第二步：请选择资源`, tracks: resourceButtons }] });
    }
}

// --- 【核心修改】getPlayinfo 函数，负责处理交互和第三步（播放） ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';

    // 如果 pan 链接是 "custom:" 开头的，说明是交互指令，需要重新调用 getTracks
    if (panUrl.startsWith('custom:')) {
        log(`处理交互指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const nextStepExt = Object.fromEntries(params.entries());
        
        // 关键：用 setTimeout 延迟执行，确保APP有时间刷新界面
        setTimeout(() => {
            getTracks(nextStepExt);
        }, 100);

        return jsonify({ urls: [] }); // 返回空数组，告诉APP不要播放
    }

    // 【第三步：播放】
    // 如果 pan 链接是普通的 http 链接 ，说明是最终的播放指令
    log(`执行第三步：准备播放链接: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// ==================== 标准接口转发 (与您原版一致) ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); } // 首次进入详情页，默认执行 getTracks 的第一步
async function play(ext) { return await getPlayinfo(ext); } // 所有点击事件都由 play 函数处理

log('Gying前端插件加载完成 (纯三步交互版)');
