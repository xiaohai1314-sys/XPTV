/**
 * reboys.cn 前端插件 - V13.1 (逻辑修正版)
 * 
 * 核心修正:
 * 1. [逻辑修正] search: 只返回标题和详情页ID(路径)，不再尝试解析网盘链接。
 * 2. [逻辑修正] getTracks: 调用后端的 /detail 接口来获取真实的网盘链接。
 * 3. [保持] 其他函数和配置保持 V13.1 的原样。
 */

// --- 配置区 (保持不变) ---
const BACKEND_URL = "http://192.168.10.106:3000"; // 您的后端服务地址
const SITE_URL = "https://reboys.cn";
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64  ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;
const cheerio = createCheerio(  );

// --- 辅助函数 (保持不变) ---
function log(msg) { if (DEBUG) console.log(`[reboys插件 V13-logic-fixed] ${msg}`); }
function argsify(ext) { if (typeof ext === 'string') try { return JSON.parse(ext); } catch (e) { return {}; } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 (保持不变) ---
// ... (您原来的 getConfig, getCards 函数) ...

// ★★★★★【搜索 - 逻辑修正】★★★★★
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    if (!text) return jsonify({ list: [] });
    log(`[search] 用户搜索: "${text}"`);
    
    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        const { data } = await $fetch.get(url);
        
        if (data && data.code === 0) {
            // 注意：这里我们使用与V17相同的、经过验证的正确路径
            const results = data.data?.data?.results || [];
            log(`✓ 后端返回 ${results.length} 条搜索结果`);
            
            return jsonify({
                list: results.map(item => ({
                    // vod_id 现在是详情页的路径，它在 item.url 字段中
                    vod_id: item.url, 
                    vod_name: item.title,
                    vod_pic: item.image || FALLBACK_PIC,
                    vod_remarks: '点击获取链接' // 明确告知用户需要点击
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

// ★★★★★【详情 - 逻辑修正】★★★★★
async function getTracks(ext) {
    ext = argsify(ext);
    // 这里的 ext.vod_id 就是 search 函数存入的详情页路径
    const detailPath = ext.vod_id; 
    log(`[getTracks] 解析详情, 路径: ${detailPath}`);

    if (!detailPath) {
        log(`[getTracks] ❌ 详情路径为空`);
        return jsonify({ list: [] });
    }

    try {
        // 调用后端新增的 /detail 接口
        const url = `${BACKEND_URL}/detail?path=${encodeURIComponent(detailPath)}`;
        const { data } = await $fetch.get(url);

        if (data && data.success) {
            log(`✓ 成功从后端获取到播放链接: ${data.url}`);
            const trackName = data.pwd ? `点击播放 (码: ${data.pwd})` : '点击播放';
            
            // 返回包含真实链接的播放列表
            return jsonify({ 
                list: [{ 
                    title: '播放列表', 
                    tracks: [{ name: trackName, pan: data.url }] 
                }] 
            });
        } else {
            throw new Error(`后端详情解析失败: ${data.message}`);
        }
    } catch (e) {
        log(`❌ [getTracks] 异常: ${e.message}`);
        // 异常时提供一个手动打开的备用方案
        return jsonify({
            list: [{
                title: '自动解析失败',
                tracks: [{ name: '请手动打开', pan: `${SITE_URL}${detailPath}` }]
            }]
        });
    }
}

// --- 兼容接口 (保持不变) ---
// ... (您原来的 init, home, category, detail, play 函数) ...
// 注意：需要确保 detail(id) 函数能正确调用 getTracks({vod_id: id})
async function detail(id) { 
    return getTracks({ vod_id: id }); 
}
