// — 配置区 —
const MY_BACKEND_URL = “http://192.168.1.7:3003/api”;
const POSTER_BASE_URL = “https://image.tmdb.org/t/p/w500”;
const FALLBACK_PIC = ‘https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg’;
const DEBUG = true;

// — 调试日志收集器 —
const debugLogs = [];
function log(msg) {
const logMsg = `[${new Date().toLocaleTimeString()}] ${msg}`;
console.log(logMsg);
debugLogs.push(logMsg);
// 只保留最近50条日志
if (debugLogs.length > 50) debugLogs.shift();
}

// — 辅助函数 —
function argsify(ext) { return (typeof ext === ‘string’) ? JSON.parse(ext) : (ext || {}); }
function jsonify(data) { return JSON.stringify(data); }

// — 分类配置 —
const CATEGORIES = [
{ type_id: ‘1’, type_name: ‘IMDb-热门电影’, ext: jsonify({ listId: 2142788 }) },
{ type_id: ‘2’, type_name: ‘IMDb-热门剧集’, ext: jsonify({ listId: 2143362 }) },
{ type_id: ‘3’, type_name: ‘IMDb-高分电影’, ext: jsonify({ listId: 2142753 }) },
{ type_id: ‘4’, type_name: ‘IMDb-高分剧集’, ext: jsonify({ listId: 2143363 }) },
{ type_id: ‘debug’, type_name: ‘🐛调试日志’, ext: jsonify({ debug: true }) }
];

// — 核心数据获取函数 —
async function getCards(params) {
let requestUrl;
let context;

```
if (params.listId) {
    context = 'Category';
    requestUrl = `${MY_BACKEND_URL}/list?id=${params.listId}&page=${params.page || 1}`;
} else if (params.keyword) {
    context = 'Search';
    requestUrl = `${MY_BACKEND_URL}/search?keyword=${encodeURIComponent(params.keyword)}`;
} else {
    log(`[getCards] 参数不足`);
    return jsonify({ list: [] });
}

log(`[${context}] 请求: ${requestUrl}`);

try {
    const response = await $fetch.get(requestUrl);
    log(`[${context}] 收到响应`);
    
    const data = response.data || response;
    
    if (!data.items || !Array.isArray(data.items)) {
        log(`[${context}] 错误: 无items数组`);
        return jsonify({ list: [] });
    }

    log(`[${context}] 找到 ${data.items.length} 项`);
    
    const cards = data.items.map(item => ({
        vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
        vod_name: item.title || '未知',
        vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
        vod_remarks: item.release_date || '',
    }));

    log(`[${context}] 成功返回 ${cards.length} 个卡片`);
    return jsonify({ list: cards });

} catch (e) {
    log(`[${context}] 异常: ${e.message}`);
    return jsonify({ list: [] });
}
```

}

// — 生成调试卡片 —
function getDebugCards() {
log(’[Debug] 生成调试卡片’);
const cards = debugLogs.map((logMsg, index) => ({
vod_id: `debug_${index}`,
vod_name: logMsg,
vod_pic: FALLBACK_PIC,
vod_remarks: ‘’,
}));

```
// 添加一个测试请求按钮
cards.unshift({
    vod_id: 'test_search',
    vod_name: '🔍 点击测试搜索"黄飞鸿"',
    vod_pic: FALLBACK_PIC,
    vod_remarks: '调试用',
});

cards.unshift({
    vod_id: 'test_category',
    vod_name: '📋 点击测试分类加载',
    vod_pic: FALLBACK_PIC,
    vod_remarks: '调试用',
});

return jsonify({ list: cards });
```

}

// — APP 插件入口函数 —

async function init() {
log(”==== 插件初始化 V6.2 (调试版) ====”);
return jsonify({
ver: 6.2,
title: ‘影视聚合(调试)’,
site: MY_BACKEND_URL,
});
}

async function home() {
log(”[home] 返回分类列表”);
return jsonify({
class: CATEGORIES,
filters: {}
});
}

async function category(tid, pg, filter, extend) {
log(`[category] tid=${tid}, pg=${pg}`);

```
// 特殊处理：调试分类
if (String(tid) === 'debug') {
    return getDebugCards();
}

// 特殊处理：测试按钮
if (String(tid) === 'test_category') {
    log('[Test] 执行测试分类请求');
    await getCards({ listId: 2142788, page: 1 });
    return getDebugCards();
}

const categoryConfig = CATEGORIES.find(cat => cat.type_id === String(tid));

if (!categoryConfig) {
    log(`[category] 未找到分类: ${tid}`);
    return jsonify({ list: [] });
}

const ext = argsify(categoryConfig.ext);
const listId = ext.listId;

log(`[category] 分类=${categoryConfig.type_name}, listId=${listId}`);
return getCards({ listId: listId, page: pg || 1 });
```

}

async function search(wd, quick, pg) {
log(`[search] 收到调用`);
log(`[search] 参数1类型=${typeof wd}, 值="${JSON.stringify(wd).substring(0, 50)}"`);
log(`[search] 参数2=${quick}, 参数3=${pg}`);

```
// 特殊处理：测试按钮
if (wd === 'test_search') {
    log('[Test] 执行测试搜索');
    await getCards({ keyword: '黄飞鸿' });
    return getDebugCards();
}

let keyword = '';
let page = 1;

// 尝试多种参数解析方式
if (typeof wd === 'string' && wd && wd !== 'undefined') {
    // 尝试解析为JSON
    try {
        const parsed = JSON.parse(wd);
        keyword = parsed.wd || parsed.text || parsed.keyword || '';
        page = parseInt(parsed.pg || parsed.page || 1, 10);
        log(`[search] JSON解析: keyword="${keyword}"`);
    } catch (e) {
        // 不是JSON，就当作直接的关键词
        keyword = wd;
        page = parseInt(pg || 1, 10);
        log(`[search] 直接字符串: keyword="${keyword}"`);
    }
} else if (typeof wd === 'object' && wd) {
    keyword = wd.wd || wd.text || wd.keyword || '';
    page = parseInt(wd.pg || wd.page || 1, 10);
    log(`[search] 对象解析: keyword="${keyword}"`);
}

if (page > 1) {
    log(`[search] 页码>1，停止加载`);
    return jsonify({ list: [] });
}

if (!keyword) {
    log(`[search] 关键词为空！`);
    return jsonify({ list: [] });
}

log(`[search] 开始搜索: "${keyword}"`);
return getCards({ keyword: keyword });
```

}

async function detail(id) {
log(`[detail] vod_id=${id}`);

```
// 特殊处理：调试条目
if (String(id).startsWith('debug_') || id === 'test_search' || id === 'test_category') {
    return jsonify({
        list: [{
            vod_play_from: '调试信息',
            vod_play_url: '这是调试日志$https://example.com'
        }]
    });
}

try {
    const { tmdbid, type } = JSON.parse(id);
    
    if (!tmdbid || !type) {
        log(`[detail] vod_id格式错误`);
        return jsonify({ list: [] });
    }

    const requestUrl = `${MY_BACKEND_URL}/resource?tmdbid=${tmdbid}&type=${type}`;
    log(`[detail] 请求: ${requestUrl}`);
    
    const response = await $fetch.get(requestUrl);
    const data = response.data || response;
    
    if (!data['115'] || !Array.isArray(data['115'])) {
        log(`[detail] 无115资源`);
        return jsonify({ list: [] });
    }

    const tracks = data['115'].map(item => ({
        name: `[115] ${item.title} (${item.size})`,
        pan: item.share_link,
    }));

    log(`[detail] 找到 ${tracks.length} 个资源`);
    
    return jsonify({
        list: [{
            vod_play_from: '115网盘',
            vod_play_url: tracks.map(t => `${t.name}$${t.pan}`).join('#')
        }]
    });

} catch (e) {
    log(`[detail] 异常: ${e.message}`);
    return jsonify({ list: [] });
}
```

}

async function play(flag, id, flags) {
log(`[play] url=${id}`);
return jsonify({
parse: 0,
url: id
});
}
