/**
 * 找盘资源前端插件 - V1.5 (完整功能版)
 * 修复内容：
 * 1. 实现搜索分页逻辑 - 使用正确的URL格式 /s/{keyword}/{filter}/{page}
 * 2. 完善点击后的网盘链接处理 - 提取重定向后的真实网盘URL
 * 3. 增加详细日志便于调试
 * 4. 首页分页防止无限循环
 * 
 * --- 更新日志 ---
 * V1.5.2 (由Manus修正):
 * - 增强 getTracks 函数，增加多种链接提取策略（属性提取、脚本内容正则匹配），提高解析成功率。
 * - 完善备用逻辑，在自动解析失败时，依然提供手动打开页面的选项。
 */

// --- 配置区 ---
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true;
const PAGE_SIZE = 12;  // 首页每页12个卡片
const SEARCH_PAGE_SIZE = 30;  // 搜索每页30个结果

// --- 辅助函数 ---
function log(msg ) { 
    const logMsg = `[找盘] ${msg}`;
    try { 
        $log(logMsg); 
    } catch (_) { 
        if (DEBUG) console.log(logMsg); 
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

function getCorrectPicUrl(path) {
    if (!path) return FALLBACK_PIC;
    if (path.startsWith('http' )) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- 全局缓存 ---
let cardsCache = {};

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V1.5.2 ====");
    const CUSTOM_CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } }
    ];
    return jsonify({
        ver: 1,
        title: '找盘',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分页】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName, page = 1 } = ext;
    const url = SITE_URL;
    
    log(`[getCards] 分类="${categoryName}", 页=${page}`);
    
    try {
        const cacheKey = `category_${categoryName}`;
        let allCards = cardsCache[cacheKey];

        if (!allCards) {
            log(`[getCards] 缓存未命中，获取首页`);
            
            const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
            const $ = cheerio.load(data);
            allCards = [];

            const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
            
            if (categorySpan.length === 0) {
                log(`[getCards] ❌ 找不到分类:"${categoryName}"`);
                return jsonify({ list: [] });
            }

            log(`[getCards] ✓ 找到分类，提取卡片`);

            let rowDiv = categorySpan
                .closest('div.d-flex')
                .parent()
                .next('div.row');

            if (rowDiv.length === 0) {
                log(`[getCards] 使用备选选择器`);
                rowDiv = categorySpan
                    .closest('div.d-flex')
                    .next('div.row');
            }

            if (rowDiv.length === 0) {
                log(`[getCards] ❌ 找不到row容器`);
                return jsonify({ list: [] });
            }

            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                
                allCards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: getCorrectPicUrl(imgElement.attr('data-src')),
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });

            cardsCache[cacheKey] = allCards;
            log(`[getCards] ✓ 缓存${allCards.length}个卡片`);
        }

        // 分页处理
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 总数=${allCards.length}, 返回=${pageCards.length}个 (页码${page})`);
        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 支持分页】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        log(`[search] 搜索词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 关键词="${text}", 页=${page}`);
    
    const filter = 0;  // 全部分类
    const url = `${SITE_URL}/s/${encodeURIComponent(text)}/${filter}/${page}`;
    
    log(`[search] URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        $("a.resource-item").each((idx, item) => {
            const linkElement = $(item);
            const resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';
            
            if (resourceLink && title) {
                cards.push({
                    vod_id: resourceLink,
                    vod_name: title,
                    vod_pic: FALLBACK_PIC,
                    vod_remarks: `[${panType}]`,
                    ext: { url: resourceLink }
                });
            }
        });

        log(`[search] ✓ 第${page}页找到${cards.length}个结果`);
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页 - 获取网盘链接 (增强版)】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    
    if (!url) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    const fullUrl = getCorrectPicUrl(url);
    log(`[getTracks] 开始处理详情URL: ${fullUrl}`);

    try {
        const { data: html } = await $fetch.get(fullUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(html);

        let realPanUrl = '';

        // **策略一：从 'data-clipboard-text' 属性获取**
        realPanUrl = $('a.btn-clipboard').attr('data-clipboard-text');
        if (realPanUrl) {
            log(`[getTracks] ✓ 策略1成功: 从属性中提取到链接: ${realPanUrl}`);
        }

        // **策略二：如果策略一失败，从页面脚本中正则匹配**
        if (!realPanUrl) {
            log('[getTracks] 策略1失败，尝试策略2: 从script标签中正则匹配...');
            const scriptContent = $('script').text();
            const regex = /(https?:\/\/(?:pan|share )\.(?:baidu|quark|aliyundrive)\.com\/[^\s"'<]+)/;
            const match = scriptContent.match(regex);
            if (match && match[0]) {
                realPanUrl = match[0];
                log(`[getTracks] ✓ 策略2成功: 从脚本中匹配到链接: ${realPanUrl}`);
            }
        }

        if (realPanUrl) {
            let panName = '网盘链接';
            if (realPanUrl.includes('quark')) panName = '夸克网盘';
            else if (realPanUrl.includes('baidu')) panName = '百度网盘';
            else if (realPanUrl.includes('aliyundrive')) panName = '阿里云盘';
            else if (realPanUrl.includes('xunlei')) panName = '迅雷网盘';

            return jsonify({ 
                list: [{ 
                    title: '解析成功', 
                    tracks: [{ name: panName, pan: realPanUrl, ext: {} }] 
                }] 
            });
        } else {
            log(`[getTracks] ❌ 所有自动解析策略均失败。`);
            // **备用方案：返回中间页，让用户手动打开**
            return jsonify({ 
                list: [{ 
                    title: '无法自动解析', 
                    tracks: [{ name: '请手动打开页面', pan: fullUrl, ext: {} }] 
                }] 
            });
        }
        
    } catch (e) {
        log(`[getTracks] ❌ 访问或解析时发生异常: ${e.message}`);
        // **异常时的回退方案**
        return jsonify({ 
            list: [{ 
                title: '解析异常', 
                tracks: [{ name: '请手动尝试打开', pan: fullUrl, ext: {} }] 
            }] 
        });
    }
}


// --- 兼容接口 ---
async function init() { 
    return getConfig(); 
}

async function home() {
    const c = await getConfig();
    const config = JSON.parse(c);
    return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
    const id = typeof tid === 'object' ? tid.id : tid;
    return getCards({ id: id, page: pg || 1 });
}

async function detail(id) { 
    log(`[detail] 详情ID: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 打开: ${id}`);
    return jsonify({ url: id }); 
}

log('==== 插件加载完成 V1.5.2 ====');
