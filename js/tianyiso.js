/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V3.1 (最终修正版)
 * 作者: Manus AI
 * 核心:
 * 1. 采用“后端一次性全量搜索 + 前端缓存分页”模式。
 * 2. 修复 getTracks 函数，使其能正确从缓存中提取后端返回的网盘链接。
 * 3. 解决了因 vod_id 传递问题导致的“索引解析失败”。
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000"; // 请确保这是您后端服务的正确地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 辅助函数 ====================
function log(msg ) { 
    try { $log('[reboys-fix] ' + msg); } 
    catch (_) { console.log('[reboys-fix] ' + msg); } 
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

// ==================== 全局变量 ====================
let searchResultsCache = [];  // 用数组缓存后端返回的完整搜索结果

// ==================== 初始化 ====================
async function getConfig() {
    log("插件初始化 V3.1 (最终修正版)");
    return jsonify({
        ver: 1,
        title: 'reboys搜(修)',
        site: SITE_URL,
        tabs: []
    });
}

// ==================== 搜索 ====================
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        return jsonify({ list: [] });
    }

    log('搜索: "' + text + '", 页码: ' + page);
    
    try {
        // 只在第一页时请求后端，获取全量数据并缓存
        if (page === 1) {
            const url = BACKEND_URL + '/search?keyword=' + encodeURIComponent(text) + '&page=1';
            log('请求后端获取全量数据: ' + url);
            
            const response = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            let result;
            if (typeof response === 'string') {
                result = JSON.parse(response);
            } else if (response.data) {
                result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            } else {
                result = response;
            }
            
            if (!result || result.code !== 0) {
                log('后端错误: code=' + (result ? result.code : 'null'));
                return jsonify({ list: [] });
            }

            // 兼容多种可能的返回路径
            const results = result.data?.data?.results || result.data?.results || result.results || [];
            
            if (results.length === 0) {
                log('后端返回结果为空');
                searchResultsCache = []; // 清空缓存
                return jsonify({ list: [] });
            }
            
            log('✓ 获取到 ' + results.length + ' 条原始结果');
            
            // 清空并重新缓存全量数据
            searchResultsCache = results;
            log('✓ 缓存已更新，总长度: ' + searchResultsCache.length);
        } else {
            log('使用现有缓存，总长度: ' + searchResultsCache.length);
        }
        
        // 从缓存中进行分页
        const pageSize = 30; // 每页显示30条
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = searchResultsCache.slice(startIdx, endIdx);
        
        // 映射为 XPTV 卡片格式
        const cards = pageResults.map(function(item, index) {
            const globalIndex = startIdx + index;  // 计算全局索引
            
            return {
                vod_id: String(globalIndex),  // 使用全局索引作为唯一ID, "0", "1", "2"...
                vod_name: item.title || '未知标题',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: (item.links || []).length + '个网盘'
            };
        });
        
        log('✓ 返回 ' + cards.length + ' 条卡片 (页码 ' + page + ')');
        return jsonify({ list: cards });
        
    } catch (e) {
        log('搜索异常: ' + e.message);
        return jsonify({ list: [] });
    }
}

// ==================== 详情（已修正）====================
async function getTracks(ext) {
    log('==================== getTracks 开始 (已修正) ====================');
    ext = argsify(ext);
    log('接收到 ext 对象: ' + JSON.stringify(ext));
    
    try {
        // 1. 健壮地获取索引ID字符串
        let indexStr = ext.vod_id || ext.url || (typeof ext === 'string' ? ext : '');
        log('原始 indexStr: "' + indexStr + '"');
        
        // 2. 解析为数字索引
        const index = parseInt(indexStr);
        
        if (isNaN(index)) {
            log('❌ 索引解析失败，无法转换为数字。');
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '无法解析项目ID，请返回重试', pan: '' }] }] });
        }
        
        log('解析后的索引: ' + index);
        log('当前缓存长度: ' + searchResultsCache.length);

        // 3. 检查索引是否在缓存范围内
        if (index < 0 || index >= searchResultsCache.length) {
            log('❌ 索引越界。可能是缓存已过期，请重新搜索。');
            return jsonify({ list: [{ title: '错误', tracks: [{ name: '找不到该项目，请重新搜索', pan: '' }] }] });
        }
        
        // 4. 从缓存中获取数据 (核心)
        const item = searchResultsCache[index];
        log('✓ 从缓存成功获取到项目');
        
        const title = item.title || '未知';
        const links = item.links || [];
        
        if (links.length === 0) {
            log('⚠️ 该项目没有可用的网盘链接');
            return jsonify({ list: [{ title: title, tracks: [{ name: '该资源暂无可用网盘链接', pan: '' }] }] });
        }
        
        // 5. 构建播放列表
        const tracks = links.map(link => {
            let panType = '网盘';
            const url = link.url || '';
            if (link.type === 'quark' || url.includes('quark.cn')) {
                panType = '夸克';
            } else if (link.type === 'baidu' || url.includes('baidu.com')) {
                panType = '百度';
            } else if (link.type === 'aliyun' || url.includes('aliyundrive.com') || url.includes('alipan.com')) {
                panType = '阿里';
            }
            
            let name = `[${panType}] ${title}`;
            if (link.password) {
                name += ` 密码:${link.password}`;
            }
            
            return { 
                name: name, 
                pan: url 
            };
        });
        
        log('✓ 成功构建 ' + tracks.length + ' 个播放项');
        
        return jsonify({
            list: [{
                title: '播放列表',
                tracks: tracks
            }]
        });
        
    } catch (e) {
        log('❌ getTracks 发生未知异常: ' + e.message);
        return jsonify({ list: [{ title: '异常', tracks: [{ name: '处理失败: ' + e.message, pan: '' }] }] });
    }
}

// ==================== 兼容接口 ====================
async function init() { 
    return getConfig(); 
}

async function home() {
    return jsonify({ class: [], filters: {} });
}

async function category(tid, pg) {
    return jsonify({ list: [] });
}

async function getCards(ext) {
    return jsonify({ list: [] });
}

async function detail(id) { 
    log('兼容接口 detail 被调用, id=' + id);
    return getTracks({ vod_id: id }); 
}

async function play(flag, id) { 
    log('兼容接口 play 被调用, id=' + (id ? id.substring(0, 50) : 'null'));
    return jsonify({ url: id }); 
}

log('==== reboys 插件加载完成 V3.1 (最终修正版) ====');
