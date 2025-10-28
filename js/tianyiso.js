/**
 * reboys.cn 前端插件 - V15.0 (与后端 V15 匹配的最终解析版)
 * * 核心修正: 修复 search/getTracks 的 JSON 解析和数据映射问题。
 * * 保持: home/category/辅助函数/detail的原始逻辑不变，确保插件分类功能完整。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
// 匹配后端的 Chrome 141 UA
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( ); // 假设环境提供此函数

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) {
        console.log(`[reboys插件 V15] ${msg}`); 
    }
}
function argsify(ext) { 
    if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } 
    return ext || {}; 
}
function jsonify(obj) { 
    return JSON.stringify(obj); 
}
// V13.2 遗留的 getConfig / home 逻辑...
async function getConfig() {
    log("==== 插件初始化 V15 ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V15)', site: SITE_URL, tabs: CATEGORIES });
}
// ----------------------------------------------------------------------
// ★★★★★ 首页/分类 (保持原逻辑不变) ★★★★★
// ----------------------------------------------------------------------
let homeCache = null;
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    log(`[getCards] 获取分类ID="${categoryId}"`);
    try {
        if (!homeCache) {
            log(`[getCards] 缓存未命中，正在抓取首页HTML...`);
            // 使用 V15 修正后的 UA
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        
        const targetBlock = $(`.home .block[v-show="${categoryId} == navSelect"]`);
        if (targetBlock.length === 0) {
            log(`❌ 在首页HTML中找不到分类ID为 ${categoryId} 的板块`);
            return jsonify({ list: [] });
        }

        targetBlock.find('a.item').each((_, element) => {
            const $item = $(element);
            const detailPath = $item.attr('href');
            const title = $item.find('p').text().trim();
            const imageUrl = $item.find('img').attr('src');
            
            
            if (detailPath && title) {
                cards.push({
                    // vod_id 存储详情页路径，并标记来源为 'home'
                    vod_id: jsonify({ type: 'home', path: detailPath }),
                    vod_name: title,
                    vod_pic: imageUrl || FALLBACK_PIC,
                    vod_remarks: '首页推荐'
                });
            }
        });
        log(`✓ 从首页HTML为分类 ${categoryId} 提取到 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
    } catch (e) {
        log(`❌ [getCards] 获取首页数据异常: ${e.message}`);
        homeCache = null;
        return jsonify({ list: [] });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 搜索 (核心修复：解析 V15 后端结构) ★★★★★
// ----------------------------------------------------------------------
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.text || '';
    if (!keyword) return jsonify({ list: [] });
    log(`[search] 开始搜索: ${keyword}`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(keyword)}&page=1`; // 假设只请求第一页
        // 1. 调用后端接口，使用 V15 修正后的 UA
        const { data: response } = await $fetch.get(url, { headers: { 'User-Agent': UA } });

        // 2. 检查后端返回的 code
        if (response.code !== 0) {
             log(`❌ [search] 后端搜索接口返回错误: ${response.message || '未知错误'}`);
             return jsonify({ list: [] });
        }

        // 3. 核心修正：安全地提取 results 数组 (后端结构: response.data.data.data.results)
        const results = response.data?.data?.data?.results || [];

        log(`[search] 后端成功返回 ${results.length} 条结果。`);

        // 4. 核心映射：将后端结果转换为 App 插件期望的格式
        const list = results.map(item => {
            // ⚠️ 关键：将网盘信息打包成 JSON 字符串，作为 vod_id 传递给 getTracks
            const vod_id_data = {
                type: 'search', 
                title: item.title,
                links: item.links || [], // 直接携带网盘链接数组
            };
            
            const vod_id = JSON.stringify(vod_id_data);
            
            const totalLinks = item.links?.length || 0;
            const remarks = totalLinks > 0 ? `共${totalLinks}个链接` : (item.datetime ? new Date(item.datetime).toLocaleDateString('zh-CN') : '无链接');

            return {
                vod_id: vod_id,         
                vod_name: item.title,   
                vod_pic: item.image || FALLBACK_PIC,  // 优先使用后端图片
                vod_remarks: remarks,  
            };
        });

        const total = response.data?.data?.data?.total || list.length;
        
        // 5. 返回符合 App 插件规范的结构
        return jsonify({
            list: list,
            total: total,
            page: 1,
            pagecount: Math.ceil(total / 10), // 假设每页10条
        });

    } catch (e) {
        log(`❌ [search] 搜索异常: ${e.message}`);
        return jsonify({ list: [], total: 0 });
    }
}


// ----------------------------------------------------------------------
// ★★★★★ 详情/播放 (核心修复：从 links 数组中解析多网盘) ★★★★★
// ----------------------------------------------------------------------
async function getTracks(ext) {
    const vod_id = ext.vod_id;
    log(`[getTracks] 收到 vod_id: ${vod_id}`);
    
    try {
        const idData = argsify(vod_id); // 解析 vod_id
        
        if (idData.type === 'search') {
            // 搜索结果模式：网盘链接已在 vod_id.links 中
            const links = idData.links;
            log(`[getTracks] (搜索源) 发现 ${links.length} 个网盘链接。`);

            if (links && links.length > 0) {
                // 将 links 数组转换为 App 期望的 tracks 格式
                const tracks = links.map(link => {
                    const panType = (link.type || '网盘').toUpperCase();
                    const password = link.password ? ` (码: ${link.password})` : '';
                    const name = `[${panType}] ${idData.title || '播放列表'}${password}`;
                    
                    return {
                        name: name,
                        pan: link.url, // 网盘链接
                    };
                });
                
                // 返回 App 播放列表结构
                return jsonify({ 
                    list: [{ 
                        title: idData.title || '播放列表', 
                        tracks: tracks 
                    }] 
                });

            } else {
                log(`[getTracks] ⚠️ 链接为空`);
                return jsonify({ list: [{ title: '播放列表', tracks: [{ name: '无可用链接', pan: '' }] }] });
            }

        } 
        else if (idData.type === 'home') {
            // 首页/分类模式：调用后端 /detail 接口解析详情页 (保持原有逻辑)
            log(`[getTracks] (首页源) 请求后端解析路径: ${idData.path}`);
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url);
            
            if (data.success) {
                let trackName = data.data.pwd ? `点击播放 (码: ${data.data.pwd})` : '点击播放';
                return jsonify({ 
                    list: [{ 
                        title: '播放列表', 
                        tracks: [{ name: trackName, pan: data.data.pan }] 
                    }] 
                });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }

        } 
        else {
            throw new Error('未知的 vod_id 类型');
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 ---
async function init() { return getConfig(); }
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs }); }
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 }); }
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
