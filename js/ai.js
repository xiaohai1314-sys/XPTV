// 文件名: plugin_funletu.js
// 描述: “趣乐兔”专属前端插件，纯搜索功能 - 语法修复和优化版

// --- 配置区 ---
// ★★★ 请确保这个IP和端口在运行环境中可以访问 ★★★
const API_ENDPOINT = "http://192.168.1.7:3005/search"; 
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { 
    if (DEBUG) console.log(`[趣乐兔插件] ${msg}`); 
}

function argsify(ext) { 
    // 确保 ext 是对象，兼容字符串输入
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

    // ★★★ 修复点 1：使用模板字面量 (反引号 `) 进行日志输出 ★★★
    log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);
    if (!searchText) return jsonify({ list: [] });

    // ★★★ 修复点 2：使用模板字面量构建 URL，并确保关键词已编码 ★★★
    const encodedKeyword = encodeURIComponent(searchText);
    const requestUrl = `${API_ENDPOINT}?keyword=${encodedKeyword}&page=${page}`;
    log(`[search] 正在请求自建后端: ${requestUrl}`);

    try {
        // 使用 $fetch.get 发起请求
        const { data: response } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });

        if (response.code !== 200) { // “趣乐兔”API的成功码是200
            log(`[search] ❌ 后端服务返回错误: code=${response.code}, msg=${response.msg}`);
            return jsonify({ list: [] });
        }

        const results = response.data?.list;
        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 list 数组或数组为空`);
            return jsonify({ list: [] });
        }
        
        // 格式化数据为前端要求的卡片结构
        const cards = results.map(item => {
            return {
                // 使用网盘链接作为唯一ID，方便后续提取
                vod_id: item.url, 
                vod_name: item.title,
                vod_pic: '', // 插件无图片，留空
                vod_remarks: item.size || '未知大小', // 备注显示文件大小
                ext: { pan_url: item.url } // 将链接也存入ext，供getTracks使用
            };
        });

        log(`[search] ✓ 成功获取并格式化 ${cards.length} 个卡片`);
        return jsonify({ list: cards });

    } catch (e) {
        log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
        return jsonify({ list: [] });
    }
}

// 获取网盘链接 (资源详情) - 极其简单
async function getTracks(ext) {
    ext = argsify(ext);
    // 从 ext.pan_url (搜索卡片传入) 或 ext.id (详情页/play调用) 获取链接
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
                name: '夸克网盘', // 假设所有链接都是夸克网盘
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
    // 无分类功能，直接返回空列表
    return jsonify({ list: [] }); 
} 

async function detail(id) { 
    // 详情页直接调用 getTracks 获取资源链接
    return getTracks({ id: id }); 
}

async function play(flag, id) { 
    // 播放功能直接返回链接本身
    return jsonify({ url: id }); 
}
