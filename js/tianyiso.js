/**
 * XPTV 插件 - reboys.cn 搜索
 * 版本: V3.0 (超简化测试版)
 * 核心: 最小化返回结构，方便调试
 */

// ==================== 配置区 ====================
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";

// ==================== 辅助函数 ====================
function log(msg) { 
    try { $log('[reboys] ' + msg); } 
    catch (_) { console.log('[reboys] ' + msg); } 
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
let searchResultsCache = [];  // 用数组缓存完整搜索结果

// ==================== 初始化 ====================
async function getConfig() {
    log("插件初始化 V2.0");
    return jsonify({
        ver: 1,
        title: 'reboys搜',
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
        // 只在第一页时请求后端
        if (page === 1) {
            const url = BACKEND_URL + '/search?keyword=' + encodeURIComponent(text) + '&page=1';
            
            log('请求后端: ' + url);
            
            const response = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            let result = response;
            if (typeof response === 'string') {
                result = JSON.parse(response);
            } else if (response.data) {
                result = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            }
            
            if (!result || result.code !== 0) {
                log('后端错误: code=' + (result ? result.code : 'null'));
                return jsonify({ list: [] });
            }

            const results = result.data?.data?.results || result.data?.results || result.results || [];
            
            if (results.length === 0) {
                log('无结果');
                return jsonify({ list: [] });
            }
            
            log('✓ 获取到 ' + results.length + ' 条原始结果');
            
            // 清空并重新缓存
            searchResultsCache = results;
            log('✓ 缓存已更新，长度: ' + searchResultsCache.length);
        }
        
        log('当前缓存长度: ' + searchResultsCache.length);
        
        // 从缓存中分页
        const pageSize = 30;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pageResults = searchResultsCache.slice(startIdx, endIdx);
        
        // 映射为 XPTV 格式
        const cards = pageResults.map(function(item, index) {
            const globalIndex = startIdx + index;  // 全局索引
            
            log('映射卡片 ' + globalIndex + ': ' + (item.title || '未知').substring(0, 30));
            
            return {
                vod_id: String(globalIndex),  // "0", "1", "2"...
                vod_name: item.title || '未知',
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: (item.links || []).length + '个网盘'
            };
        });
        
        log('✓ 返回 ' + cards.length + ' 条卡片 (索引 ' + startIdx + '-' + (endIdx-1) + ')');
        return jsonify({ list: cards });
        
    } catch (e) {
        log('搜索异常: ' + e.message);
        return jsonify({ list: [] });
    }
}

// ==================== 详情（关键）====================
async function getTracks(ext) {
    log('==================== getTracks 开始 ====================');
    log('ext 对象: ' + JSON.stringify(ext));
    
    try {
        // 尝试多种方式获取 ID
        let indexStr = '';
        
        if (ext.vod_id) {
            indexStr = ext.vod_id;
            log('从 ext.vod_id 获取: "' + indexStr + '"');
        } else if (ext.url) {
            indexStr = ext.url;
            log('从 ext.url 获取: "' + indexStr + '"');
        } else if (typeof ext === 'string') {
            indexStr = ext;
            log('ext 本身是字符串: "' + indexStr + '"');
        }
        
        log('原始 indexStr: "' + indexStr + '" (类型: ' + typeof indexStr + ')');
        log('当前缓存长度: ' + searchResultsCache.length);
        
        // 尝试解析索引
        const index = parseInt(indexStr);
        
        log('解析后的索引: ' + index + ' (isNaN: ' + isNaN(index) + ')');
        
        if (isNaN(index)) {
            log('❌ 索引解析失败，原始值: "' + indexStr + '"');
            return jsonify({
                list: [{
                    title: '调试信息',
                    tracks: [{ 
                        name: '索引解析失败 | 原始值: "' + indexStr + '" | 类型: ' + typeof indexStr, 
                        pan: '' 
                    }]
                }]
            });
        }
        
        if (index < 0 || index >= searchResultsCache.length) {
            log('❌ 索引越界: ' + index + ', 缓存长度: ' + searchResultsCache.length);
            return jsonify({
                list: [{
                    title: '调试信息',
                    tracks: [{ 
                        name: '索引越界 | 索引: ' + index + ' | 缓存: ' + searchResultsCache.length, 
                        pan: '' 
                    }]
                }]
            });
        }
        
        // 从缓存中获取数据
        const item = searchResultsCache[index];
        log('✓ 从缓存获取到 item');
        
        const title = item.title || '未知';
        const links = item.links || [];
        
        log('标题: "' + title + '"');
        log('链接数: ' + links.length);
        log('完整 item: ' + JSON.stringify(item).substring(0, 200));
        
        if (links.length === 0) {
            log('⚠️ 无可用链接');
            return jsonify({
                list: [{
                    title: title,
                    tracks: [{ name: '该资源暂无可用网盘链接', pan: '' }]
                }]
            });
        }
        
        // 构建播放列表
        const tracks = [];
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const url = link.url || '';
            const password = link.password || '';
            const type = link.type || '';
            
            log('处理链接 ' + (i+1) + ': type=' + type + ', url=' + url.substring(0, 40));
            
            // 识别网盘类型
            let panType = '网盘';
            if (type === 'quark' || url.indexOf('quark.cn') > -1) {
                panType = '夸克';
            } else if (type === 'baidu' || url.indexOf('baidu.com') > -1) {
                panType = '百度';
            } else if (type === 'aliyun' || url.indexOf('aliyundrive.com') > -1 || url.indexOf('alipan.com') > -1) {
                panType = '阿里';
            }
            
            let name = '[' + panType + '] ' + title;
            if (password) {
                name += ' 密码:' + password;
            }
            
            tracks.push({ 
                name: name, 
                pan: url 
            });
            
            log('✓ 添加播放项: ' + name);
        }
        
        log('✓ 返回 ' + tracks.length + ' 个播放项');
        log('==================== getTracks 结束 ====================');
        
        return jsonify({
            list: [{
                title: title,
                tracks: tracks
            }]
        });
        
    } catch (e) {
        log('❌ getTracks 异常: ' + e.message);
        log('堆栈: ' + e.stack);
        return jsonify({
            list: [{
                title: '异常',
                tracks: [{ name: '错误: ' + e.message, pan: '' }]
            }]
        });
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
    log('detail 被调用, id=' + id);
    return getTracks({ vod_id: id }); 
}

async function play(flag, id) { 
    log('play 被调用: ' + (id ? id.substring(0, 50) : 'null'));
    return jsonify({ url: id }); 
}

log('==== reboys 插件加载完成 V2.0 ====');
