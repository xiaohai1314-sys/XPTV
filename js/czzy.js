/**
 * 4k热播影视 前端插件 - V4.2 (测试版 - 无缓存)
 *
 * 核心变更:
 * 1. 完全保留V4.0的HTML抓取逻辑
 * 2. 暂时移除缓存机制，只测试分页切片
 * 3. 添加详细的调试日志
 */

// --- 配置区 ---
const API_ENDPOINT = "http://127.0.0.1:3000/search";
const SITE_URL = "https://reboys.cn";

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const cheerio = createCheerio();
const FALLBACK_PIC = `${SITE_URL}/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png`;
const DEBUG = true;
const PAGE_SIZE = 48; // 每页20个（调大一些便于测试）

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[4k影视插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }
function getCorrectUrl(path) {
    if (!path || path.startsWith('http')) return path || '';
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 V4.2 (测试版) ====");
    const CUSTOM_CATEGORIES = [
        { name: '短剧', ext: { id: 1 } },
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } },
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } },
    ];
    return jsonify({
        ver: 4.2,
        title: '4k热播影视',
        site: SITE_URL,
        cookie: '',
        tabs: CUSTOM_CATEGORIES,
    });
}

// ★★★★★【首页分类 - V4.0逻辑 + 分页切片】★★★★★
async function getCards(ext) {
    ext = argsify(ext);
    const categoryId = ext.id;
    const page = parseInt(ext.page || 1, 10);
    
    log(`[getCards] ========================================`);
    log(`[getCards] 请求分类ID: ${categoryId}, 页码: ${page}`);

    try {
        log(`[getCards] 正在从 ${SITE_URL} 获取首页HTML...`);
        const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        
        log(`[getCards] HTML加载成功，长度: ${data.length} 字符`);

        // 使用V4.0的选择器
        const contentBlock = $(`div.block[v-show="${categoryId} == navSelect"]`);
        log(`[getCards] contentBlock.length = ${contentBlock.length}`);
        
        if (contentBlock.length === 0) {
            log(`[getCards] ❌ 找不到ID为 ${categoryId} 的内容块`);
            
            // 调试：列出所有 div.block 的 v-show 属性
            log(`[getCards] 【调试】页面中所有的 v-show 属性：`);
            $('div.block').each((idx, block) => {
                const vShow = $(block).attr('v-show');
                log(`[getCards]   [${idx}] v-show="${vShow}"`);
            });
            
            return jsonify({ list: [] });
        }

        log(`[getCards] ✓ 找到分类内容块`);

        // 提取所有卡片
        const allCards = [];
        contentBlock.find('a.item').each((_, element) => {
            const cardElement = $(element);
            const detailUrl = cardElement.attr('href');
            const imgSrc = cardElement.find('img').attr('src');
            const title = cardElement.find('p').text().trim();
            
            allCards.push({
                vod_id: getCorrectUrl(detailUrl),
                vod_name: title,
                vod_pic: getCorrectUrl(imgSrc),
                vod_remarks: '',
                ext: { url: getCorrectUrl(detailUrl) }
            });
        });

        log(`[getCards] ✓ 成功提取 ${allCards.length} 个卡片`);

        // 分页切片（关键改动）
        const startIdx = (page - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const pageCards = allCards.slice(startIdx, endIdx);

        log(`[getCards] 分页：总数=${allCards.length}, 第${page}页返回${pageCards.length}个 (索引${startIdx}-${endIdx})`);
        
        if (pageCards.length === 0) {
            log(`[getCards] 第${page}页无数据，停止加载`);
        }

        // 调试：输出前3个卡片的标题
        if (pageCards.length > 0) {
            log(`[getCards] 本页前3个卡片: ${pageCards.slice(0, 3).map(c => c.vod_name).join(', ')}`);
        }

        return jsonify({ list: pageCards });
        
    } catch (e) {
        log(`[getCards] ❌ 发生异常: ${e.message}`);
        log(`[getCards] 异常堆栈: ${e.stack}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索功能】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    if (page > 1) {
        log(`[search] 请求页码 > 1，返回空列表以停止无限加载。`);
        return jsonify({ list: [] });
    }

    log(`[search] 搜索关键词: "${searchText}" (后端API模式)`);

    if (!searchText) {
        return jsonify({ list: [] });
    }

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
                ext: { url: finalUrl }
            };
        }).filter(card => card !== null);

        log(`[search] ✓ API成功返回并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析JSON时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情页】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const id = ext.url;
    
    if (!id) {
        log(`[getTracks] ❌ URL为空`);
        return jsonify({ list: [] });
    }

    if (id.includes('pan.quark.cn') || id.includes('pan.baidu.com') || id.includes('aliyundrive.com')) {
        log(`[getTracks] ✓ 检测到最终网盘链接，直接使用: ${id}`);
        
        let panName = '网盘资源';
        if (id.includes('quark')) panName = '夸克网盘';
        else if (id.includes('baidu')) panName = '百度网盘';
        else if (id.includes('aliyundrive')) panName = '阿里云盘';

        return jsonify({
            list: [{ title: '点击播放', tracks: [{ name: panName, pan: id, ext: {} }] }]
        });
    } else {
        log(`[getTracks] 检测到中间页链接，需要请求后端API进行解析: ${id}`);
        const keyword = id.split('/').pop().replace('.html', '');
        const requestUrl = `${API_ENDPOINT}?keyword=${encodeURIComponent(keyword)}`;
        
        log(`[getTracks] 正在请求后端API: ${requestUrl}`);
        try {
            const { data: jsonString } = await $fetch.get(requestUrl);
            const response = JSON.parse(jsonString);
            const results = response.data?.data?.results;

            if (!results || results.length === 0) {
                throw new Error("API未能解析出有效链接");
            }

            const finalUrl = results[0].links[0].url;
            log(`[getTracks] ✓ API成功解析出链接: ${finalUrl}`);
            
            let panName = '夸克网盘';
            if (finalUrl.includes('baidu')) panName = '百度网盘';
            else if (finalUrl.includes('aliyundrive')) panName = '阿里云盘';

            return jsonify({
                list: [{ title: '解析成功', tracks: [{ name: panName, pan: finalUrl, ext: {} }] }]
            });

        } catch (e) {
            log(`[getTracks] ❌ 解析中间页时发生异常: ${e.message}`);
            return jsonify({
                list: [{ title: '自动解析失败', tracks: [{ name: '请手动打开', pan: id, ext: {} }] }]
            });
        }
    }
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

log('==== 插件加载完成 V4.2 (测试版) ====');
