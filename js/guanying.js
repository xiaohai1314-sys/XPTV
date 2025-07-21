/**
 * Gying 前端插件 - 最终修复版 v3.0
 * 
 * 功能特性:
 * - 完美适配 XPTV App 环境，借鉴"网盘资源社"脚本的成功经验
 * - 与 Gying 后端服务完美配合，支持钻取式两级筛选功能
 * - 修复了前后端接口参数和数据格式不匹配的问题
 * - 强大的错误处理和用户体验优化
 * - 支持分类浏览、搜索、详情查看等完整功能
 * - 修复了网盘资源显示在错误位置的问题
 * - 进一步优化了vod_id的获取逻辑，确保前端请求的正确性
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v3.0 (2024年最终修复版)
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

// 关键字筛选选项
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];

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

// 网盘类型识别函数
function detectPanType(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('百度') || lowerTitle.includes('baidu')) return '0';
    if (lowerTitle.includes('迅雷') || lowerTitle.includes('thunder')) return '1';
    if (lowerTitle.includes('夸克') || lowerTitle.includes('quark')) return '2';
    if (lowerTitle.includes('阿里') || lowerTitle.includes('aliyun')) return '3';
    if (lowerTitle.includes('天翼') || lowerTitle.includes('cloud.189')) return '4';
    if (lowerTitle.includes('115')) return '5';
    if (lowerTitle.includes('uc')) return '6';
    return 'unknown';
}

// ==================== 缓存区 ====================
let fullResourceCache = []; // 详情页资源缓存
let currentPanTypeFilter = 'all'; // 当前网盘类型筛选
let currentKeywordFilter = 'all'; // 当前关键字筛选
let currentVodId = ''; // 当前影片ID

// ==================== XPTV App 标准接口 ====================

/**
 * 插件配置 - App启动时调用
 */
async function getConfig() {
    log(`插件初始化，后端地址: ${API_BASE_URL}`);
    return jsonify({
        ver: 1,
        title: 'Gying观影 (钻取筛选版)',
        site: 'gying.org',
        tabs: [
            { name: '剧集', ext: { id: 'tv' } },
            { name: '电影', ext: { id: 'mv' } },
            { name: '动漫', ext: { id: 'ac' } }
        ]
    });
}

/**
 * 获取分类列表 - 对应后端 /api/vod 接口
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
 * 搜索功能 - 对应后端 /api/search 接口
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
 * 获取详情和资源 - 核心功能，支持钻取式筛选
 * 对应后端 /api/detail 接口
 */
async function getTracks(ext) {
    ext = argsify(ext);
    
    // ====================【代码修改处 - 修复vod_id获取】====================
    // 【最终修复】更稳定地获取 vod_id，防止其成为一个对象
    let vod_id = '';
    if (typeof ext === 'string') {
        vod_id = ext;
    } else if (ext && typeof ext === 'object') {
        // 优先从 vod_id 属性获取，然后是 url、id
        vod_id = ext.vod_id || ext.url || ext.id || '';
    }

    const { pan_type, keyword, action = 'init' } = ext;
    
    log(`getTracks调用: vod_id='${vod_id}', action=${action}, pan_type=${pan_type}, keyword=${keyword}`);

    if (!vod_id) {
        log('错误：无法获取有效的 vod_id');
        return jsonify({ 
            list: [{ 
                title: '云盘', 
                tracks: [{ name: '无法获取影片ID', pan: '' }] 
            }] 
        });
    }
    // ====================【代码修改结束】====================
    
    // 步骤1: 数据获取与缓存管理
    if (action === 'init' || fullResourceCache.length === 0 || currentVodId !== vod_id) {
        // 重置缓存和筛选状态
        fullResourceCache = [];
        currentPanTypeFilter = 'all';
        currentKeywordFilter = 'all';
        currentVodId = vod_id;
        
        log(`首次加载详情: ${vod_id}`);
        
        const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`;
        const data = await request(detailUrl);
        
        if (data.error) {
            log(`详情获取失败: ${data.error}`);
            return jsonify({
                list: [{
                    title: '云盘',
                    tracks: [{ name: '获取资源失败，请检查网络连接', pan: '' }]
                }]
            });
        }
        
        if (!data.list || data.list.length === 0) {
            log('详情数据为空');
            return jsonify({
                list: [{
                    title: '云盘',
                    tracks: [{ name: '未找到相关资源', pan: '' }]
                }]
            });
        }
        
        const playUrlString = data.list[0].vod_play_url;
        if (!playUrlString || playUrlString === '暂无任何网盘资源') {
            log('无有效资源链接');
            return jsonify({
                list: [{
                    title: '云盘',
                    tracks: [{ name: '暂无任何网盘资源', pan: '' }]
                }]
            });
        }
        
        log(`开始解析资源字符串，长度: ${playUrlString.length}`);
        fullResourceCache = playUrlString.split('#').map(item => {
            const parts = item.split('$');
            const title = parts[0] || '';
            const link = parts[1] || '';
            
            if (!title || !link) {
                log(`跳过无效资源: ${item}`);
                return null;
            }
            
            const panType = detectPanType(title);
            return {
                type: panType,
                title: title.trim(),
                link: link.trim()
            };
        }).filter(item => item !== null);
        
        log(`资源解析完成，共 ${fullResourceCache.length} 条有效资源`);
    }
    
    // 步骤2: 处理筛选参数
    if (pan_type !== undefined) {
        currentPanTypeFilter = pan_type;
        log(`更新网盘筛选: ${pan_type}`);
    }
    if (keyword !== undefined) {
        currentKeywordFilter = keyword;
        log(`更新关键字筛选: ${keyword}`);
    }
    
    // 步骤3: 应用筛选逻辑
    let filteredResources = [...fullResourceCache];
    
    // 网盘类型筛选
    if (currentPanTypeFilter !== 'all') {
        filteredResources = filteredResources.filter(r => r.type === currentPanTypeFilter);
    }
    
    // 关键字筛选
    if (currentKeywordFilter !== 'all') {
        const lowerKeyword = currentKeywordFilter.toLowerCase();
        if (lowerKeyword === '其他') {
            // "其他"表示不包含任何预定义关键字的资源
            filteredResources = filteredResources.filter(r => {
                const lowerTitle = r.title.toLowerCase();
                return KEYWORD_FILTERS.slice(0, -1).every(kw => 
                    !lowerTitle.includes(kw.toLowerCase())
                );
            });
        } else {
            filteredResources = filteredResources.filter(r => 
                r.title.toLowerCase().includes(lowerKeyword)
            );
        }
    }
    
    // ====================【代码修改处 - 修复UI显示】====================
    // 步骤4: 构建UI数据 - 简化为单一云盘列表，不显示筛选按钮
    const resultLists = [];
    
    // 直接显示资源列表，不添加筛选按钮
    if (filteredResources.length > 0) {
        const resourceTracks = filteredResources.map(r => {
            const panTypeName = PAN_TYPE_MAP[r.type] || '未知';
            return {
                name: `[${panTypeName}] ${r.title}`,
                pan: r.link
            };
        });
        
        resultLists.push({
            title: '云盘',
            tracks: resourceTracks
        });
    } else {
        resultLists.push({
            title: '云盘',
            tracks: [{ name: '暂无任何网盘资源', pan: '' }]
        });
    }
    // ====================【代码修改结束】====================
    
    log(`UI构建完成: 显示${filteredResources.length}条资源`);
    
    return jsonify({ list: resultLists });
}

/**
 * 播放处理 - 处理真实播放和筛选指令
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan || ext.url || '';
    
    if (panUrl.startsWith('custom:')) {
        // 这是筛选指令，重新调用getTracks刷新UI
        log(`处理筛选指令: ${panUrl}`);
        const paramsStr = panUrl.replace('custom:', '');
        const params = new URLSearchParams(paramsStr);
        const filterExt = Object.fromEntries(params.entries());
        
        // 异步调用getTracks进行UI刷新
        setTimeout(() => {
            getTracks(filterExt);
        }, 100);
        
        // 返回空结果，阻止App执行播放
        return jsonify({ urls: [] });
    }
    
    // 普通链接，正常播放
    log(`准备播放: ${panUrl}`);
    return jsonify({
        urls: [{ name: '点击播放', url: panUrl }]
    });
}

// ==================== 兼容性接口 ====================

/**
 * 以下函数提供对旧版App的兼容性支持
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
    return await getTracks(id);
}

async function play(ext) {
    return await getPlayinfo(ext);
}

// ==================== 调试和状态信息 ====================

// 插件状态检查函数（调试用）
function getPluginStatus() {
    return {
        version: '3.0',
        apiBaseUrl: API_BASE_URL,
        cacheSize: fullResourceCache.length,
        currentFilters: {
            panType: currentPanTypeFilter,
            keyword: currentKeywordFilter,
            vodId: currentVodId
        },
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

log('Gying前端插件加载完成 v3.0');

