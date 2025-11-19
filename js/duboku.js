/**
 * 找盘资源前端插件 - V4.1 (WebSocket轮询修复版)
 * 核心功能：
 *  1. 修复了V4.0中因无法主动刷新UI导致内容不显示的问题。
 *  2. search函数在首次请求时会等待初步结果，确保能返回数据。
 *  3. 依然通过WebSocket接收后续数据和状态，实现分阶段加载。
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.7:3004/api/get_real_url";
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64   ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 30;

// --- 全局状态 ---
let searchSession = {};
let ws = null;
let cardsCache = {};

// --- 辅助函数 ---
function log(msg  ) { const logMsg = `[找盘] ${msg}`; try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); } }
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectPicUrl(path) { if (!path) return FALLBACK_PIC; if (path.startsWith('http'  )) return path; return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`; }

// --- 插件入口函数 ---
async function getConfig() {
    log("==== 插件初始化 V4.1 (WebSocket轮询修复版) ====");
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// 【首页分页】
async function getCards(ext) { /* 与 V4.0 版本完全相同 */ }

// 【WebSocket 管理】
function setupWebSocket(clientId) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    const wsUrl = `ws://${API_ENDPOINT.split('/')[2]}/?clientId=${clientId}`;
    log(`[WSS] 准备连接到: ${wsUrl}`);
    ws = new WebSocket(wsUrl);
    ws.onopen = () => { log(`[WSS] WebSocket 已连接。`); };
    ws.onclose = () => { log(`[WSS] WebSocket 已断开。`); };
    ws.onerror = (err) => { log(`[WSS] 发生错误: ${err ? err.message : 'Unknown error'}`); };
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            log(`[WSS] 收到消息: ${message.event}`);
            if (!searchSession || searchSession.clientId !== clientId) return;
            if (message.event === 'initial_results') {
                searchSession.initialList = message.list || [];
                searchSession.initialLoaded = true;
            } else if (message.event === 'unlock_pagination') {
                searchSession.hasMore = true;
            } else if (message.event === 'quark_completed') {
                searchSession.quarkList = message.list || [];
                searchSession.quarkLoaded = true;
            }
        } catch (e) { log(`[WSS] 解析消息失败: ${e.message}`); }
    };
}

// ★★★★★【核心修复：search 函数】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    const page = parseInt(ext.page || 1);

    if (!keyword) return jsonify({ list: [] });

    if (page === 1) {
        log(`[Search] 新搜索 (page 1)，请求流式任务...`);
        const baseUrl = API_ENDPOINT.substring(0, API_ENDPOINT.indexOf('/api/'));
        const searchApiUrl = `${baseUrl}/api/search_stream?keyword=${encodeURIComponent(keyword)}`;
        
        try {
            const { data } = await $fetch.get(searchApiUrl);
            const result = JSON.parse(data);

            if (result.success) {
                searchSession = {
                    clientId: result.clientId,
                    initialList: [],
                    quarkList: [],
                    initialLoaded: false,
                    quarkLoaded: false,
                    hasMore: true,
                };
                setupWebSocket(result.clientId);

                // ★★★ 轮询等待初步结果 ★★★
                for (let i = 0; i < 10; i++) { // 最多等待5秒 (10 * 500ms)
                    if (searchSession.initialLoaded) {
                        log(`[Search] 初步结果已通过WebSocket接收。`);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (!searchSession.initialLoaded) {
                    log(`[Search] 等待初步结果超时。`);
                }
                
            } else { throw new Error('Failed to initiate search stream.'); }
        } catch (e) {
            log(`[Search] 启动流式任务失败: ${e.message}`);
            searchSession = {}; // 清空会话
        }
    }

    // --- 合并与分页逻辑 (对所有页码都适用) ---
    if (!searchSession.clientId) {
        return jsonify({ list: [], page: 1, pagecount: 1, hasmore: false });
    }

    const combinedList = [...(searchSession.initialList || []), ...(searchSession.quarkList || [])];
    
    const quarkQualityOrder = ['4K', '原盘', 'REMUX', '杜比', 'UHD', '蓝光', '次世代', '1080P'];
    combinedList.sort((a, b) => {
        const getTier = (card) => { if (card._panType === '115') return 1; if (card._panType === '天翼') return 2; if (card._panType === '阿里') return 3; if (card._panType === '夸克') return 4; return 5; };
        const tierA = getTier(a); const tierB = getTier(b);
        if (tierA !== tierB) return tierA - tierB;
        if (tierA === 4) {
            const aQualityIndex = a._quarkQuality ? quarkQualityOrder.indexOf(a._quarkQuality.toUpperCase()) : 99;
            const bQualityIndex = b._quarkQuality ? quarkQualityOrder.indexOf(b._quarkQuality.toUpperCase()) : 99;
            return aQualityIndex - bQualityIndex;
        }
        return 0;
    });

    const totalCount = combinedList.length;
    const totalPageCount = Math.ceil(totalCount / SEARCH_PAGE_SIZE) || 1;
    const startIndex = (page - 1) * SEARCH_PAGE_SIZE;
    const endIndex = startIndex + SEARCH_PAGE_SIZE;
    const pageList = combinedList.slice(startIndex, endIndex);
    
    const hasMore = page < totalPageCount || !searchSession.quarkLoaded;

    log(`[Search] 返回 ${pageList.length} 条结果给第 ${page} 页, hasmore=${hasMore}`);
    return jsonify({
        list: pageList,
        page: page,
        pagecount: totalPageCount,
        hasmore: hasMore
    });
}

// 【详情页】
async function getTracks(ext) { /* 与 V4.0 版本完全相同 */ }

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V4.1 (WebSocket轮询修复版) ====');
