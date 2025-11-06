/**
 * 观影网脚本 - v18.2 (搜索缓存增强版)
 *
 * --- 更新说明 ---
 * 基于 v18.0 架构升级版
 * ✨ 新增搜索缓存机制,防止搜索结果无限重复
 * ✨ 前端智能分页,一次加载所有结果后自动切割
 * ✨ 关键词变化自动重置缓存
 * ✨ 页码越界保护,避免空白页面
 */

// ================== 配置区 ==================
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const BACKEND_URL = 'http://192.168.10.105:5000'; 
const PAGE_SIZE = 20; // 每页显示的项目数量

const appConfig = {
    ver: 18.1,
    title: '观影网 (搜索缓存版)',
    site: 'https://www.gying.org/',
    tabs: [
        { name: '电影', ext: { id: 'mv?page=' } },
        { name: '剧集', ext: { id: 'tv?page=' } },
        { name: '动漫', ext: { id: 'ac?page=' } },
    ],
};

// ================== 搜索缓存对象 ==================
const searchCache = {
    keyword: '',      // 当前搜索关键词
    allData: [],      // 完整数据列表
    pagecount: 0,     // 总页数
    total: 0,         // 总记录数
    loaded: false     // 是否已加载
};

// ================== 工具函数 ==================
function log(msg) { 
    try { 
        $log(`[观影网 V18.1] ${msg}`); 
    } catch (_) { 
        console.log(`[观影网 V18.1] ${msg}`); 
    } 
}

function argsify(ext) { 
    if (typeof ext === 'string') { 
        try { 
            return JSON.parse(ext); 
        } catch (e) { 
            return {}; 
        } 
    } 
    return ext || {}; 
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

// ================== 核心函数 ==================

async function init(ext) {
    return jsonify({});
}

async function getConfig() {
    return jsonify(appConfig);
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    
    // 参数验证
    if (!id) {
        log(`❌ 缺少分类ID参数，ext: ${JSON.stringify(ext)}`);
        $utils.toastError('分类ID缺失', 3000);
        return jsonify({ list: [] });
    }
    
    const url = `${BACKEND_URL}/getCards?id=${id}&page=${page}`;
    log(`请求后端获取卡片列表: ${url}`);

    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        log(`✅ 成功从后端获取到 ${result.list.length} 个项目。`);
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 请求后端卡片列表异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url; 
    const url = `${BACKEND_URL}/getTracks?url=${encodeURIComponent(detailUrl)}`;
    log(`请求后端获取详情数据: ${url}`);
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }
        if (result.message) {
            $utils.toastError(result.message, 4000);
        }
        return jsonify({ list: result.list });
    } catch (e) {
        log(`❌ 获取详情数据异常: ${e.message}`);
        $utils.toastError(`加载失败: ${e.message}`, 4000);
        return jsonify({ list: [] });
    }
}

// ================== 【核心改造】搜索函数 - 带缓存机制 ==================
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;
    
    if (!text) {
        log('❌ 搜索关键词为空');
        return jsonify({ list: [], pagecount: 0, total: 0 });
    }

    log(`🔍 搜索请求 - 关键词: "${text}", 页码: ${page}`);

    // ===== 步骤1: 检测关键词是否变化,变化则重置缓存 =====
    if (searchCache.keyword !== text) {
        log(`📝 检测到新关键词 "${text}", 清空旧缓存`);
        searchCache.keyword = text;
        searchCache.allData = [];
        searchCache.pagecount = 0;
        searchCache.total = 0;
        searchCache.loaded = false;
    }

    // ===== 步骤2: 如果已加载过,直接从缓存切割数据 =====
    if (searchCache.loaded && searchCache.allData.length > 0) {
        log(`✅ 命中缓存, 总数据: ${searchCache.total}条, 请求第${page}页`);
        
        // 页码越界保护
        if (page > searchCache.pagecount) {
            log(`⚠️ 页码越界 (请求: ${page}, 总页数: ${searchCache.pagecount})`);
            return jsonify({ 
                list: [], 
                pagecount: searchCache.pagecount, 
                total: searchCache.total 
            });
        }

        // 切割当前页数据
        const startIndex = (page - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const pageData = searchCache.allData.slice(startIndex, endIndex);
        
        log(`📄 返回缓存数据: ${pageData.length}条 (索引 ${startIndex}-${endIndex})`);
        
        return jsonify({ 
            list: pageData, 
            pagecount: searchCache.pagecount, 
            total: searchCache.total 
        });
    }

    // ===== 步骤3: 首次搜索,请求后端加载所有数据 =====
    log(`🌐 首次搜索 "${text}", 正在请求后端...`);
    const url = `${BACKEND_URL}/search?text=${encodeURIComponent(text)}`;
    
    try {
        const { data } = await $fetch.get(url);
        const result = JSON.parse(data);
        
        if (result.status !== "success") {
            throw new Error(result.message || '后端返回错误');
        }

        // 保存所有数据到缓存
        searchCache.allData = result.list || [];
        searchCache.total = searchCache.allData.length;
        searchCache.pagecount = Math.ceil(searchCache.total / PAGE_SIZE) || 1;
        searchCache.loaded = true;

        log(`✅ 成功加载 ${searchCache.total} 条结果, 共 ${searchCache.pagecount} 页`);

        // 如果没有结果
        if (searchCache.total === 0) {
            $utils.toastError(`未找到 "${text}" 的相关结果`, 3000);
            return jsonify({ list: [], pagecount: 0, total: 0 });
        }

        // 切割第一页数据
        const pageData = searchCache.allData.slice(0, PAGE_SIZE);
        
        log(`📄 返回第1页数据: ${pageData.length}条`);
        
        return jsonify({ 
            list: pageData, 
            pagecount: searchCache.pagecount, 
            total: searchCache.total 
        });

    } catch (e) {
        log(`❌ 搜索异常: ${e.message}`);
        $utils.toastError(`搜索失败: ${e.message}`, 4000);
        
        // 出错时重置缓存状态
        searchCache.loaded = false;
        
        return jsonify({ list: [], pagecount: 0, total: 0 });
    }
}

// ================== 播放信息 ==================
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const panLink = ext.pan;
    return jsonify({ urls: [panLink] });
}

// ================== 兼容性入口函数 ==================
// 以下函数确保与不同播放器的兼容性

async function home(filter) {
    const config = await getConfig();
    const configObj = JSON.parse(config);
    return jsonify({
        class: configObj.tabs,
        filters: {}
    });
}

async function homeVod() {
    return jsonify({});
}

async function category(tid, pg, filter, extend) {
    log(`📂 category调用 - tid: ${JSON.stringify(tid)}, pg: ${pg}`);
    
    // 处理不同的参数传递方式
    let id, page;
    
    if (typeof tid === 'object') {
        // 方式1: tid 是对象 {id: 'mv?page=', ...}
        id = tid.id;
        page = pg || 1;
    } else if (typeof tid === 'string') {
        // 方式2: tid 是字符串 'mv?page='
        id = tid;
        page = pg || 1;
    } else {
        log(`❌ 无法识别的tid类型: ${typeof tid}`);
        return jsonify({ list: [] });
    }
    
    return getCards({ id, page });
}

async function detail(id) {
    log(`🔍 detail调用 - id: ${id}`);
    return getTracks({ url: id });
}

async function play(flag, id, flags) {
    log(`▶️ play调用 - flag: ${flag}, id: ${id}`);
    return jsonify({ 
        parse: 0,
        url: id,
        header: {}
    });
}

async function test(inReq, outResp) {
    return await getConfig();
}
