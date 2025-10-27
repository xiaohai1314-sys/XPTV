/**
 * 找盘资源前端插件 - V1.1 (修复版)
 * 修复内容：
 * 1. 修复首页内容不显示 - 重写getCards()的DOM选择器
 * 2. 修复海报不显示 - 确保正确获取data-src属性
 * 3. 修复搜索无列表 - search()直接返回多个结果卡片
 * 4. 增加调试日志 - 便于定位问题
 */

// --- 配置区 ---
const SITE_URL = "https://v2pan.com";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = "https://v2pan.com/favicon.ico";
const DEBUG = true; // 调试模式

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[找盘资源] ${msg}`;
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
    if (path.startsWith('http')) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
    log("插件初始化 (V1.1 修复版)");
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

// ★★★★★【V1.1 修复：首页内容获取】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryName } = ext;
    const url = SITE_URL;
    
    log(`[getCards] 开始获取分类: "${categoryName}"`);
    
    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        // 【修复关键】正确的DOM遍历逻辑
        // 1. 找到包含分类名的span.fs-5.fw-bold
        // 2. 向上找到最近的 .d-flex
        // 3. 再向上找到父div（包含该.d-flex的div）
        // 4. 找到下一个.row兄弟元素
        // 5. 在.row中找所有a.col-4

        const categorySpan = $(`span.fs-5.fw-bold:contains('${categoryName}')`);
        
        if (categorySpan.length === 0) {
            log(`[getCards] 警告: 找不到分类标题 "${categoryName}"`);
            return jsonify({ list: [] });
        }

        log(`[getCards] 找到分类标题，开始查找卡片区域`);

        // 从span向上找到.d-flex，再向上找到div，然后找下一个.row
        const rowDiv = categorySpan
            .closest('div.d-flex')
            .parent()
            .next('div.row');

        if (rowDiv.length === 0) {
            log(`[getCards] 警告: 找不到row容器`);
            log(`[getCards] 尝试备选方案: 使用 closest().next()`);
            
            // 备选方案：直接使用next()
            const altRowDiv = categorySpan
                .closest('div.d-flex')
                .next('div.row');
            
            if (altRowDiv.length === 0) {
                log(`[getCards] 错误: 仍找不到row容器，请检查HTML结构`);
                return jsonify({ list: [] });
            }
            
            altRowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                const picUrl = getCorrectPicUrl(imgElement.attr('data-src'));
                
                cards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: picUrl,
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });
        } else {
            rowDiv.find('a.col-4').each((_, item) => {
                const linkElement = $(item);
                const imgElement = linkElement.find('img.lozad');
                const picUrl = getCorrectPicUrl(imgElement.attr('data-src'));
                
                cards.push({
                    vod_id: linkElement.attr('href') || "",
                    vod_name: linkElement.find('h2').text().trim() || "",
                    vod_pic: picUrl,
                    vod_remarks: linkElement.find('.fs-9.text-gray-600').text().trim() || "",
                    ext: { url: linkElement.attr('href') || "" }
                });
            });
        }

        log(`[getCards] 成功获取 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
        
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【V1.1 修复：详情页网盘链接提取】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const { url } = ext;
    
    if (!url) {
        log(`[getTracks] 错误: 没有提供url`);
        return jsonify({ list: [] });
    }

    const detailUrl = getCorrectPicUrl(url);
    log(`[getTracks] 开始处理详情页: ${detailUrl}`);

    try {
        const { data } = await $fetch.get(detailUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const tracks = [];

        $('a.resource-item').each((_, item) => {
            const resourceLink = $(item).attr('href');
            const title = $(item).find('h2').text().trim();
            const panType = $(item).find('span.text-success').text().trim() || '未知网盘';
            
            if (resourceLink && title) {
                tracks.push({
                    name: `[${panType}] ${title}`,
                    pan: getCorrectPicUrl(resourceLink),
                    ext: {},
                });
            }
        });

        if (tracks.length === 0) {
            log(`[getTracks] 未找到有效资源`);
            tracks.push({ name: "未找到有效资源", pan: '', ext: {} });
        }

        log(`[getTracks] 成功获取 ${tracks.length} 个资源`);
        return jsonify({ list: [{ title: '资源列表', tracks }] });
        
    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: "操作失败，请检查网络", pan: '', ext: {} }] }] });
    }
}

// ★★★★★【V1.1 修复：搜索功能 - 直接返回多个结果卡片】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = ext.page || 1;

    if (!text) {
        log(`[search] 错误: 搜索关键词为空`);
        return jsonify({ list: [] });
    }

    log(`[search] 正在搜索: "${text}", 第 ${page} 页`);
    
    const url = `${SITE_URL}/s?q=${encodeURIComponent(text)}`;
    log(`[search] 请求URL: ${url}`);

    try {
        const { data } = await $fetch.get(url, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        // 【修复关键】直接返回所有搜索结果作为独立卡片
        // 不再聚合成一张卡片，这样用户体验更好
        
        $("a.resource-item").each((idx, item) => {
            const linkElement = $(item);
            const resourceLink = linkElement.attr('href');
            const title = linkElement.find('h2').text().trim();
            const panType = linkElement.find('span.text-success').text().trim() || '未知';
            const uploader = linkElement.find('span.text-gray-500').eq(1)?.text().trim() || '';
            const updateTime = linkElement.find('span').last().text().trim() || '';
            
            if (resourceLink && title) {
                cards.push({
                    vod_id: resourceLink,
                    vod_name: title,
                    vod_pic: FALLBACK_PIC,
                    vod_remarks: `[${panType}] ${uploader} ${updateTime}`.trim(),
                    ext: { url: resourceLink }
                });
            }
        });

        log(`[search] 搜索到 ${cards.length} 条结果`);
        
        if (cards.length === 0) {
            log(`[search] 提示: 未找到相关资源`);
            return jsonify({ list: [] });
        }

        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
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
    log(`[category] 获取分类: ${id}, 页码: ${pg}`);
    return getCards({ id: id, page: 1 });
}

async function detail(id) { 
    log(`[detail] 获取详情: ${id}`);
    return getTracks({ url: id }); 
}

async function play(flag, id) { 
    log(`[play] 播放资源: flag=${flag}, id=${id}`);
    return jsonify({ url: id }); 
}

log('找盘资源插件加载完成 (V1.1 修复版)');
