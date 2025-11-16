// — 配置区 —
const MY_BACKEND_URL = “http://192.168.1.7:3003/api”;
const POSTER_BASE_URL = “https://image.tmdb.org/t/p/w500”;
const FALLBACK_PIC = ‘https://img.tukuppt.com/png_preview/00/42/01/P5kFr2sEwJ.jpg’;

// — 调试日志收集器 —
const debugLogs = [];
function log(msg) {
const logMsg = `[${new Date().toLocaleTimeString()}] ${msg}`;
console.log(logMsg);
debugLogs.push(logMsg);
if (debugLogs.length > 50) debugLogs.shift();
}

// — 辅助函数 —
function jsonify(data) { return JSON.stringify(data); }

// — 分类映射表 —
const CATEGORY_MAP = {
‘1’: { name: ‘IMDb-热门电影’, listId: 2142788 },
‘2’: { name: ‘IMDb-热门剧集’, listId: 2143362 },
‘3’: { name: ‘IMDb-高分电影’, listId: 2142753 },
‘4’: { name: ‘IMDb-高分剧集’, listId: 2143363 },
‘debug’: { name: ‘🐛调试日志’, debug: true }
};

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
    log(`[${context}] 收到响应，类型: ${typeof response}`);
    
    const data = response.data || response;
    
    if (!data.items || !Array.isArray(data.items)) {
        log(`[${context}] 错误: 无items数组，keys: ${Object.keys(data).join(',')}`);
        return jsonify({ list: [] });
    }

    log(`[${context}] 找到 ${data.items.length} 项`);
    
    const cards = data.items.map(item => ({
        vod_id: jsonify({ tmdbid: item.tmdbid, type: item.media_type }),
        vod_name: item.title || '未知',
        vod_pic: item.poster ? `${POSTER_BASE_URL}${item.poster}` : FALLBACK_PIC,
        vod_remarks: item.release_date || (item.vote_average ? `${item.vote_average.toFixed(1)}分` : ''),
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
const cards = [];

```
// 添加测试按钮
cards.push({
    vod_id: 'test_category',
    vod_name: '📋 测试：加载分类数据',
    vod_pic: FALLBACK_PIC,
    vod_remarks: '点击测试',
});

cards.push({
    vod_id: 'test_search',
    vod_name: '🔍 测试：搜索"黄飞鸿"',
    vod_pic: FALLBACK_PIC,
    vod_remarks: '点击测试',
});

// 添加日志
debugLogs.forEach((logMsg, index) => {
    cards.push({
        vod_id: `debug_${index}`,
        vod_name: logMsg,
        vod_pic: FALLBACK_PIC,
        vod_remarks: '',
    });
});

return jsonify({ list: cards });
```

}

// — APP 插件入口函数 —

async function init(cfg) {
log(”==== 插件初始化 V6.3 (调试版) ====”);
return jsonify({});
}

async function home(filter) {
log(”[home] 被调用”);

```
const classes = [];
for (let id in CATEGORY_MAP) {
    classes.push({
        type_id: id,
        type_name: CATEGORY_MAP[id].name
    });
}

log(`[home] 返回 ${classes.length} 个分类: ${classes.map(c => c.type_name).join(', ')}`);

return jsonify({ 
    class: classes,
    filters: {} 
});
```

}

async function category(tid, pg, filter, extend) {
log(`[category] 被调用 - tid="${tid}", pg="${pg}"`);

```
const catInfo = CATEGORY_MAP[String(tid)];

if (!catInfo) {
    log(`[category] 未找到分类: ${tid}`);
    return jsonify({ list: [] });
}

log(`[category] 分类: ${catInfo.name}`);

// 特殊处理：调试分类
if (catInfo.debug) {
    return getDebugCards();
}

// 特殊处理：测试按钮（从详情页点进来的）
if (tid === 'test_category_action') {
    log('[Test] 执行测试分类请求');
    await getCards({ listId: 2142788, page: 1 });
    return getDebugCards();
}

log(`[category] listId=${catInfo.listId}, page=${pg || 1}`);
return getCards({ listId: catInfo.listId, page: pg || 1 });
```

}

async function search(wd, quick, pg) {
log(`[search] 被调用`);
log(`[search] 参数wd类型="${typeof wd}", 值="${String(wd).substring(0, 100)}"`);
log(`[search] 参数quick="${quick}", pg="${pg}"`);

```
let keyword = '';
let page = 1;

// 多种参数解析方式
if (typeof wd === 'string' && wd && wd !== 'undefined') {
    try {
        const parsed = JSON.parse(wd);
        keyword = parsed.wd || parsed.text || parsed.keyword || '';
        page = parseInt(parsed.pg || parsed.page || 1, 10);
        log(`[search] JSON解析成功: keyword="${keyword}"`);
    } catch (e) {
        keyword = wd;
        page = parseInt(pg || 1, 10);
        log(`[search] 直接使用字符串: keyword="${keyword}"`);
    }
} else if (typeof wd === 'object' && wd) {
    keyword = wd.wd || wd.text || wd.keyword || '';
    page = parseInt(wd.pg || wd.page || 1, 10);
    log(`[search] 对象解析: keyword="${keyword}"`);
}

if (page > 1) {
    log(`[search] 页码>1，返回空列表`);
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
log(`[detail] 被调用 - id="${id}"`);

```
// 特殊处理：测试按钮
if (id === 'test_category') {
    log('[Test] 执行分类测试');
    await getCards({ listId: 2142788, page: 1 });
    // 返回一个假的详情，让用户点返回后去看调试日志
    return jsonify({
        list: [{
            vod_play_from: '测试完成',
            vod_play_url: '返回查看调试日志$https://example.com'
        }]
    });
}

if (id === 'test_search') {
    log('[Test] 执行搜索测试');
    await getCards({ keyword: '黄飞鸿' });
    return jsonify({
        list: [{
            vod_play_from: '测试完成',
            vod_play_url: '返回查看调试日志$https://example.com'
        }]
    });
}

// 调试日志条目
if (String(id).startsWith('debug_')) {
    return jsonify({
        list: [{
            vod_play_from: '调试信息',
            vod_play_url: '这是日志记录$https://example.com'
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
    log(`[detail] 请求资源: ${requestUrl}`);
    
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
log(`[play] 被调用 - url="${id}"`);
return jsonify({
parse: 0,
url: id
});
}
