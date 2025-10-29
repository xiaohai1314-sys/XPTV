/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V6.0 (无缓存最终版)
 * 作者: Manus AI
 * 核心:
 * 1. 彻底放弃全局缓存，解决App环境重置导致数据丢失的问题。
 * 2. 模仿成功案例，将单条结果的所有信息（包括链接）打包成JSON字符串，存入 vod_id。
 * 3. getTracks 函数只依赖 vod_id 解码，不访问任何全局变量，实现“自给自足”。
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 辅助函数 ====================
function log(msg ) { 
    try { $log('[reboys-v6] ' + msg); } 
    catch (_) { console.log('[reboys-v6] ' + msg); } 
}

function argsify(ext) { 
    if (typeof ext === 'string') { 
        try { return JSON.parse(ext); } 
        catch (e) { return {}; }
    } 
    return ext || {}; 
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

// ==================== 初始化 ====================
async function getConfig() {
    log("插件初始化 V6.0 (无缓存最终版)");
    return jsonify({ ver: 1, title: 'reboys搜(无缓存)', site: SITE_URL, tabs: [] });
}

// ==================== 搜索 ====================
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    // 注意：此模式下，后端分页无效，因为我们只请求一次
    const page = ext.page || 1; 

    if (!text) return jsonify({ list: [] });
    log('搜索: "' + text + '"');
    
    try {
        // 每次搜索都重新请求，因为我们不使用全局缓存
        const url = BACKEND_URL + '/search?keyword=' + encodeURIComponent(text) + '&page=1';
        log('请求后端: ' + url);
        
        const response = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
        
        let result;
        if (typeof response === 'string') result = JSON.parse(response);
        else if (response.data) result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        else result = response;
        
        if (!result || result.code !== 0) throw new Error('后端返回错误');

        const results = result.data?.data?.results || result.data?.results || result.results || [];
        
        // ★ 核心：将每一条结果都打包成独立的 vod_id
        const cards = results.map(item => {
            const vod_id_data = {
                title: item.title || '未知标题',
                links: item.links || []
            };
            return {
                // vod_id 是一个包含了该条目所有必须信息的JSON字符串
                vod_id: jsonify(vod_id_data),
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: (item.links || []).length + '个网盘'
            };
        });
        
        // 此模式下前端分页意义不大，但为兼容保留
        const pageSize = 30;
        const startIdx = (page - 1) * pageSize;
        const pageCards = cards.slice(startIdx, startIdx + pageSize);

        log('✓ 返回 ' + pageCards.length + ' 条卡片');
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log('搜索异常: ' + e.message);
        return jsonify({ list: [] });
    }
}

// ==================== 详情 (无缓存核心逻辑) ====================
async function getTracks(ext) {
    log('==================== getTracks V6 开始 ====================');
    ext = argsify(ext);
    
    try {
        // 期望 ext.vod_id 就是我们打包的JSON字符串
        const vod_id_string = ext.vod_id;
        if (!vod_id_string || typeof vod_id_string !== 'string' || !vod_id_string.startsWith('{')) {
            throw new Error('无效的项目ID，App未传递正确数据');
        }

        log('收到的 vod_id 字符串(部分): ' + vod_id_string.substring(0, 100));
        
        // 直接解析 vod_id 字符串来获取数据
        const item = JSON.parse(vod_id_string);
        
        const title = item.title || '未知';
        const links = item.links || [];

        if (links.length === 0) throw new Error('该资源暂无可用链接');

        const tracks = links.map(link => {
            let panType = '网盘';
            const url = link.url || '';
            if (link.type === 'quark' || url.includes('quark.cn')) panType = '夸克';
            else if (link.type === 'baidu' || url.includes('baidu.com')) panType = '百度';
            else if (link.type === 'aliyun' || url.includes('aliyundrive.com')) panType = '阿里';
            
            let name = `[${panType}] ${title}`;
            if (link.password) name += ` 密码:${link.password}`;
            
            return { name: name, pan: url };
        });

        log('✓ 成功构建 ' + tracks.length + ' 个播放项');
        return jsonify({ list: [{ title: '播放列表', tracks: tracks }] });

    } catch (e) {
        log('处理异常: ' + e.message);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: e.message, pan: '' }] }] });
    }
}

// ==================== 兼容接口 ====================
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [], filters: {} }); }
async function category(tid, pg) { return jsonify({ list: [] }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== reboys 插件加载完成 V6.0 ====');
