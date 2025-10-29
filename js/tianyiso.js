/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V7.0 (ext传递最终版)
 * 作者: Manus AI
 * 核心:
 * 1. 最终发现：App通过 ext 字段而非 vod_id 传递详情数据。
 * 2. search函数将单条结果的所有信息打包成对象，存入 ext 字段。
 * 3. getTracks 函数直接从传入的 ext 参数中解码数据，实现无缝、无缓存、无ID依赖的链接获取。
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 辅助函数 ====================
function log(msg ) { 
    try { $log('[reboys-v7] ' + msg); } 
    catch (_) { console.log('[reboys-v7] ' + msg); } 
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
    log("插件初始化 V7.0 (ext传递最终版)");
    return jsonify({ ver: 1, title: 'reboys搜(ext终版)', site: SITE_URL, tabs: [] });
}

// ==================== 搜索 (核心修正) ====================
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1; 

    if (!text) return jsonify({ list: [] });
    log('搜索: "' + text + '"');
    
    try {
        const url = BACKEND_URL + '/search?keyword=' + encodeURIComponent(text) + '&page=1';
        log('请求后端: ' + url);
        
        const response = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
        
        let result = (typeof response.data === 'string') ? JSON.parse(response.data) : (response.data || response);
        if (!result || result.code !== 0) throw new Error('后端返回错误');

        const results = result.data?.data?.results || result.data?.results || result.results || [];
        
        const cards = results.map(item => {
            // ★ 核心：将所有信息打包成一个对象
            const ext_data = {
                title: item.title || '未知标题',
                links: item.links || []
            };
            return {
                vod_id: item.unique_id || new Date().getTime(), // vod_id 随便填，App不用它
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: (item.links || []).length + '个网盘',
                // ★ 核心：将打包好的对象存入 ext 字段
                ext: ext_data
            };
        });
        
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

// ==================== 详情 (核心修正) ====================
async function getTracks(ext) {
    log('==================== getTracks V7 开始 ====================');
    // ext 参数就是我们在 search 函数中设置的 ext_data 对象
    
    try {
        if (!ext || typeof ext.links === 'undefined') {
            throw new Error('无效的项目数据，App未传递ext对象');
        }
        
        const title = ext.title || '未知';
        const links = ext.links || [];

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
// detail 函数现在也需要正确处理
async function detail(ext) { 
    // App 调用 detail 时，传入的参数可能就是 search 返回的整个卡片对象
    // 我们直接从中取出 ext 字段来调用 getTracks
    const detail_ext = (typeof ext === 'string' ? argsify(ext) : ext);
    return getTracks(detail_ext.ext || detail_ext); 
}
async function play(flag, id) { return jsonify({ url: id }); }

log('==== reboys 插件加载完成 V7.0 ====');
