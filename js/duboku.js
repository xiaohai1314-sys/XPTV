/**
 * 找盘资源前端插件 - V4.0 (WebSocket实时版 - 完整修正版)
 * 核心功能：
 *  1. 配合 V4.0 后端，实现流式实时搜索。
 *  2. 立即显示初步结果，通过WebSocket接收后续数据和状态更新。
 *  3. 完美解决分页锁问题，提供最佳用户体验。
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
    log("==== 插件初始化 V4.0 (WebSocket实时版) ====");
    const CUSTOM_CATEGORIES = [ { name: '电影', ext: { id: '电影' } }, { name: '电视剧', ext: { id: '电视剧' } }, { name: '动漫', ext: { id: '动漫' } } ];
    return jsonify({ ver: 1, title: '找盘', site: SITE_URL, cookie: '', tabs: CUSTOM_CATEGORIES });
}

// 【首页分页】
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;
    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];
        if (!allCards) {
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];
            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            if (categorySpan.length === 0) return jsonify({ list: [] });
            let rowDiv = categorySpan.closest('div.d-flex').parent().next('div.row');
            if (rowDiv.length === 0) rowDiv = categorySpan.closest('div.d-flex').next('div.row');
            if (rowDiv.length === 0) return jsonify({ list: [] });
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                allCards.push({ vod_id: linkElement.attr('href') || "", vod_name: linkElement.find('h2').text().trim() || "", vod_pic: getCorrectPicUrl(linkElement.find('img.lozad').attr('data-src')), vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "", ext: { url: linkElement.attr('href') || "" } });
            });
            cardsCache[cacheKey] = allCards;
        }
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);
        return jsonify({ list: pageCards });
    } catch (e) { return jsonify({ list: [] }); }
}

// 【WebSocket 管理】
function setupWebSocket(clientId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
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

            if (!searchSession || searchSession.clientId !== clientId) return; // 忽略旧会话的消息

            if (message.event === 'initial_results') {
                searchSession.initialList = message.list || [];
                searchSession.hasMore = true; // 收到初步结果，先假设有更多
                // 注意：这里无法直接刷新UI，APP的分页机制决定了何时刷新
            } else if (message.event === 'unlock_pagination') {
                searchSession.hasMore = true; // 确认有更多，锁定“加载更多”状态
            } else if (message.event === 'quark_completed') {
                searchSession.quarkList = message.list || [];
                searchSession.quarkLoaded = true;
                // 如果用户还在第一页，下次翻页时会合并数据
            }
        } catch (e) {
            log(`[WSS] 解析消息失败: ${e.message}`);
        }
    };
}

// 【搜索】
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
                    initialList: [], // 等待 WebSocket 推送
                    quarkList: [],
                    hasMore: true, // 初始乐观地认为有更多
                    quarkLoaded: false
                };
                setupWebSocket(result.clientId);
                // 立即返回一个空列表，UI上显示“加载中...”，等待WebSocket推送数据
                return jsonify({ list: [], page: 1, pagecount: 1, hasmore: true });
            } else {
                throw new Error('Failed to initiate search stream.');
            }
        } catch (e) {
            log(`[Search] 启动流式任务失败: ${e.message}`);
            return jsonify({ list: [], page: 1, pagecount: 1, hasmore: false });
        }
    }

    // --- 处理翻页 (page > 1) ---
    log(`[Search] 翻页请求 (page ${page})`);
    if (!searchSession.clientId) {
        log(`[Search] 错误：没有活动的搜索会话。`);
        return jsonify({ list: [] });
    }

    // 合并当前所有已知数据
    const combinedList = [...(searchSession.initialList || []), ...(searchSession.quarkList || [])];
    
    // 排序
    const quarkQualityOrder = ['4K', '原盘', 'REMUX', '杜比', 'UHD', '蓝光', '次世代', '1080P'];
    combinedList.sort((a, b) => {
        const getTier = (card) => { if (card._panType === '115') return 1; if (card._panType === '天翼') return 2; if (card._panType === '阿里') return 3; if (card._panType === '夸克') return 4; return 5; };
        const tierA = getTier(a);
        const tierB = getTier(b);
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
    
    // 判断是否还有更多：如果当前页不是最后一页，或者夸克任务还没完成，都认为有更多
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
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    if (!url) return jsonify({ list: [] });
    const middleUrl = getCorrectPicUrl(url);
    try {
        const apiUrl = `${API_ENDPOINT}?url=${encodeURIComponent(middleUrl)}`;
        const response = await $fetch.get(apiUrl);
        const result = JSON.parse(response.data);
        if (result.success && result.real_url) {
            let panName = '网盘链接';
            if (result.real_url.includes('quark')) panName = '夸克网盘'; else if (result.real_url.includes('baidu')) panName = '百度网盘'; else if (result.real_url.includes('aliyundrive')) panName = '阿里云盘';
            return jsonify({ list: [{ title: '解析成功', tracks: [{ name: panName, pan: result.real_url, ext: {} }] }] });
        } else { throw new Error(result.error || 'API error'); }
    } catch (e) { return jsonify({ list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: middleUrl, ext: {} }] }] }); }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); const config = JSON.parse(c); return jsonify({ class: config.tabs, filters: {} }); }
async function category(tid, pg) { const id = typeof tid === 'object' ? tid.id : tid; return getCards({ id: id, page: pg || 1 }); }
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('==== 插件加载完成 V4.0 (WebSocket实时版) ====');
