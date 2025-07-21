/**
 * Gying 前端插件 - 最终修改版 v1.0
 * 
 * 功能特性:
 * - 基于用户提供的可运行版本，进行最小化修改以解决核心问题
 * - 修复ID传递错误，确保后端能正确接收影片ID
 * - 实现简洁的两级钻取功能，避免复杂的仪表盘模式
 * - 统一使用"网盘"术语保持一致性
 * - 其他功能（分类、搜索、配置）保持原有逻辑不变
 * 
 * 作者: 基于用户提供的脚本最小化修改
 * 版本: v1.0 修改版 (2024年)
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请修改为您的后端服务实际地址
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// 网盘类型映射
const PAN_TYPE_MAP = {
    '0': '百度',
    '1': '迅雷', 
    '2': '夸克',
    '3': '阿里',
    '4': '天翼',
    '5': '115',
    '6': 'UC',
    'unknown': '未知'
};

// ==================== 工具函数区 ====================

// 日志函数 - 优先使用App环境的$log
function log(msg) {
    if (typeof $log === 'function') {
        $log(`[Gying] ${msg}`);
    } else {
        console.log(`[Gying] ${msg}`);
    }
}

// 网络请求函数 - 适配App环境的$fetch
async function request(url) {
    try {
        log(`发起请求: ${url}`);
        
        // 优先使用App提供的$fetch
        if (typeof $fetch === 'object' && typeof $fetch.get === 'function') {
            const { data, status } = await $fetch.get(url, {
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            
            if (status !== 200) {
                log(`请求失败: HTTP ${status}`);
                return { error: `HTTP ${status}` };
            }
            
            // $fetch返回的data可能已经是对象，也可能是字符串
            const result = typeof data === 'object' ? data : JSON.parse(data);
            log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`);
            return result;
        } else {
            // 降级使用标准fetch
            const response = await fetch(url, {
                headers: { 'User-Agent': UA }
            });
            
            if (!response.ok) {
                log(`请求失败: HTTP ${response.status}`);
                return { error: `HTTP ${response.status}` };
            }
            
            const result = await response.json();
            log(`请求成功: 获取到 ${result.list ? result.list.length : 0} 条数据`);
            return result;
        }
    } catch (error) {
        log(`请求异常: ${error.message}`);
        return { error: error.message };
    }
}

// JSON序列化函数
function jsonify(obj) {
    return JSON.stringify(obj);
}

// 参数解析函数
function argsify(str) {
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch {
        return {};
    }
}

// ==================== 缓存区 ====================
let fullResourceCache = []; // 详情页资源缓存
let currentVodId = ''; // 当前影片ID

// ==================== XPTV App 标准接口 ====================

/**
 * 插件配置 - App启动时调用 [保持原有逻辑不变]
 */
async function getConfig() {
    log(`插件初始化，后端地址: ${API_BASE_URL}`);
    return jsonify({
        ver: 1,
        title: 'Gying观影 (两级钻取版)',
        site: 'gying.org',
        tabs: [
            { name: '剧集', ext: { id: 'tv' } },
            { name: '电影', ext: { id: 'mv' } },
            { name: '动漫', ext: { id: 'ac' } }
        ]
    });
}

/**
 * 获取分类列表 - 对应后端 /api/vod 接口 [保持原有逻辑不变]
 */
async function getCards(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    
    if (!id) {
        log('缺少分类ID参数');
        return jsonify({ list: [] });
    }
    
    log(`获取分类: ${id}, 页码: ${page}`);
    const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
    const data = await request(url);
    
    if (data.error) {
        log(`分类获取失败: ${data.error}`);
        return jsonify({ list: [], total: 0 });
    }
    
    return jsonify({
        list: data.list || [],
        total: data.total || 0
    });
}

/**
 * 搜索功能 - 对应后端 /api/search 接口 [保持原有逻辑不变]
 */
async function search(ext) {
    ext = argsify(ext);
    const { text } = ext;
    
    if (!text) {
        log('搜索关键词为空');
        return jsonify({ list: [] });
    }
    
    log(`搜索: ${text}`);
    const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
    const data = await request(url);
    
    if (data.error) {
        log(`搜索失败: ${data.error}`);
        return jsonify({ list: [] });
    }
    
    return jsonify({
        list: data.list || []
    });
}

/**
 * 获取详情和资源 - [*** 关键修改：实现简洁的两级钻取功能 ***]
 */
async function getTracks(ext) {
    ext = argsify(ext);
    
    // 【修复】正确提取影片ID，避免传递[object Object]
    let vod_id;
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (ext && typeof ext === 'object') {
        vod_id = ext.id || ext.url;
        // 【关键修复】确保vod_id是字符串，而不是对象
        if (typeof vod_id !== 'string') {
            log(`警告: vod_id不是字符串类型: ${typeof vod_id}, 值: ${vod_id}`);
            vod_id = String(vod_id || '');
        }
    }
    
    if (!vod_id) {
        log('getTracks: 无效的影片ID');
        return jsonify({ 
            list: [{ 
                title: '网盘', 
                tracks: [{ name: '无效的影片ID', pan: '' }] 
            }] 
        });
    }
    
    const { action, pan_type } = ext;
    log(`getTracks调用: vod_id=${vod_id}, action=${action}, pan_type=${pan_type}`);
    
    // 步骤1: 数据获取与缓存管理
    if (action !== 'show_links_for_type' && (fullResourceCache.length === 0 || currentVodId !== vod_id)) {
        currentVodId = vod_id;
        log(`首次加载或影片切换，正在从后端获取资源: ${vod_id}`);
        
        // 【修复】使用正确的参数名 'ids' 而不是 'id'
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        
        if (data.error || !data.list || !data.list[0]) {
            log(`详情获取失败: ${data.error || '无数据'}`);
            fullResourceCache = [];
        } else {
            const playUrlString = data.list[0].vod_play_url;
            if (!playUrlString || playUrlString === '暂无任何网盘资源') {
                fullResourceCache = [];
            } else {
                // 【修改】解析后端返回的新格式 "类型$标题$链接$$$..."
                fullResourceCache = playUrlString.split('$$$').map(item => {
                    const parts = item.split('$');
                    if (parts.length < 3) return null;
                    return { 
                        type: parts[0], 
                        title: parts[1], 
                        link: parts[2] 
                    };
                }).filter(Boolean);
                log(`资源缓存成功，共 ${fullResourceCache.length} 条`);
            }
        }
    }
    
    // 步骤2: 根据action决定返回内容
    if (action === 'show_links_for_type') {
        // --- 场景B: 用户点击了某个网盘类型按钮，展示该类型下的所有链接 ---
        if (!pan_type) {
            return jsonify({ 
                list: [{ 
                    title: '网盘', 
                    tracks: [{ name: '缺少网盘类型参数', pan: '' }] 
                }] 
            });
        }
        
        log(`正在为类型 '${PAN_TYPE_MAP[pan_type] || pan_type}' 构建链接列表...`);
        const filteredLinks = fullResourceCache.filter(r => r.type === pan_type);
        
        if (filteredLinks.length === 0) {
            return jsonify({ 
                list: [{ 
                    title: '网盘', 
                    tracks: [{ name: '该分类下无链接', pan: '' }] 
                }] 
            });
        }
        
        // 为筛选出的每一条链接，创建一个独立的资源块按钮
        const linkButtons = filteredLinks.map(r => ({
            title: '网盘', // 统一使用"网盘"作为标题
            tracks: [{
                name: r.title, // 按钮文字是完整的资源标题
                pan: r.link    // 点击后直接跳转
            }]
        }));

        return jsonify({ list: linkButtons });

    } else {
        // --- 场景A: 首次进入，展示按网盘类型分组的入口按钮 ---
        if (fullResourceCache.length === 0) {
            return jsonify({ 
                list: [{ 
                    title: '网盘', 
                    tracks: [{ name: '暂无任何网盘资源', pan: '' }] 
                }] 
            });
        }

        log('首次进入，正在构建按网盘类型分组的入口按钮...');
        const panGroups = {};
        fullResourceCache.forEach(r => {
            panGroups[r.type] = (panGroups[r.type] || 0) + 1;
        });

        // 为每个分组创建一个"入口按钮"
        const groupButtons = Object.keys(panGroups).map(typeCode => {
            const count = panGroups[typeCode];
            const typeName = PAN_TYPE_MAP[typeCode] || '未知';
            return {
                title: '网盘', // 所有入口按钮都属于"网盘"这个大类
                tracks: [{
                    name: `${typeName}网盘 [${count}]`,
                    pan: `custom:action=show_links_for_type&pan_type=${typeCode}&id=${vod_id}`
                }]
            };
        });
        
        return jsonify({ list: groupButtons });
    }
}

/**
 * 播放处理 - [*** 关键修改：处理两级钻取指令 ***]
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    
    if (panUrl.startsWith('custom:')) {
        // 钻取指令，重新调用 getTracks 进行UI刷新
        log(`处理钻取指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const customExt = Object.fromEntries(params.entries());
        return await getTracks(customExt);
    }
    
    // 普通播放链接
    log(`准备播放: ${panUrl}`);
    return jsonify({
        urls: [{ name: '点击播放', url: panUrl }]
    });
}

// ==================== 兼容性接口 ====================

/**
 * 以下函数提供对旧版App的兼容性支持 [保持原有逻辑不变]
 */

async function init() {
    return await getConfig();
}

async function home(ext) {
    return await getCards(ext);
}

async function category(ext) {
    return await getCards(ext);
}

async function detail(id) {
    // 首次进入详情页，清空缓存并调用 getTracks
    fullResourceCache = [];
    currentVodId = id;
    return await getTracks({ id: id });
}

async function play(ext) {
    return await getPlayinfo(ext);
}

// ==================== 调试和状态信息 ====================

// 插件状态检查函数（调试用）
function getPluginStatus() {
    return {
        version: '1.0 修改版',
        apiBaseUrl: API_BASE_URL,
        cacheSize: fullResourceCache.length,
        currentVodId: currentVodId,
        environment: {
            hasFetch: typeof $fetch !== 'undefined',
            hasLog: typeof $log !== 'undefined'
        }
    };
}

// 导出状态检查函数（可选）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getPluginStatus };
}

log('Gying前端插件加载完成 v1.0 修改版');

