// 文件名: plugin_funletu.js
// 描述: “趣乐兔”专属前端插件，纯搜索功能 - 最终修复版

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.7:3005/search"; // ★★★ 指向我们自己的新后端服务 ★★★
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) console.log(`[趣乐兔插件] ${msg}`); 
}

function argsify(ext) { 
    return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); 
}

function jsonify(data) { 
    return JSON.stringify(data); 
}

// --- App 插件入口函数 ---

async function getConfig() {
    log("==== 插件初始化 (v1.0) ====");
    return jsonify({
        ver: 1.0,
        title: '趣乐兔搜索',
        site: 'https://pan.funletu.com',
        tabs: [{ name: '搜索', ext: {} }], // 只有一个无功能的标签页
    });
}

// 搜索功能 - 请求我们自己的后端
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);
    if (!searchText) return jsonify({ list: [] });

    const encodedKeyword = encodeURIComponent(searchText);
    const requestUrl = `${API_ENDPOINT}?keyword=${encodedKeyword}&page=${page}`;
    log(`[search] 正在请求自建后端: ${requestUrl}`);

    try {
        // 假设 $fetch.get 返回 { data: <后端返回的整个JSON对象> }
        const { data: backendResponse } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });

        // 检查后端服务的返回码 (200)
        if (backendResponse.code !== 200) { 
            log(`[search] ❌ 后端服务返回错误: code=${backendResponse.code}, msg=${backendResponse.msg}`);
            return jsonify({ list: [] });
        }

        // ★★★ 核心修复点：正确地从 backendResponse.data 中获取 list 数组 ★★★
        // 您的后端JSON结构为 {code: 200, data: {list: [...]}}
        const results = backendResponse.data?.list; 

        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 data.list 数组或数组为空`);
            return jsonify({ list: [] });
        }
        
        // 格式化数据为前端要求的卡片结构
        const cards = results.map(item => {
            return {
                // 使用网盘链接作为唯一ID
                vod_id: item.url, 
                vod_name: item.title,
                vod_pic: '', 
                // 备注使用 size 字段
                vod_remarks: item.size || '未知大小', 
                ext: { pan_url: item.url } // 将链接也存入ext
            };
        });

        log(`[search] ✓ 成功获取并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 获取网盘链接 (资源详情)
async function getTracks(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan_url || ext.id; 
    
    log(`[getTracks] 提取网盘链接: ${panUrl}`);
    
    if (!panUrl) {
        log('[getTracks] ❌ 链接为空，无法返回 tracks');
        return jsonify({ list: [] });
    }

    // 构造标准的资源列表结构
    return jsonify({
        list: [{
            title: '在线资源',
            tracks: [{ 
                name: '夸克网盘', 
                pan: panUrl 
            }]
        }]
    });
}

// --- 兼容接口 (保持原样，仅做简单转发) ---
async function init() { 
    return getConfig(); 
}

async function home() { 
    const config = await getConfig();
    const tabs = JSON.parse(config).tabs;
    return jsonify({ class: tabs, filters: {} }); 
}

async function category(tid, pg) { 
    return jsonify({ list: [] }); 
} 

async function detail(id) { 
    return getTracks({ id: id }); 
}

async function play(flag, id) { 
    return jsonify({ url: id }); 
}
