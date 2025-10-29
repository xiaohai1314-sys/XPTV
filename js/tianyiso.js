/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V8.0 (detail(id) + Base64 最终版)
 * 作者: Manus AI
 * 核心:
 * 1. 确认App通过 detail(id) 接口进入详情页，id值为search中设置的vod_id。
 * 2. 为防止 vod_id 过长被截断或转义，将包含所有信息的JSON字符串进行Base64编码。
 * 3. 所有详情解析逻辑在 detail(id) 函数内闭环完成，Base64解码 -> JSON解析 -> 返回结果。
 * 4. 此方案无任何全局变量依赖，是目前最稳健的无状态实现。
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 辅助函数 ====================
function log(msg ) { 
    try { $log('[reboys-v8] ' + msg); } 
    catch (_) { console.log('[reboys-v8] ' + msg); } 
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

// Base64 编码/解码函数 (纯JS实现，无需外部库)
const Base64 = {
    encode: (str) => {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            return str; // 编码失败则返回原字符串
        }
    },
    decode: (str) => {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            return ''; // 解码失败返回空
        }
    }
};

// ==================== 初始化 ====================
async function getConfig() {
    log("插件初始化 V8.0 (detail+Base64最终版)");
    return jsonify({ ver: 1, title: 'reboys搜(终版)', site: SITE_URL, tabs: [] });
}

// ==================== 搜索 (核心修正) ====================
async function search(ext) {
    ext = (typeof ext === 'string' ? JSON.parse(ext) : ext) || {};
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
            const item_data = {
                title: item.title || '未知标题',
                links: item.links || []
            };
            // ★ 核心：将打包好的JSON字符串进行Base64编码
            const vod_id_b64 = Base64.encode(JSON.stringify(item_data));
            
            return {
                vod_id: vod_id_b64, // vod_id 是Base64编码后的字符串
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: (item.links || []).length + '个网盘'
            };
        });
        
        const pageSize = 30;
        const startIdx = (page - 1) * pageSize;
        const pageCards = cards.slice(startIdx, startIdx + pageSize);

        return jsonify({ list: pageCards });
        
    } catch (e) {
        log('搜索异常: ' + e.message);
        return jsonify({ list: [] });
    }
}

// ==================== 详情 (最终核心逻辑) ====================
async function detail(id) {
    log('==================== detail V8 开始 ====================');
    // id 参数就是我们在 search 中设置的 Base64 编码的 vod_id
    
    try {
        if (!id || typeof id !== 'string') {
            throw new Error('无效的项目ID，App未传递数据');
        }
        log('收到的Base64 ID(部分): ' + id.substring(0, 100));
        
        // ★ 核心：Base64解码 -> JSON解析
        const decoded_json = Base64.decode(id);
        if (!decoded_json) throw new Error('Base64解码失败，ID可能被截断');
        
        const item = JSON.parse(decoded_json);
        
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
        
        // ★ 核心：detail函数需要返回一个包含 list 字段的对象
        return jsonify({
            list: [{
                // 这里可以填一些详情页的元数据，但关键是 vod_play_url
                vod_name: title,
                vod_play_from: "网盘",
                // 将tracks拼接成播放器需要的格式
                vod_play_url: tracks.map(t => `${t.name}$${t.pan}`).join('#')
            }]
        });

    } catch (e) {
        log('处理异常: ' + e.message);
        // 返回一个空的详情结构
        return jsonify({ list: [{ vod_name: '加载失败', vod_play_from: "错误", vod_play_url: `${e.message}$` }] });
    }
}


// ==================== 兼容接口 (现在它们是次要的) ====================
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [], filters: {} }); }
async function category(tid, pg) { return jsonify({ list: [] }); }
// getTracks 理论上不会被调用，但为以防万一保留一个空实现
async function getTracks(ext) { return jsonify({ list: [] }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== reboys 插件加载完成 V8.0 ====');
