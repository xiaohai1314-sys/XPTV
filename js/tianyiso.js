/**
 * reboys.cn 前端插件 - V27.0 (返璞归真版)
 * 核心逻辑:
 * 1. [拨乱反正] 确认 reboys.cn 是一个纯前端渲染弹窗的网站，无有效API。
 * 2. [架构重塑] 前端只负责两件事：抓取搜索列表HTML；请求新后端获取真实链接。
 * 3. [search重构] search函数直接访问reboys.cn，解析HTML列表，vod_id只保存列表索引。
 * 4. [getTracks重构] getTracks函数调用一个全新的后端API(/get-link)，传递keyword和索引，获取最终链接。
 * 5. [后端依赖] 此前端必须配合一个能够模拟“搜索-点击-提取”完整流程的全新后端脚本。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 你的新后端地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局变量 ---
let currentSearchKeyword = ''; // 用于在详情页回传给后端

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V27] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V27 (返璞归真版) ====");
    const CATEGORIES = [
        { name: '电影', ext: { id: '电影' } },
        { name: '电视剧', ext: { id: '电视剧' } },
        { name: '动漫', ext: { id: '动漫' } },
        { name: '综艺', ext: { id: '综艺' } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V27)', site: SITE_URL, tabs: CATEGORIES });
}

// ----------------------------------------------------------------------
// 搜索 (只负责解析HTML列表)
// ----------------------------------------------------------------------
async function search(ext) {
    const keyword = (typeof ext === 'string' ? ext : ext.text) || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);

    // 保存当前关键词，以便详情页使用
    currentSearchKeyword = keyword;

    try {
        const searchUrl = `${SITE_URL}/search.html?keyword=${encodeURIComponent(keyword)}`;
        log(`[search] 直接访问: ${searchUrl}`);

        const { data } = await $fetch.get(searchUrl, { headers: { 'User-Agent': UA } });
        const $ = cheerio.load(data);
        const cards = [];

        $('div.searchList a.item').each((index, element) => {
            const $item = $(element);
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            
            if (title) {
                cards.push({
                    // 【V27 核心】vod_id 只保存该项在列表中的索引
                    vod_id: index.toString(),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '点击获取资源'
                });
            }
        });

        if (cards.length === 0) {
            log('[search] 未在HTML中解析到任何结果');
        } else {
            log(`[search] 成功解析到 ${cards.length} 条结果`);
        }
        
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ----------------------------------------------------------------------
// 详情 (请求新后端，获取真实链接)
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const index = ext.vod_id || ext;
    log(`[getTracks] 获取详情, 关键词: "${currentSearchKeyword}", 索引: ${index}`);
    
    try {
        if (!currentSearchKeyword || index === undefined) {
            throw new Error('关键词或索引丢失，请返回重试');
        }

        // 【V27 核心】请求全新的后端API
        const apiUrl = `${BACKEND_URL}/get-link?keyword=${encodeURIComponent(currentSearchKeyword)}&index=${index}`;
        log(`[getTracks] 请求新后端: ${apiUrl}`);

        const fetchResult = await $fetch.get(apiUrl, { timeout: 45000 }); // Puppeteer需要更长超时
        const response = JSON.parse(fetchResult.data || fetchResult);

        if (!response.success || !response.link) {
            throw new Error(response.message || '后端未能获取到链接');
        }

        const realUrl = response.link;
        log(`[getTracks] 后端成功返回真实链接: ${realUrl}`);

        let panType = '网盘';
        if (realUrl.includes('quark.cn')) panType = '夸克';
        else if (realUrl.includes('pan.baidu.com')) panType = '百度';
        else if (realUrl.includes('aliyundrive.com')) panType = '阿里';

        const track = { name: `[${panType}] 点击播放`, pan: realUrl };
        
        return jsonify({ 
            list: [{ title: '播放列表', tracks: [track] }],
            vod_play_from: panType,
            vod_play_url: `${track.name}$${track.pan}`
        });

    } catch (e) {
        log(`[getTracks] 异常: ${e.message}`);
        return jsonify({ list: [{ title: '错误', tracks: [{ name: `获取链接失败: ${e.message}`, pan: '' }] }] });
    }
}

// --- 其他接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return jsonify({list:[]}); } // 分类页简化
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ parse: 0, url: id }); }

log('==== 插件加载完成 V27 ====');
