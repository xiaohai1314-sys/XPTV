// 文件名: plugin_funletu.js (v1.4 - 严格语法遵从版)
// 描述: 严格使用传统字符串拼接，并保留UI调试功能。

// --- 配置区 ---
const API_ENDPOINT = "http://192.168.1.7:3005/search"; 
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- 辅助函数 ---
function argsify(ext) { return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// --- App 插件入口函数 ---

async function getConfig() {
    console.log("[趣乐兔插件] ==== 插件初始化 (v1.4 - 严格语法遵从) ====");
    return jsonify({
        ver: 1.4,
        title: '趣乐兔 (调试)',
        site: 'https://pan.funletu.com',
        tabs: [{ name: '搜索', ext: {} }],
    });
}

// 搜索功能 - 严格语法 + UI调试
async function search(ext) {
    ext = argsify(ext);
    const searchText = ext.text || '';
    const page = parseInt(ext.page || 1, 10);

    // ★★★【关键修正】: 严格使用传统字符串拼接 ★★★
    console.log("[趣乐兔插件] [search] 搜索关键词: \"" + searchText + "\", 页码: " + page);
    if (!searchText) return jsonify({ list: [] });

    const encodedKeyword = encodeURIComponent(searchText);
    // ★★★【关键修正】: 严格使用传统字符串拼接 ★★★
    const requestUrl = API_ENDPOINT + '?keyword=' + encodedKeyword + '&page=' + page;
    console.log("[趣乐兔插件] [search] 正在请求自建后端: " + requestUrl);

    try {
        // ★★★【关键修正】: 严格使用您范例中的两步解析法 ★★★
        const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
        
        // 调试点 0: 检查返回的是否是字符串
        if (typeof jsonString !== 'string' || !jsonString) {
            const debugCard = { vod_id: 'debug-0', vod_name: '[调试] 失败', vod_remarks: '后端未返回有效的字符串' };
            return jsonify({ list: [debugCard] });
        }

        const response = JSON.parse(jsonString);

        // 调试点 1: 检查 response 对象本身是否存在
        if (!response) {
            const debugCard = { vod_id: 'debug-1', vod_name: '[调试] 失败', vod_remarks: 'JSON解析后为空(null/undefined)' };
            return jsonify({ list: [debugCard] });
        }

        // 调试点 2: 检查 response.code 是否为 200
        if (response.code !== 200) {
            const debugCard = { vod_id: 'debug-2', vod_name: '[调试] 后端业务错误', vod_remarks: 'Code: ' + response.code + ', Msg: ' + response.msg };
            return jsonify({ list: [debugCard] });
        }

        // 调试点 3: 检查 response.data.list 是否是有效数组
        const results = response.data?.list;
        if (!results || !Array.isArray(results) || results.length === 0) {
            const responseKeys = response.data ? Object.keys(response.data).join(', ') : 'response.data为空';
            const debugCard = { vod_id: 'debug-3', vod_name: '[调试] JSON结构或空列表', vod_remarks: '未找到有效list。data键: ' + responseKeys };
            return jsonify({ list: [debugCard] });
        }
        
        const cards = results.map(item => {
            return {
                vod_id: item.url, 
                vod_name: item.title,
                vod_pic: '',
                vod_remarks: item.size || '未知大小',
                ext: { pan_url: item.url }
            };
        });

        // 调试点 4: 成功标记
        const successCard = { 
            vod_id: 'debug-success', 
            vod_name: '[调试] 成功处理 ' + cards.length + ' 条数据', 
            vod_remarks: '若只看到此条，说明App渲染后续列表失败' 
        };
        
        const finalList = [successCard, ...cards];
        console.log("[趣乐兔插件] [search] ✓ 成功获取并格式化 " + finalList.length + " 个卡片，准备返回");
        return jsonify({ list: finalList });

    } catch (e) {
        // ★★★【关键修正】: 遵从您的范例，catch块不返回任何东西 ★★★
        console.log("[趣乐兔插件] [search] ❌ 请求或解析时发生异常: " + e.message);
        // 不返回任何内容，让App环境自行处理错误
    }
}

// --- 其他函数 (保持不变) ---
async function getTracks(ext) {
    ext = argsify(ext);
    const panUrl = ext.pan_url || ext.id; 
    if (!panUrl || (typeof panUrl === 'string' && panUrl.startsWith('debug-'))) return jsonify({ list: [] });
    return jsonify({
        list: [{ title: '在线资源', tracks: [{ name: '夸克网盘', pan: panUrl }] }]
    });
}
async function init() { return getConfig(); }
async function home() { 
    const config = JSON.parse(await getConfig());
    return jsonify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg) { return jsonify({ list: [] }); } 
async function detail(id) { return getTracks({ id: id }); }
async function play(flag, id) { return jsonify({ url: id }); }
