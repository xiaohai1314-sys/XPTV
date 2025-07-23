/**
 * Gying 前端插件 - 像素级模仿SeedHub版 v5.0.0
 * 
 * 作者: 基于用户反馈和参考代码的最终实现
 * 版本: v5.0.0 (像素级模仿SeedHub版)
 * 更新日志:
 * v5.0.0: 
 * 1. 【回归初心】放弃所有自定义的分步逻辑，完全模仿 SeedHub 插件的行为模式。
 * 2. 【简化 getTracks】getTracks 函数现在只做一件事：获取所有资源链接，并以最简单的单分组列表形式返回。
 * 3. 【简化 getPlayinfo】getPlayinfo 函数也回归到最简单的模式，只负责传递播放链接。
 * 4. 【核心思想】插件只负责提供数据，将所有复杂的交互（如转存、解析文件夹）完全交由APP的核心功能处理。
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
async function getConfig() { log(`插件初始化`); return jsonify({ ver: 1, title: 'Gying观影 (模仿版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }
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

// --- 【核心实现：v5.0 像素级模仿SeedHub版】 ---
async function getTracks(ext) {
    ext = argsify(ext);
    let vod_id = ext.url || ext.id || ext;
    if (typeof ext === 'string') { vod_id = ext; }

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);
    if (data.error || !data.list || data.list.length === 0) {
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    
    // 1. 将所有资源解析出来
    const resourceList = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (!parts[0] || !parts[1]) return null;
        const type = detectPanType(parts[0]);
        const typeName = PAN_TYPE_MAP[type] ? `[${PAN_TYPE_MAP[type][0]}]` : '[未知]';
        return {
            // 2. 按钮名称直接就是资源标题
            name: `网盘${typeName} ${parts[0].trim()}`,
            // 3. pan属性就是真实的、可直接处理的链接
            pan: parts[1].trim()
        };
    }).filter(Boolean);

    // 4. 以最简单的、和SeedHub一样的单分组结构返回
    return jsonify({
        list: [{
            title: '云盘资源', // 一个固定的分组标题
            tracks: resourceList,
        }],
    });
}

async function getPlayinfo(ext) {
    // 同样，保持最简单的模式
    ext = argsify(ext);
    const playUrl = ext.pan || ext.url;
    return jsonify({ urls: [{ name: '点击播放', url: playUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks({ id: id }); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 v5.0.0 (像素级模仿SeedHub版)');
