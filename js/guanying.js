// ================== Gying 插件 for XPTV App - V25-App完全兼容版 ==================
// 版本: v25-app-compat
// 修复内容: 
// 1. 【核心修复】完全适配App的插件加载规范，包括 `getConfig()` 入口和 `appConfig` 结构。
// 2. 【核心修复】引入 `jsonify()` 和 `argsify()` 辅助函数，确保App环境兼容性。
// 3. 【功能保留】完整保留V24兼容版的所有功能，包括详情页筛选、资源缓存等。
// ========================================================================

// --- App环境预定义函数 (从网盘资源社插件中提取) ---
// 假设App环境提供了 $fetch, createCheerio, $log

// 辅助函数：将JS对象转换为JSON字符串，并确保App能正确处理
function jsonify(obj) {
  return JSON.stringify(obj);
}

// 辅助函数：解析App传递的参数，确保兼容性
function argsify(ext) {
  if (typeof ext === 'string') {
    try {
      return JSON.parse(ext);
    } catch (e) {
      // 如果是字符串但不是JSON，则尝试作为ID处理
      return { id: ext };
    }
  } else if (typeof ext === 'object' && ext !== null) {
    return ext;
  }
  return {};
}

// --- 插件配置 (适配App的appConfig结构) ---
const appConfig = {
  ver: 1,
  title: 'Gying观影',
  site: 'http://192.168.1.6:3001/api', // 【重要】您的局域网后端API基地址
  cookie: '', // 此处不需要cookie，但保留结构以兼容App
  tabs: [
    {
      name: '剧集',
      ext: { id: 'tv' },
    },
    {
      name: '电影',
      ext: { id: 'mv' },
    },
    {
      name: '动漫',
      ext: { id: 'ac' },
    },
  ],
  supportSearch: true,
  supportDetail: true
};

// --- 全局状态管理 (用于筛选逻辑) ---
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';

// --- 工具函数 ---
function log(msg) {
  try { $log(`[${appConfig.title}] ${msg}`); } catch (_) {
    // 如果 $log 不存在，退回到 console.log
    if (typeof console !== 'undefined' && console.log) {
      console.log(`[${appConfig.title}] ${msg}`);
    }
  }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    let response;
    // 假设App环境提供了 $fetch
    const res = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });

    if (res.status !== 200) throw new Error(`HTTP错误! 状态: ${res.status}`);
    response = JSON.parse(res.data);
    
    if (response.error) throw new Error(`API返回错误: ${response.error}`);
    log(`请求成功, 收到 ${response.list?.length || 0} 条数据`);
    return response;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

// --- 核心业务逻辑函数 (内部使用) ---

// 核心获取卡片列表函数
async function doCardsLogic(id, page = 1, keyword = '') {
  log(`核心逻辑: 获取卡片 - id=${id}, page=${page}, keyword=${keyword}`);
  if (!id && !keyword) {
      log("错误: ID和关键字均为空，无法获取卡片。");
      return { list: [], hasMore: false };
  }
  
  let apiUrl;
  if (keyword) {
    apiUrl = `${appConfig.site}/search?wd=${encodeURIComponent(keyword)}&page=${page}`;
  } else {
    apiUrl = `${appConfig.site}/vod?id=${id}&page=${page}`;
  }
  
  const data = await request(apiUrl);
  
  if (data.error || !data.list) {
    return { list: [], hasMore: false };
  }
  
  const cards = data.list.map(item => ({
    id: String(item.vod_id),
    name: String(item.vod_name),
    pic: String(item.vod_pic),
    remarks: String(item.vod_remarks || ''),
  }));
  
  return { list: cards, hasMore: cards.length >= 20 };
}

// 核心获取详情与筛选函数
async function doTracksLogic(vod_id) {
    log(`核心逻辑: 获取详情 - vod_id=${vod_id}`);
    // 清空缓存，为新影片做准备
    fullResourceCache = [];
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';

    const detailUrl = `${appConfig.site}/detail?ids=${encodeURIComponent(vod_id)}`;
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0) {
        return { list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] };
    }

    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return { list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] };
    }

    // 解析并缓存所有资源
    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (parts.length < 2) return null;
        const title = parts[0];
        const link = parts[1];
        const inferPanType = (t) => {
            const lt = t.toLowerCase();
            if (lt.includes('阿里')) return '阿里'; if (lt.includes('夸克')) return '夸克'; if (lt.includes('百度')) return '百度';
            if (lt.includes('迅雷')) return '迅雷'; if (lt.includes('天翼')) return '天翼'; if (lt.includes('115')) return '115';
            return '其他';
        };
        const panType = inferPanType(title);
        return { title, link, panType, displayName: `[${panType}] ${title}` };
    }).filter(Boolean);

    return filterAndBuildTracks();
}

// 内部函数：根据当前筛选条件构建返回给App的列表
function filterAndBuildTracks() {
    let filteredResources = [...fullResourceCache];
    if (currentPanTypeFilter !== 'all') {
        filteredResources = filteredResources.filter(r => r.panType === currentPanTypeFilter);
    }
    if (currentKeywordFilter !== 'all') {
        filteredResources = filteredResources.filter(r => r.title.includes(currentKeywordFilter));
    }

    const result = { list: [] };
    const panTypes = ['all', ...new Set(fullResourceCache.map(r => r.panType))];
    result.list.push({
        title: '网盘分类',
        tracks: panTypes.map(type => ({
            name: `${type} (${type === 'all' ? fullResourceCache.length : fullResourceCache.filter(r => r.panType === type).length})`,
            pan: `filter://pan_type=${type}`
        }))
    });

    const keywords = ['all', '4K', '1080P', '蓝光', '超清', '国语'];
    result.list.push({
        title: '关键字筛选',
        tracks: keywords.map(kw => ({
            name: `${kw} (${kw === 'all' ? fullResourceCache.length : fullResourceCache.filter(r => r.title.includes(kw)).length})`,
            pan: `filter://keyword=${kw}`
        }))
    });

    const resourceTracks = filteredResources.map(r => ({ name: r.displayName, pan: r.link }));
    result.list.push({
        title: `资源列表 (${resourceTracks.length})`,
        tracks: resourceTracks.length > 0 ? resourceTracks : [{ name: '无匹配资源', pan: '' }]
    });

    return result;
}

// --- App 兼容接口层 (与网盘资源社插件保持一致) ---

// App的入口函数，返回插件配置
async function getConfig() {
  log(`插件初始化: ${appConfig.title}`);
  return jsonify(appConfig);
}

// App调用首页数据
async function home() {
    log("兼容接口: home() 被调用");
    // App的home()通常会返回分类列表，这里直接调用doCardsLogic获取默认分类
    const cardsResult = await doCardsLogic(appConfig.tabs[0].ext.id, 1); // 默认加载第一个分类
    return jsonify({ list: cardsResult.list, hasMore: cardsResult.hasMore });
}

// App调用分类列表数据
async function category(ext) {
    ext = argsify(ext);
    const { id, page = 1 } = ext;
    log(`兼容接口: category(ext) 被调用 - id=${id}, page=${page}`);
    const cardsResult = await doCardsLogic(id, page);
    return jsonify({ list: cardsResult.list, hasMore: cardsResult.hasMore });
}

// App调用详情页数据
async function detail(ext) {
    ext = argsify(ext);
    const { id } = ext; // App可能传递 {id: 'vod_id'} 或直接 'vod_id'
    log(`兼容接口: detail(ext) 被调用 - id=${id}`);
    const tracksResult = await doTracksLogic(id);
    return jsonify(tracksResult);
}

// App调用搜索数据
async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = Math.max(1, parseInt(ext.page) || 1);
    log(`兼容接口: search(ext) 被调用 - text=${text}, page=${page}`);
    const cardsResult = await doCardsLogic(null, page, text);
    return jsonify({ list: cardsResult.list, hasMore: cardsResult.hasMore });
}

// App调用播放链接或筛选指令
async function play(flag, id, flags) {
    log(`兼容接口: play() 被调用 - id=${id}`);
    if (id.startsWith('filter://')) {
        const params = new URLSearchParams(id.replace('filter://', ''));
        if (params.has('pan_type')) currentPanTypeFilter = params.get('pan_type');
        if (params.has('keyword')) currentKeywordFilter = params.get('keyword');
        
        // 重新构建并返回筛选后的资源列表
        const filteredTracks = filterAndBuildTracks();
        return jsonify({ list: filteredTracks.list, refresh: true, message: '筛选已更新' });
    }
    return jsonify({ url: id });
}


