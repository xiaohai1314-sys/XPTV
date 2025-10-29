/**
 * reboys.cn 前端插件 - V26.0 (釜底抽薪版)
 * 变更日志:
 * 1. [终极破局] 彻底放弃 App 的详情页流程，不再依赖任何 vod_id 传递。
 * 2. [架构重塑] 将所有链接处理逻辑前置到 search 函数中。
 * 3. [一步到位] search 函数直接生成 App 可识别的 vod_play_from 和 vod_play_url 字段。
 * 4. [逻辑简化] detail 和 getTracks 函数被完全架空，不再使用。
 * 5. [最终诊断] 确认问题根源为 App 环境在页面跳转间完全不传递或丢失自定义 ID。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.10.106:3000";
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { 
    const logMsg = `[reboys V25] ${msg}`;
    try { $log(logMsg); } catch (_) { if (DEBUG) console.log(logMsg); }
}

function argsify(ext) { 
    if (typeof ext === 'string') {
        try { return JSON.parse(ext); } catch (e) { return {}; }
    }
    return ext || {}; 
}

function jsonify(obj) { 
    return JSON.stringify(obj); 
}

// --- 插件入口与配置 ---
async function getConfig() {
    log("==== 插件初始化 V25 (釜底抽薪版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V25)', site: SITE_URL, tabs: CATEGORIES });
}


// ----------------------------------------------------------------------
// 搜索 (V25 唯一核心)
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 搜索: "${keyword}"`);
    
    try {
        log(`[search] 请求后端API`);
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`;
        const fetchResult = await $fetch.get(url, { headers: { 'User-Agent': UA }, timeout: 30000 });
        let response = JSON.parse(fetchResult.data || fetchResult);
        
        if (!response || response.code !== 0) throw new Error(response.message || '后端错误');
        
        const results = response.data?.data?.results || [];
        if (results.length === 0) throw new Error('后端未返回有效结果');
        
        log(`[search] 成功从后端获取 ${results.length} 条结果`);

        const list = results.map(item => {
            const links = item.links || [];
            
            // 1. 构建播放列表的 "from" (来源)
            // 例如: 夸克#百度#阿里
            const playFrom = links.map(link => {
                const url = link.url || '';
                if (url.includes('quark.cn')) return '夸克';
                if (url.includes('pan.baidu.com')) return '百度';
                if (url.includes('aliyundrive.com')) return '阿里';
                return '网盘';
            }).join('#');

            // 2. 构建播放列表的 "url" (链接)
            // 例如: 播放$https://...#播放$https://...
            const playUrl = links.map(link => {
                const password = link.password ? ` 码:${link.password}` : '';
                const name = `${item.title}${password}`;
                return `${name}$${link.url}`;
            } ).join('#');

            return {
                // vod_id 随便给一个唯一值即可，因为它不会被用到
                vod_id: item.unique_id, 
                vod_name: item.title,
                vod_pic: item.image || FALLBACK_PIC,
                vod_remarks: `${links.length}个网盘`,
                // 【V25 核心】直接在这里提供播放列表信息
                vod_play_from: playFrom,
                vod_play_url: playUrl,
            };
        });
        
        // 注意：这个方案不支持前端分页，一次性返回所有结果
        return jsonify({ list: list, page: 1, pagecount: 1, total: list.length });

    } catch (e) {
        log(`[search] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 以下函数全部被架空，不再重要 ---

async function getCards(ext) { return jsonify({list:[]}); }

async function getTracks(ext) { 
    log("[getTracks] 此函数已被架空，不应被调用");
    return jsonify({ list: [] }); 
}

async function play(flag, id) { 
    log("[play] 直接播放: " + id);
    return jsonify({ parse: 0, url: id }); 
}

async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return jsonify({list:[]}); }
async function detail(id) { 
    log("[detail] 此函数已被架空，不应被调用");
    return jsonify({ list: [] }); 
}

log('==== 插件加载完成 V25 ====');
