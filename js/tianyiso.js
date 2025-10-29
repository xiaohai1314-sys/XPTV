/**
 * reboys.cn 前端插件 - V30.0 (夸父逻辑终极版)
 * 
 * 核心修改:
 * - getTracks函数完全重写，100%模仿“夸父资源”脚本的逻辑精髓。
 * - 接收后端传来的完整links数组。
 * - 在前端进行map循环，为每个链接对象生成一个track。
 * - pan字段：正确地拼接URL和密码。
 * - name字段：正确地自定义按钮名称。
 * - 这是与您所有成功案例逻辑完全统一的最终版本。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );

// --- 全局缓存 (保留，但search函数不再使用) ---
let homeCache = null;

// --- 辅助函数 ---
function log(msg) { 
    const logMsg = `[reboys V30] ${msg}`;
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

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V30 (夸父逻辑终极版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, 
        { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, 
        { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ 
        ver: 1, 
        title: 'reboys搜(V30)', 
        site: SITE_URL, 
        tabs: CATEGORIES 
    });
}

// --- 首页/分类 (保留原有逻辑) ---
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    try {
        if (!homeCache) {
            log(`[getCards] 获取首页缓存`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        const $ = cheerio.load(homeCache);
        const cards = [];
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        if (targetBlock.length === 0) {
            log(`[getCards] 未找到分类 ${categoryId}`);
            return jsonify({ list: [] });
        }
        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            if (detailPath && title) {
                cards.push({
                    vod_id: jsonify({ type: 'home', path: detailPath }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        log(`[getCards] 返回 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`[getCards] 异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}

// --- 搜索函数 ---
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}`;
        const fetchResult = await $fetch.get(url, { timeout: 45000 });
        const response = argsify(fetchResult.data || fetchResult);
        if (response.code !== 0 || !response.list) {
            throw new Error(`后端返回错误: ${response.message || '未知错误'}`);
        }
        log(`[search] ✅ 后端返回 ${response.list.length} 条结果`);
        return jsonify({ list: response.list });
    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ 核心函数：getTracks，完全吸收“夸父资源”脚本的逻辑精髓 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
async function getTracks(ext) {
    // ext.vod_id 是一个JSON字符串，例如: '{"title":"...", "links": [{"type":"quark", "url":"...", "password":"123"}] }'
    const idData = argsify(ext.vod_id);
    const links = idData.links || []; // 提取出 links 数组
    const title = idData.title || '未知资源';

    log(`[getTracks] 开始处理"${title}", 找到 ${links.length} 个链接`);

    if (links.length === 0) {
        return jsonify({ list: [{ title: '云盘', tracks: [{ name: '暂无有效链接', pan: '' }] }] });
    }

    // 核心：完全模仿“夸父资源”的 map 循环逻辑
    const tracks = links.map((linkData, index) => {
        const url = linkData.url;
        const password = linkData.password;
        
        // 1. 确定网盘类型，用于按钮命名
        let panType = '网盘';
        if (linkData.type === 'quark' || (url && url.includes('quark.cn'))) {
            panType = '夸克';
        } else if (linkData.type === 'aliyun' || (url && url.includes('aliyundrive.com'))) {
            panType = '阿里';
        } else if (linkData.type === 'baidu' || (url && url.includes('pan.baidu.com'))) {
            panType = '百度';
        }

        // 2. 生成按钮名称，例如 "夸克网盘 1"
        const buttonName = `${panType}网盘 ${index + 1}`;
        
        // 3. 在 pan 字段中拼接URL和密码
        const finalPan = password ? `${url}（访问码：${password}）` : url;

        return {
            name: buttonName,
            pan: finalPan,
            ext: {}
        };
    });

    // 4. 返回标准的 list/tracks 结构
    return jsonify({
        list: [{
            title: '云盘', // 分组标题
            tracks: tracks // 包含所有链接按钮的数组
        }]
    });
}

// --- 播放函数 (备用) ---
async function play(flag, id) {
    log(`[play] flag=${flag}, id=${id}`);
    if (id && (id.startsWith('http' ) || id.startsWith('//'))) {
        log(`[play] 返回网盘链接: ${id.substring(0, 50)}...`);
        return jsonify({ parse: 0, url: id, header: {} });
    }
    log(`[play] 无效的播放ID`);
    return jsonify({ parse: 0, url: '', header: {} });
}

// --- 兼容接口 ---
async function init() { 
    return getConfig(); 
}

async function home() { 
    const c = await getConfig(); 
    return jsonify({ class: JSON.parse(c).tabs }); 
}

async function category(tid, pg) { 
    return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); 
}

async function detail(id) { 
    return getTracks({ vod_id: id }); 
}

log('==== 插件加载完成 V30 ====');
