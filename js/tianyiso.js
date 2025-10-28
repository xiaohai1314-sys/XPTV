/**
 * reboys.cn 前端插件 - V25.0 (终极微调版：基于V21修复网盘识别)
 * 核心修正:
 * 1. [网盘修复] getTracks (搜索结果): 移除 list/tracks 结构，强制只返回 vod_play_from/vod_play_url，解决App识别失败问题。
 * 2. [保留机制] 完全保留 V21 稳定运行的所有逻辑（包括搜索缓存、getCards、play等）。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; [span_0](start_span)// 你的后端服务地址[span_0](end_span)
[span_1](start_span)const SITE_URL = "https://reboys.cn";[span_1](end_span)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
[span_2](start_span)const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";[span_2](end_span)
const DEBUG = true;
const cheerio = createCheerio();

// --- 全局缓存 ---
[span_3](start_span)let searchCache = {};[span_3](end_span)
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V25] ${msg}`;
    try { 
        [span_4](start_span)$log(logMsg);[span_4](end_span)
    } catch (_) { 
        [span_5](start_span)if (DEBUG) console.log(logMsg);[span_5](end_span)
    }
}

function argsify(ext) { 
    if (typeof ext === 'string') {
        try { 
            [span_6](start_span)return JSON.parse(ext);[span_6](end_span)
        } catch (e) { 
            [span_7](start_span)return {};[span_7](end_span)
        }
    }
    return ext || [span_8](start_span){};[span_8](end_span)
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

async function getConfig() {
    log("==== 插件初始化 V25 (微调版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    [span_9](start_span)];[span_9](end_span)
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V25)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    [span_10](start_span)});[span_10](end_span)
}

// ----------------------------------------------------------------------
// 首页/分类 (保持 V21 逻辑不变)
// ----------------------------------------------------------------------

async function getCards(ext) {
    ext = argsify(ext);
    [span_11](start_span)const { id: categoryId } = ext;[span_11](end_span)
    
    try {
        if (!homeCache) {
            [span_12](start_span)log(`[getCards] 获取首页缓存`);[span_12](end_span)
            const { data } = await $fetch.get(SITE_URL, { 
                headers: { 'User-Agent': UA } 
            [span_13](start_span)});[span_13](end_span)
            [span_14](start_span)homeCache = data;[span_14](end_span)
        }
        
        [span_15](start_span)const $ = cheerio.load(homeCache);[span_15](end_span)
        const cards = [];
        [span_16](start_span)const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);[span_16](end_span)
        if (targetBlock.length === 0) {
            [span_17](start_span)log(`[getCards] 未找到分类 ${categoryId}`);[span_17](end_span)
            [span_18](start_span)return jsonify({ list: [] });[span_18](end_span)
        }

        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            
            
            [span_19](start_span)if (detailPath && title) {[span_19](end_span)
                cards.push({
                    vod_id: jsonify({ type: 'home', path: detailPath }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    [span_20](start_span)vod_remarks: '首页推荐'[span_20](end_span)
                });
            }
        });
        [span_21](start_span)log(`[getCards] 返回 ${cards.length} 个卡片`);[span_21](end_span)
        return jsonify({ list: cards });
    } catch (e) {
        [span_22](start_span)log(`[getCards] 异常: ${e.message}`);[span_22](end_span)
        [span_23](start_span)homeCache = null;[span_23](end_span)
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 搜索 (保持 V21 逻辑不变)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || [span_24](start_span)'';[span_24](end_span)
    const page = ext.page || [span_25](start_span)1;[span_25](end_span)
    if (!keyword) {
        [span_26](start_span)log('[search] 关键词为空');[span_26](end_span)
        [span_27](start_span)return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });[span_27](end_span)
    }
    
    [span_28](start_span)log(`[search] 搜索: "${keyword}", 页码: ${page}`);[span_28](end_span)
    try {
        // 缓存键：关键词
        [span_29](start_span)const cacheKey = `search_${keyword}`;[span_29](end_span)
        [span_30](start_span)let allResults = searchCache[cacheKey];[span_30](end_span)
        
        // 缓存未命中，请求后端
        if (!allResults) {
            [span_31](start_span)log(`[search] 缓存未命中，请求后端`);[span_31](end_span)
            const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
            const fetchResult = await $fetch.get(url, { 
                headers: { 'User-Agent': UA },
                timeout: 15000
            [span_32](start_span)});[span_32](end_span)
            // 解析响应
            [span_33](start_span)let response = null;[span_33](end_span)
            if (typeof fetchResult === 'string') {
                [span_34](start_span)response = JSON.parse(fetchResult);[span_34](end_span)
            } else if (typeof fetchResult === 'object' && fetchResult !== null) {
                if (fetchResult.data) {
                    if (typeof fetchResult.data === 'string') {
                        [span_35](start_span)response = JSON.parse(fetchResult.data);[span_35](end_span)
                    } else {
                        [span_36](start_span)response = fetchResult.data;[span_36](end_span)
                    }
                } else if (fetchResult.code !== undefined) {
                    [span_37](start_span)response = fetchResult;[span_37](end_span)
                }
            }
            
            if (!response || response.code !== 0) {
                [span_38](start_span)log(`[search] 后端返回错误或无响应`);[span_38](end_span)
                [span_39](start_span)return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });[span_39](end_span)
            }

            // 提取结果（多路径兼容）
            [span_40](start_span)let results = null;[span_40](end_span)
            if (response.data?.data?.results) {
                [span_41](start_span)results = response.data.data.results;[span_41](end_span)
                [span_42](start_span)log(`[search] 路径1: response.data.data.results`);[span_42](end_span)
            } else if (response.data?.results) {
                [span_43](start_span)results = response.data.results;[span_43](end_span)
                [span_44](start_span)log(`[search] 路径2: response.data.results`);[span_44](end_span)
            } else if (response.results) {
                [span_45](start_span)results = response.results;[span_45](end_span)
                [span_46](start_span)log(`[search] 路径3: response.results`);[span_46](end_span)
            }
            
            if (!results || !Array.isArray(results) || results.length === 0) {
                [span_47](start_span)log(`[search] 未找到搜索结果`);[span_47](end_span)
                [span_48](start_span)return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });[span_48](end_span)
            }
            
            // 映射并缓存所有结果
            allResults = results.map(item => {
                const vod_id_data = {
                    type: 'search',
                    [span_49](start_span)title: item.title || '未知标题',[span_49](end_span)
                    links: item.links || [],
                    image: item.image || FALLBACK_PIC
                };
                
                [span_50](start_span)const totalLinks = (item.links || []).length;[span_50](end_span)
                const remarks = totalLinks > 0 
                    ? `${totalLinks}个网盘` 
                    : '暂无链接';

                return {
                    [span_51](start_span)vod_id: jsonify(vod_id_data),[span_51](end_span)
                    vod_name: item.title || '未知标题',
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: remarks
                };
            [span_52](start_span)});[span_52](end_span)
            
            searchCache[cacheKey] = allResults;
            log(`[search] 缓存 ${allResults.length} 条结果`);
        } else {
            [span_53](start_span)log(`[search] 使用缓存，共 ${allResults.length} 条结果`);[span_53](end_span)
        }
        
        // 分页处理（每页10条）
        [span_54](start_span)const pageSize = 10;[span_54](end_span)
        [span_55](start_span)const startIdx = (page - 1) * pageSize;[span_55](end_span)
        [span_56](start_span)const endIdx = startIdx + pageSize;[span_56](end_span)
        [span_57](start_span)const pageResults = allResults.slice(startIdx, endIdx);[span_57](end_span)
        [span_58](start_span)const totalPages = Math.ceil(allResults.length / pageSize);[span_58](end_span)
        
        log(`[search] 返回第${page}页，共${pageResults.length}条 (总计${allResults.length}条)`);
        
        return jsonify({
            list: pageResults,
            page: page,
            pagecount: totalPages,
            total: allResults.length
        [span_59](start_span)});[span_59](end_span)
    } catch (e) {
        [span_60](start_span)log(`[search] 异常: ${e.message}`);[span_60](end_span)
        [span_61](start_span)return jsonify({ list: [], page: 1, pagecount: 0, total: 0 });[span_61](end_span)
    }
}

// ----------------------------------------------------------------------
// 详情 (核心修复：强制返回 vod_play_from/vod_play_url for search)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    [span_62](start_span)log(`[getTracks] 获取详情`);[span_62](end_span)
    try {
        [span_63](start_span)const idData = argsify(vod_id);[span_63](end_span)
        [span_64](start_span)log(`[getTracks] 类型: ${idData.type}`);[span_64](end_span)
        if (idData.type === 'search') {
            const links = idData.links || [span_65](start_span)[];[span_65](end_span)
            log(`[getTracks] 搜索结果，链接数: ${links.length}`);
            
            if (links.length === 0) {
                // V25 修复：如果无链接，只返回兼容结构
                return jsonify({ 
                    vod_play_from: '无资源',
                    vod_play_url: '暂无可用链接$'
                });
            }
            
            // 构建播放列表 (V21 逻辑)
            const tracks = links.map((link, index) => {
                // 识别网盘类型
                let panType = '网盘';
                [span_66](start_span)const url = link.url || '';[span_66](end_span)
                
                if (url.includes('quark.cn') || link.type === 'quark') {
                    panType = '夸克';
                } else if (url.includes('pan.baidu.com') || link.type === 'baidu') {
                    [span_67](start_span)panType = '百度';[span_67](end_span)
                } else if (url.includes('aliyundrive.com') || link.type === 'aliyun') {
                    panType = '阿里';
                } else if (url.includes('115.com') || link.type === '115') {
                    [span_68](start_span)panType = '115';[span_68](end_span)
                } else if (url.includes('189.cn') || link.type === 'tianyi') {
                    [span_69](start_span)panType = '天翼';[span_69](end_span)
                } else if (link.type) {
                    [span_70](start_span)panType = link.type.toUpperCase();[span_70](end_span)
                }
                
                const password = link.password ? [span_71](start_span)` 提取码:${link.password}` : '';[span_71](end_span)
                const name = `[${panType}] ${idData.title || '播放'}${password}`;
                
                [span_72](start_span)log(`[getTracks] 添加: ${name}`);[span_72](end_span)
                return { 
                    name: name, 
                    pan: url 
                [span_73](start_span)};[span_73](end_span)
            });
            
            // 构建 vod_play_url 格式（用$分隔多个链接）
            [span_74](start_span)const playUrls = tracks.map(t => `${t.name}$${t.pan}`).join('#');[span_74](end_span)
            log(`[getTracks] 返回 ${tracks.length} 个播放链接`);
            
            // ⚠️ V25 强制修复：移除 list/tracks 结构，只返回兼容结构
            return jsonify({ 
                [span_75](start_span)vod_play_from: '网盘列表',[span_75](end_span)
                [span_76](start_span)vod_play_url: playUrls[span_76](end_span)
            });
        } 
        else if (idData.type === 'home') {
            // 首页详情：保持 V21 逻辑不变 (双结构返回)
            [span_77](start_span)log(`[getTracks] 首页详情: ${idData.path}`);[span_77](end_span)
            [span_78](start_span)const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;[span_78](end_span)
            const { data } = await $fetch.get(url, {
                headers: { 'User-Agent': UA }
            [span_79](start_span)});[span_79](end_span)
            if (data.success) {
                const trackName = data.data.pwd 
                    ? [span_80](start_span)`点击播放 提取码:${data.data.pwd}`[span_80](end_span)
                    [span_81](start_span): '点击播放';[span_81](end_span)
                [span_82](start_span)const playUrl = `${trackName}$${data.data.pan}`;[span_82](end_span)
                    
                log(`[getTracks] 首页详情解析成功`);
                
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ 
                            [span_83](start_span)name: trackName,[span_83](end_span)
                            pan: data.data.pan 
                        }] 
                    [span_84](start_span)}],[span_84](end_span)
                    [span_85](start_span)vod_play_from: '网盘',[span_85](end_span)
                    [span_86](start_span)vod_play_url: playUrl[span_86](end_span)
                });
            } else {
                [span_87](start_span)throw new Error(`后端详情解析失败: ${data.message}`);[span_87](end_span)
            }
        } 
        else {
            [span_88](start_span)throw new Error(`未知的 vod_id 类型: ${idData.type}`);[span_88](end_span)
        }
    } catch (e) {
        [span_89](start_span)log(`[getTracks] 异常: ${e.message}`);[span_89](end_span)
        // 确保错误时也返回兼容结构
        return jsonify({ 
            vod_play_from: '错误',
            vod_play_url: '获取链接失败$'
        });
    }
}

// ----------------------------------------------------------------------
// 播放 (保持 V21 逻辑不变)
// ----------------------------------------------------------------------
async function play(flag, id) {
    [span_90](start_span)log(`[play] flag=${flag}, id=${id}`);[span_90](end_span)
    // id 就是网盘链接，直接返回
    if (id && (id.startsWith('http') || id.startsWith('//'))) {
        [span_91](start_span)log(`[play] 返回网盘链接: ${id.substring(0, 50)}...`);[span_91](end_span)
        return jsonify({ 
            parse: 0,
            url: id,
            header: {}
        [span_92](start_span)});[span_92](end_span)
    }
    
    [span_93](start_span)log(`[play] 无效的播放ID`);[span_93](end_span)
    return jsonify({ 
        parse: 0,
        url: '',
        header: {}
    [span_94](start_span)});[span_94](end_span)
}

// --- 兼容接口 (保持 V21 逻辑不变) ---
async function init() { 
    [span_95](start_span)return getConfig();[span_95](end_span)
}

async function home() { 
    [span_96](start_span)const c = await getConfig();[span_96](end_span)
    return jsonify({ 
        class: JSON.parse(c).tabs 
    [span_97](start_span)});[span_97](end_span)
}

async function category(tid, pg) { 
    return getCards({ 
        id: (argsify(tid)).id || tid, 
        page: pg || 1 
    [span_98](start_span)});[span_98](end_span)
}

async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V25 ====');
