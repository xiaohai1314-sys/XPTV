/**
 * Gying 前端插件 - 大道至简版 v1.0.0
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.0.0
 * 更新日志:
 * v1.0.0: 放弃所有复杂的分步交互逻辑，回归最核心的数据展示功能。
 * 1. 【核心】getTracks 函数现在只负责从后端获取数据，并将其直接、完整地渲染成一个列表。
 * 2. 【核心】getPlayinfo 函数现在只负责处理最终的播放链接。
 * 3. 移除了所有全局状态变量和复杂的逻辑判断，确保与APP环境的最大兼容性。
 * 4. 这个版本在逻辑上与成功的 "SeedHub" 插件完全对齐。
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.10.111:3001/api'; // 【重要】请再次确认这是您电脑的正确IP地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数 ====================
function log(msg) { try { if (typeof $log === 'function') { $log(`[Gying] ${msg}`); } else { console.log(`[Gying] ${msg}`); } } catch (e) { console.log(`[Gying-ERROR] log function failed: ${e}`) } }
async function request(url) { try { log(`发起请求: ${url}`); if (typeof $fetch === 'object' && typeof $fetch.get === 'function') { const { data, status } = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }); if (status !== 200) { log(`请求失败: HTTP ${status}`); return { error: `HTTP ${status}` }; } const result = typeof data === 'object' ? data : JSON.parse(data); log(`请求成功`); return result; } else { const response = await fetch(url, { headers: { 'User-Agent': UA } }); if (!response.ok) { log(`请求失败: HTTP ${response.status}`); return { error: `HTTP ${response.status}` }; } const result = await response.json(); log(`请求成功`); return result; } } catch (error) { log(`请求异常: ${error.message}`); return { error: error.message }; } }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }

// ==================== XPTV App 标准接口 ====================
async function getConfig() { log(`插件初始化，后端地址: ${API_BASE_URL}`); return jsonify({ ver: 1, title: 'Gying观影 (至简版)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }, { name: '电影', ext: { id: 'mv' } }, { name: '动漫', ext: { id: 'ac' } }] }); }

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

// --- 【核心】大道至简版的 getTracks ---
async function getTracks(ext) {
    ext = argsify(ext);
    const vod_id = ext.url || ext.id || ext;
    log(`getTracks调用: vod_id=${vod_id}`);

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error) {
        log(`详情获取失败: ${data.error}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败，请检查网络', pan: '' }] }] });
    }
    if (!data.list || data.list.length === 0) {
        log('详情数据为空');
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '未找到相关资源', pan: '' }] }] });
    }
    
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        log('无有效资源链接');
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }
    
    log(`开始解析资源字符串，长度: ${playUrlString.length}`);
    const tracks = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        const title = parts[0] || '未知资源';
        const link = parts[1] || '';
        if (!link) return null;
        return { name: title.trim(), pan: link.trim() };
    }).filter(item => item !== null);

    if (tracks.length === 0) {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '解析后无有效资源', pan: '' }] }] });
    }

    log(`资源解析完成，共 ${tracks.length} 条有效资源`);
    return jsonify({
        list: [
            {
                title: '网盘资源', // 直接显示一个分组
                tracks: tracks,
            },
        ],
    });
}

// --- 【核心】大道至简版的 getPlayinfo ---
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    log(`准备播放: ${panUrl}`);
    return jsonify({ urls: [{ name: '点击播放', url: panUrl }] });
}

// ==================== 标准接口转发 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying前端插件加载完成 (大道至简版)');
