/**
 * reboys.cn 前端插件 - V15.0 (最小变动核心修复版)
 * * 核心修正: 修复了 search/getTracks 的 JSON 解析和数据映射问题。
 * * home/category/辅助函数：保持原有逻辑。
 */

// --- 配置区 ---
const BACKEND_URL = "http://192.168.1.7:3000";
// 修正 UA 版本到 Chrome 141，匹配已修复的后端设置
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio( );
// 假设环境提供此函数

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[reboys插件 V13] ${msg}`);
}
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {};
} return ext || {}; }
function jsonify(data) { return JSON.stringify(data);
}

// --- 插件入口 ---
async function getConfig() {
    log("==== 插件初始化 V13 (最终版) ====");
    const CATEGORIES = [
        { name: '短剧', ext: { id: 1 } }, { name: '电影', ext: { id: 2 } },
        { name: '电视剧', ext: { id: 3 } }, { name: '动漫', ext: { id: 4 } },
        { name: '综艺', ext: { id: 5 } }
    ];
    return jsonify({ ver: 1, title: 'reboys搜(V13)', site: SITE_URL, tabs: CATEGORIES });
}

// ★★★★★【首页/分类 - 保持原逻辑】★★★★★
let homeCache = null;
// 缓存首页HTML内容
async function getCards(ext) {
    ext = argsify(ext);
    const { id: categoryId } = ext;
    log(`[getCards] 获取分类ID="${categoryId}"`);
    try {
        if (!homeCache) {
            log(`[getCards] 缓存未命中，正在抓取首页HTML...`);
            const { data } = await $fetch.get(SITE_URL, { headers: { 'User-Agent': UA } });
            homeCache = data;
        }
        
        const $ = cheerio.load(homeCache);
        const cards = [];
        
        // 根据分类ID选择对应的板块，reboys.cn的板块v-show从1开始
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
        log(`❌ [getCards] 异常: ${e.message}`);
        homeCache = null;
        // 出错时清空缓存
        return jsonify({ list: [] });
    }
}

// ★★★★★【搜索 - 核心修复】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
    log(`[search] 用户搜索: "${text}"`);
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        const { data } = await $fetch.get(url);
        if (data && data.code === 0) {
            // 修正：从后端返回的深层结构中提取 results (路径是正确的)
            const results = data.data?.data?.results ||
            [];
            log(`✓ 后端返回 ${results.length} 条搜索结果`);
            return jsonify({
                list: results.map(item => ({
                    // 修正 vod_id: 存储完整的 links 数组，以支持多网盘/多信息
                    vod_id: jsonify({ 
                        type: 'search', 
                        title: item.title, // 添加 title 方便 getTracks 使用
                        links: item.links || [], // 携带完整的 links 数组 (包含 pan/pwd)
                    }),
                    vod_name: item.title,
   
                    // 假设 item.image 包含图片信息，否则使用 FALLBACK_PIC
                    vod_pic: item.image || FALLBACK_PIC, 
                    // 备注：显示链接数量，而不是单个密码
                    vod_remarks: item.links && item.links.length > 0 ? `共${item.links.length}个链接` : '无链接'
                }))
            });
        } else {
            log(`❌ 后端搜索接口返回错误: ${data.message}`);
            return jsonify({ list: [] });
        }
    } catch (e) {
        log(`❌ [search] 请求后端异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// ★★★★★【详情 - 核心修复】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    const idData = argsify(ext.vod_id); // 解析 vod_id
    log(`[getTracks] 解析详情: ${JSON.stringify(idData)}`);
    try {
        if (idData.type === 'search') {
            // 修正：如果是搜索结果，遍历 links 数组生成 tracks
            const links = idData.links || [];
            if (links.length > 0) {
                const tracks = links.map(link => {
                    // 构造 track 名称：如 [夸克] 帝陵 (码: XXXX)
                    const panType = (link.type || '网盘').toUpperCase();
                    const password = link.password ? ` (码: ${link.password})` : '';
                    const name = `[${panType}] ${idData.title || '播放列表'}${password}`;
                    
                    return {
                        name: name,
                        pan: link.url, // 网盘链接
                    };
                });

                log(`[getTracks] (搜索源) 提取到 ${tracks.length} 个网盘链接`);

                return jsonify({ 
                    list: [{ 
                        title: idData.title || '播放列表', 
                        tracks: tracks 
                    }] 
                });
            } else {
                 log(`[getTracks] (搜索源) 无可用链接`);
                 return jsonify({ list: [{ title: '播放列表', tracks: [{ name: '无可用链接', pan: '' }] }] });
            }
        } 
        else if (idData.type === 'home') {
            // 如果是首页结果，调用后端的 /detail 接口
            log(`[getTracks] (首页源) 请求后端解析路径: ${idData.path}`);
            const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(idData.path)}`;
            const { data } = await $fetch.get(url);
            if (data.success) {
                let trackName = data.data.pwd ?
                `点击播放 (码: ${data.data.pwd})` : '点击播放';
                return jsonify({ list: [{ title: '播放列表', tracks: [{ name: trackName, pan: data.data.pan }] }] });
            } else {
                throw new Error(`后端详情解析失败: ${data.message}`);
            }
        } else {
            throw new Error('未知的 vod_id 类型');
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// --- 兼容接口 (保持你原有的逻辑) ---
async function init() { return getConfig();
}
async function home() { const c = await getConfig(); return jsonify({ class: JSON.parse(c).tabs });
}
async function category(tid, pg) { return getCards({ id: (argsify(tid)).id || tid, page: pg || 1 });
}
async function detail(id) { return getTracks({ vod_id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
