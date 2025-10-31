/**
 * 4k热播影视 前端插件 - V3.3 (恢复原版逻辑)
 *
 * 保持原版简洁设计，不做过度优化
 */

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.10.107:3000/search";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;

// ★★★ 全局缓存：只缓存首页HTML ★★★
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http')) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function getLinkType(url) {
    if (!url) return 'unknown';
    if (url.includes('pan.quark.cn') || 
        url.includes('pan.baidu.com') || 
        url.includes('aliyundrive.com') ||
        url.includes('www.alipan.com')) {
        return 'pan';
    }
    if (url.includes(SITE_URL) || url.startsWith('/s/')) {
        return 'middle';
    }
    return 'unknown';
}

function getPanName(url) {
    if (url.includes('quark')) return '夸克网盘';
    if (url.includes('baidu')) return '百度网盘';
    if (url.includes('aliyundrive') || url.includes('alipan')) return '阿里云盘';
    return '网盘资源';
}

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V3.3 ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: jsonify({ id: 1 }) },
        { name: '电影', ext: jsonify({ id: 2 }) },
        { name: '电视剧', ext: jsonify({ id: 3 }) },
        { name: '动漫', ext: jsonify({ id: 4 }) },
        { name: '综艺', ext: jsonify({ id: 5 }) },
    ];
    return jsonify({
        ver: 3.3,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - 保持原版逻辑】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = ext.page || 1;
    
    log(`[getCards] 请求分类ID: ${categoryId}, 页码: ${page}`);

    // ★★★ 不做分页处理，保持原版逻辑 ★★★

    try {
        log(`[getCards] 正在从 ${SITE_URL} 获取首页HTML...`);
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 找不到ID为 ${categoryId} 的内容块`);
            return jsonify({ list: [] });
        }

        contentBlock.find('a.item').each((_, element) => {
            const cardElement = $(element);
            const detailUrl = cardElement.attr('href');
            const fullUrl = getCorrectUrl(detailUrl);
            
            cards.push({
                vod_id: fullUrl,
                vod_name: cardElement.find('p').text().trim(),
                vod_pic: getCorrectUrl(cardElement.find('img').attr('src')),
                vod_remarks: '',
                ext: { 
                    url: fullUrl,
                    source: 'html',
                    type: 'middle'
                }
            });
        });

        log(`[getCards] ✓ 成功提取 ${cards.length} 个卡片`);
        
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能 - 保持原版逻辑】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = ext.page || 1;
    
    log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

    // ★★★ 不做分页处理，保持原版逻辑 ★★★

    const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(searchText)}`;
    log(`[search] 正在请求后端API: ${requestUrl}`);

    try {
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        const response = JSON.parse(jsonString);

        if (response.code !== 0) {
            log(`[search] ❌ 后端服务返回错误: ${response.message}`);
            return jsonify({ list: [] });
        }

        const results = response.data?.data?.results;
        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 results 数组`);
            return jsonify({ list: [] });
        }
        
        const cards = results.map(item => {
            if (!item || !item.title || !item.links || item.links.length === 0) return null;
            const finalUrl = item.links[0].url;
            
            return {
                vod_id: finalUrl,
                vod_name: item.title,
                vod_pic: FALLBACK_PIC,
                vod_remarks: item.datetime ? new Date(item.datetime).toLocaleDateString() : '未知时间',
                ext: { 
                    url: finalUrl,
                    source: 'api',
                    type: 'pan'
                }
            };
        }).filter(card => card !== null);

        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析JSON时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 智能处理模式】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const url = ext.url;
    
    if (!url) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    log(`[getTracks] 处理URL: ${url}`);
    
    const linkType = getLinkType(url);
    log(`[getTracks] 链接类型: ${linkType}`);

    // --- 情况A: 已经是网盘链接，直接返回 ---
    if (linkType === 'pan') {
        log(`[getTracks] ✓ 检测到最终网盘链接，直接使用`);
        
        return jsonify({
            list: [{
                title: '点击播放',
                tracks: [{
                    name: getPanName(url),
                    pan: url,
                    ext: {}
                }]
            }]
        });
    }

    // --- 情况B: 中间页链接，需要解析 ---
    if (linkType === 'middle') {
        log(`[getTracks] 检测到中间页链接，开始解析...`);
        
        try {
            // 从URL提取关键词
            let keyword = url.split('/').pop().replace('.html', '');
            if (url.includes(SITE_URL)) {
                keyword = url.replace(SITE_URL, '').split('/').pop().replace('.html', '');
            }
            
            log(`[getTracks] 提取关键词: ${keyword}`);
            
            // 调用后端API解析
            const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
            log(`[getTracks] 请求后端API: ${requestUrl}`);
            
            const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
            const response = JSON.parse(jsonString);

            if (response.code !== 0 || !response.data?.data?.results || response.data.data.results.length === 0) {
                throw new Error("API未能解析出有效链接");
            }

            // 取第一个结果
            const firstResult = response.data.data.results[0];
            const finalUrl = firstResult.links[0].url;
            log(`[getTracks] ✓ 成功解析出网盘链接: ${finalUrl}`);
            
            return jsonify({
                list: [{
                    title: firstResult.title || '解析成功',
                    tracks: [{
                        name: getPanName(finalUrl),
                        pan: finalUrl,
                        ext: {}
                    }]
                }]
            });

        } catch (e) {
            log(`[getTracks] ❌ 解析失败: ${e.message}`);
            
            return jsonify({
                list: [{
                    title: '自动解析失败',
                    tracks: [{
                        name: '点击手动打开',
                        pan: url,
                        ext: {}
                    }]
                }]
            });
        }
    }

    // --- 情况C: 未知链接类型 ---
    log(`[getTracks] ⚠️ 未知链接类型，尝试直接使用`);
    return jsonify({
        list: [{
            title: '未知格式',
            tracks: [{
                name: '尝试打开',
                pan: url,
                ext: {}
            }]
        }]
    });
}

// --- 兼容接口 ---
async function init() { return getConfig(); }

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    log(`[category] 收到参数 tid=${JSON.stringify(tid)}, pg=${pg}, 解析后id=${id}`);
    return getCards({ id: id, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 直接播放: ${id}`);
    return jsonify({ url: id }); 
}
