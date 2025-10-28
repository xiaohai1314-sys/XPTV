/**
 * reboys.cn 资源前端插件 - V1.0.0
 * 
 * 基于 "找盘资源前端插件 - V1.6.3" 修改，以适配 reboys.cn 及其新后端。
 * 
 * 核心变更:
 * 1. SITE_URL 更新为 "https://reboys.cn/" 。
 * 2. API_ENDPOINT 更新为新的后端搜索服务地址。
 * 3. [重写] search 函数：从抓取HTML改为直接调用后端 /search API，并解析返回的JSON数据。
 * 4. [重写] getCards (首页) 函数：通过调用后端 /search API 来模拟获取各分类数据。
 * 5. [简化] getTracks (详情) 函数：由于搜索结果已包含直链，此函数现在只做数据透传。
 * 6. 数据结构适配：适配新后端返回的深层嵌套JSON结构。
 */

// --- 配置区 ---
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

// 【修改】将 API_ENDPOINT 指向您的新后端 server.js 提供的搜索接口
const API_ENDPOINT = "http://192.168.10.106:3000/search"; 

// 【修改】将 SITE_URL 更新为新网站地址
const SITE_URL = "https://reboys.cn/";

// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png"; // 使用新网站的图标作为备用
const DEBUG = true;
const PAGE_SIZE = 12; // 首页每个分类显示的数量

// --- 辅助函数 (保持不变 ) ---
function log(msg) { const logMsg = `[reboys插件] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口函数 (保持不变) ---
async function getConfig() {
    log("==== 插件初始化 V1.0.0 for reboys.cn ====");
    // 【修改】分类与您的前端HTML保持一致
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: '短剧' } },
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } },
        { name: '综艺', ext: { id: '综艺' } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

/**
 * [内部函数] 调用后端API并处理返回数据
 * @param {string} keyword - 搜索关键词
 * @param {number} page - 页码
 * @returns {Array} - 格式化后的卡片列表
 */
async function callBackendApi(keyword, page) {
    try {
        const url = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}&page=${page}`;
        log(`[API请求] URL: ${url}`);
        
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

        // 【修改】适配新后端返回的深层嵌套JSON结构
        if (data && data.code === 0) {
            const results = data.data?.data?.data?.results || [];
            log(`[API响应] 成功，获取到 ${results.length} 条关于 "${keyword}" 的原始数据`);
            
            // 将后端返回数据映射为插件所需的格式
            return results.map(item => {
                const panInfo = { pan: item.pan, pwd: item.pwd };
                return {
                    // vod_id 现在存储包含网盘链接和密码的JSON字符串，方便详情页直接使用
                    vod_id: jsonify(panInfo), 
                    vod_name: item.title,
                    vod_pic: item.image || FALLBACK_PIC,
                    // vod_remarks 可以用来显示网盘类型或提取码
                    vod_remarks: item.pwd ? `码: ${item.pwd}` : '直链', 
                };
            });
        } else {
            log(`[API响应] ❌ 后端返回错误: code=${data.code}, message=${data.message}`);
            return [];
        }
    } catch (e) {
        log(`[API请求] ❌ 异常: ${e.message}`);
        return [];
    }
}


// ★★★★★【首页分页 - 已重写】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    log(`[getCards] 获取分类="${categoryName}", 页=${page}`);
    
    // 【修改】通过调用后端搜索接口来模拟获取分类数据
    const cards = await callBackendApi(categoryName, page);
    
    // 首页只取部分数据
    const pageCards = cards.slice(0, PAGE_SIZE);
    log(`[getCards] 返回 ${pageCards.length} 个卡片 (页码${page})`);
    return jsonify({ list: pageCards });
}

// ★★★★★【搜索 - 已重写】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 搜索关键词="${text}", 页=${page}`);
    
    // 【修改】直接调用封装好的后端API函数
    const cards = await callBackendApi(text, page);
    
    log(`[search] ✓ 搜索到 ${cards.length} 个结果`);
    return jsonify({ list: cards });
}

// ★★★★★【详情页 - 已简化】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    // 【修改】vod_id 现在直接是包含网盘信息的JSON字符串，无需再请求API
    const { vod_id } = ext; 
    log(`[getTracks] 解析详情ID: ${vod_id}`);

    try {
        const panInfo = argsify(vod_id); // 将JSON字符串解析回对象
        if (panInfo && panInfo.pan) {
            log(`[getTracks] ✓ 直接从ID中获取到链接: ${panInfo.pan}`);
            
            let panName = '网盘链接';
            if (panInfo.pan.includes('quark')) panName = '夸克网盘';
            else if (panInfo.pan.includes('aliyundrive')) panName = '阿里云盘';
            else if (panInfo.pan.includes('115')) panName = '115网盘';
            else if (panInfo.pan.includes('cloud.189.cn')) panName = '天翼云盘';
            
            let trackName = panName;
            if (panInfo.pwd) {
                trackName += ` (提取码: ${panInfo.pwd})`;
            }

            return jsonify({
                list: [{
                    title: '播放列表',
                    tracks: [{
                        name: trackName,
                        pan: panInfo.pan, // 直接使用链接
                        ext: {}
                    }]
                }]
            });
        } else {
            throw new Error('ID中不包含有效的网盘链接');
        }
    } catch (e) {
        log(`[getTracks] ❌ 异常: ${e.message}`);
        // 提供一个回退方案，虽然理论上不应该发生
        return jsonify({ list: [{ title: '解析失败', tracks: [{ name: '无法获取链接', pan: '#', ext: {} }] }] });
    }
}

// --- 兼容接口 (保持不变) ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { log(`[detail] 详情ID: ${id}`); return getTracks({ vod_id: id }); }
async function play(flag, id) { log(`[play] 直接播放: ${id}`); return jsonify({ url: id }); }

log('==== reboys.cn 插件加载完成 V1.0.0 ====');

