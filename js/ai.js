// 文件名: plugin_funletu.js
// 描述: “趣乐兔”专属前端插件，纯搜索功能

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.7:3005/search"; // ★★★ 指向我们自己的新后端服务 ★★★
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEBUG = true;

// --- 辅助函数 ---
function log(msg) { if (DEBUG) console.log(`[趣乐兔插件] ${msg}`); }
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

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

    log(`[search] 搜索关键词: "<LaTex>${searchText}", 页码: $</LaTex>{page}`);
    if (!searchText) return jsonify({ list: [] });

    // 构建指向我们自己后端的请求URL
    const requestUrl = `<LaTex>${API_ENDPOINT}?keyword=$</LaTex>{encodeURIComponent(searchText)}&page=${page}`;
    log(`[search] 正在请求自建后端: ${requestUrl}`);

    try {
        const { data: response } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });

        if (response.code !== 200) { // “趣乐兔”API的成功码是200
            log(`[search] ❌ 后端服务返回错误: ${response.msg}`);
            return jsonify({ list: [] });
        }

        const results = response.data?.list;
        if (!results || !Array.isArray(results)) {
            log(`[search] ❌ 在返回的JSON中找不到 list 数组`);
            return jsonify({ list: [] });
        }
        
        const cards = results.map(item => {
            return {
                vod_id: item.url, // 直接用网盘链接作为ID，最简单高效
                vod_name: item.title,
                vod_pic: '', // 无图片
                vod_remarks: item.size || '未知大小',
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

// 获取网盘链接 - 极其简单
async function getTracks(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan_url || ext.id; // 兼容从ext或vod_id获取链接
    
    log(`[getTracks] 提取网盘链接: ${panUrl}`);
    
    if (!panUrl) {
        return jsonify({ list: [] });
    }

    return jsonify({
        list: [{
            title: '在线资源',
            tracks: [{ name: '夸克网盘', pan: panUrl }]
        }]
    });
}

// --- 移除和简化的兼容接口 ---
async function init() { return getConfig(); }
async function home() { return jsonify({ class: (await getConfig()).tabs, filters: {} }); }
async function category(tid, pg) { return jsonify({ list: [] }); } // 无分类，返回空
async function detail(id) { return getTracks({ id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
