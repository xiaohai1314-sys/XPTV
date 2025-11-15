// 文件名: plugin_funletu.js
// 描述: “趣乐兔”专属前端插件 - 完整修复版
// 修复：1.占位图问题 2.转圈问题 3.多页请求问题

// — 配置区 —
const API_ENDPOINT = “http://192.168.1.7:3005/search”;
const UA = ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36’;
const DEBUG = true;
const SITE_URL = “https://pan.funletu.com”;

// ★★★ 修复1：使用 Base64 编码的透明 1x1 像素图片作为占位图 ★★★
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
log(”==== 插件初始化 (v1.1-修复版) ====”);
return jsonify({
ver: 1.1,
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
// ★★★ 修复3：只允许第一页，后续页直接返回空 ★★★
if (page > 1) {
    log(`[search] 拦截页码 ${page} 请求，返回空列表`);
    return jsonify({ 
        list: [],
        page: page,
        pagecount: 1,  // 明确告知只有1页
        limit: 0,
        total: 0
    });
}

log(`[search] 搜索关键词: "${searchText}", 页码: ${page}`);
if (!searchText) return jsonify({ list: [], pagecount: 1 });

const encodedKeyword = encodeURIComponent(searchText);
const requestUrl = `${API_ENDPOINT}?keyword=${encodedKeyword}&page=${page}`;
log(`[search] 正在请求自建后端: ${requestUrl}`);

try {
    const { data: jsonString } = await $fetch.get(requestUrl, { headers: { 'User-Agent': UA } });
    const response = JSON.parse(jsonString);
    
    if (response.code !== 200) { 
        log(`[search] ❌ 后端服务返回错误: code=${response.code}, msg=${response.msg}`);
        return jsonify({ list: [], pagecount: 1 });
    }

    const results = response.data?.list; 

    if (!results || !Array.isArray(results)) {
        log(`[search] ❌ 在返回的JSON中找不到 data.list 数组或数组为空`);
        return jsonify({ list: [], pagecount: 1 });
    }
    
    // 格式化数据为前端要求的卡片结构
    const cards = results.map(item => {
        return {
            vod_id: item.url, 
            vod_name: item.title,
            vod_pic: FALLBACK_PIC,  // 使用透明占位图
            vod_remarks: item.size || '未知大小', 
            ext: { pan_url: item.url } 
        };
    });

    log(`[search] ✓ 成功获取并格式化 ${cards.length} 个卡片`);
    
    // ★★★ 修复3：明确返回分页信息，防止自动请求下一页 ★★★
    return jsonify({ 
        list: cards,
        page: 1,
        pagecount: 1,      // 关键：明确只有1页
        limit: cards.length,
        total: cards.length
    });

} catch (e) {
    log(`[search] ❌ 请求或解析时发生异常: ${e.message}`);
    return jsonify({ list: [], pagecount: 1 });
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

// — 兼容接口 —
async function init() {
return getConfig();
}

// ★★★ 修复2：home() 返回有效的默认分类，避免转圈 ★★★
async function home() {
log(’[home] 返回默认分类’);
return jsonify({
class: [
{ type_id: ‘search’, type_name: ‘搜索’ }
],
filters: {}
});
}

async function category(tid, pg) {
log(`[category] tid=${tid}, pg=${pg} - 返回空列表`);
return jsonify({
list: [],
page: pg,
pagecount: 1,
limit: 0,
total: 0
});
}

async function detail(id) {
return getTracks({ id: id });
}

async function play(flag, id) {
return jsonify({ url: id });
}
