// 文件名: plugin_funletu.js
// 描述: “趣乐兔”专属前端插件，纯搜索功能 - 最终修复版 (修复多页和转圈问题)

// — 配置区 —
const API_ENDPOINT = “http://192.168.1.7:3005/search”;
const UA = ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36’;
const DEBUG = true;
const SITE_URL = “https://pan.funletu.com”;

// ★★★ 修复1：使用透明的 Base64 图片作为占位图，避免显示蓝色问号 ★★★
const FALLBACK_PIC = “data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=”;

// — 辅助函数 —
function log(msg) {
if (DEBUG) console.log(`[趣乐兔插件] ${msg}`);
}

function argsify(ext) {
return (typeof ext === ‘string’) ? JSON.parse(ext) : (ext || {});
}

function jsonify(data) {
return JSON.stringify(data);
}

// — App 插件入口函数 —

async function getConfig() {
log(”==== 插件初始化 (v1.0) ====”);
return jsonify({
ver: 1.0,
title: ‘趣乐兔搜索’,
site: SITE_URL,
tabs: [{ name: ‘搜索’, ext: {} }],
});
}

// 搜索功能 - 请求我们自己的后端
async function search(ext) {
ext = argsify(ext);
const searchText = ext.text || ‘’;
const page = parseInt(ext.page || 1, 10);

```
// ★★★ 修复2：只允许请求 Page 1，Page > 1 时立即返回空列表以阻止无限翻页和转圈 ★★★
if (page > 1) {
    log(`[search] 收到页码 ${page} 请求，返回空列表以停止翻页和转圈。`);
    return jsonify({ 
        list: [],
        page: page,
        pagecount: 1,
        limit: 0,
        total: 0
    });
}

log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);
if (!searchText) return jsonify({ list: [] });

const encodedKeyword = encodeURIComponent(searchText);
// 注意：尽管后端 API 可能不处理 page 参数，我们仍传递它以匹配前端逻辑
const requestUrl = `${API_ENDPOINT}?keyword=${encodedKeyword}&page=${page}`;
log(`[search] 正在请求自建后端: ${requestUrl}`);

try {
    // 核心：手动解析 JSON 字符串
    const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const response = JSON.parse(jsonString);
    
    if (response.code !== 200) { 
        log(`[search] ❌ 后端服务返回错误: code=${response.code}, msg=${response.msg}`);
        return jsonify({ list: [] });
    }

    const results = response.data?.list; 

    if (!results || !Array.isArray(results)) {
        log(`[search] ❌ 在返回的JSON中找不到 data.list 数组或数组为空`);
        return jsonify({ list: [] });
    }
    
    // 格式化数据为前端要求的卡片结构
    const cards = results.map(item => {
        return {
            vod_id: item.url, 
            vod_name: item.title,
            // ★★★ 修复1：使用透明占位图 ★★★
            vod_pic: FALLBACK_PIC, 
            vod_remarks: item.size || '未知大小', 
            ext: { pan_url: item.url } 
        };
    });

    log(`[search] ✓ 成功获取并格式化 ${cards.length} 个卡片`);
    
    // ★★★ 修复2：返回所有结果，并明确告诉前端这是最后一页 ★★★
    return jsonify({ 
        list: cards,
        total: cards.length,
        page: 1,
        pagecount: 1,
        limit: cards.length
    });

} catch (e) {
    log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
    return jsonify({ list: [] });
}
```

}

// 获取网盘链接 (资源详情)
async function getTracks(ext) {
ext = argsify(ext);
const panUrl = ext.pan_url || ext.id;

```
log(`[getTracks] 提取网盘链接: ${panUrl}`);

if (!panUrl) {
    log('[getTracks] ❌ 链接为空，无法返回 tracks');
    return jsonify({ list: [] });
}

return jsonify({
    list: [{
        title: '在线资源',
        tracks: [{ 
            name: '夸克网盘', 
            pan: panUrl 
        }]
    }]
});
```

}

// — 兼容接口 (保持原样) —
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
