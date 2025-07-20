// ================== Gying 插件 for XPTV App - V24-兼容修复版 ==================
// 版本: v24-compat-fix
// 修复内容: 
// 1. 【核心修复】重写插件接口，完全兼容只支持 (tid, pg) 参数的旧版App规范。
// 2. 【核心修复】确保分类ID (tid) 能被正确接收并传递给后端，解决 id=undefined 问题。
// 3. 【功能保留】完整保留V23版本的详情页筛选、资源缓存等全部高级功能。
// 4. 【代码整合】将所有业务逻辑集中到核心函数，兼容接口只负责调用。
// ========================================================================

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】您的局域网后端地址
const PLUGIN_NAME = 'Gying观影';
const PLUGIN_VERSION = 'v24-compat-fix';

// --- 全局状态管理 (用于筛选逻辑) ---
let fullResourceCache = [];
let currentPanTypeFilter = 'all';
let currentKeywordFilter = 'all';

// --- 工具函数 ---
function log(message) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[${PLUGIN_NAME}] ${message}`);
  }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    let response;
    if (typeof $fetch !== 'undefined') {
      const res = await $fetch.get(url, { headers: { 'Accept': 'application/json' }, timeout: 30000 });
      if (res.status !== 200) throw new Error(`HTTP错误! 状态: ${res.status}`);
      response = JSON.parse(res.data);
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP错误! 状态: ${res.status}`);
      response = await res.json();
    }
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
      return JSON.stringify({ list: [], hasMore: false });
  }
  
  let apiUrl;
  if (keyword) {
    apiUrl = `${API_BASE_URL}/search?wd=${encodeURIComponent(keyword)}&page=${page}`; // 【关键修改】使用 'wd' 参数匹配后端
  } else {
    apiUrl = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  }
  
  const data = await request(apiUrl);
  
  if (data.error || !data.list) {
    return JSON.stringify({ list: [], hasMore: false });
  }
  
  const cards = data.list.map(item => ({
    id: String(item.vod_id),
    name: String(item.vod_name),
    pic: String(item.vod_pic),
    remarks: String(item.vod_remarks || ''),
  }));
  
  return JSON.stringify({
    list: cards,
    hasMore: cards.length >= 20,
  });
}

// 核心获取详情与筛选函数
async function doTracksLogic(vod_id) {
    log(`核心逻辑: 获取详情 - vod_id=${vod_id}`);
    // 清空缓存，为新影片做准备
    fullResourceCache = [];
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';

    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(vod_id)}`; // 【关键修改】使用 'ids' 参数匹配后端
    const data = await request(detailUrl);

    if (data.error || !data.list || data.list.length === 0) {
        return JSON.stringify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }

    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return JSON.stringify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
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

    return JSON.stringify(result);
}


// --- App 兼容接口层 ---
// App会调用这里的函数，我们再转去调用核心逻辑函数

async function init() {
    log(`插件初始化: ${PLUGIN_NAME} ${PLUGIN_VERSION}`);
    const config = {
        name: PLUGIN_NAME,
        version: PLUGIN_VERSION,
        author: 'Gying Team',
        description: '观影网站资源聚合插件 - 兼容修复版',
        tabs: [
            { name: '剧集', ext: { id: 'tv' } },
            { name: '电影', ext: { id: 'mv' } },
            { name: '动漫', ext: { id: 'ac' } },
        ],
        supportSearch: true,
        supportDetail: true
    };
    return JSON.stringify(config);
}

async function home() {
    // 旧版App的home通常是返回分类列表
    log("兼容接口: home() 被调用, 返回分类列表");
    const config = JSON.parse(await init());
    return JSON.stringify({ class: config.tabs, filters: {} });
}

async function category(tid, pg) {
    // 【核心兼容点】使用 (tid, pg) 参数
    log(`兼容接口: category(tid, pg) 被调用 - tid=${tid}, pg=${pg}`);
    // 旧版App的tid可能直接就是我们需要的id，比如'tv'
    return doCardsLogic(tid, pg);
}

async function detail(id) {
    // 【核心兼容点】这里的id是影片ID
    log(`兼容接口: detail(id) 被调用 - id=${id}`);
    return doTracksLogic(id);
}

async function search(wd, quick) {
    // 【核心兼容点】使用 (wd) 参数
    log(`兼容接口: search(wd) 被调用 - wd=${wd}`);
    return doCardsLogic(null, 1, wd);
}

async function play(flag, id, flags) {
    log(`兼容接口: play() 被调用 - id=${id}`);
    if (id.startsWith('filter://')) {
        const params = new URLSearchParams(id.replace('filter://', ''));
        if (params.has('pan_type')) currentPanTypeFilter = params.get('pan_type');
        if (params.has('keyword')) currentKeywordFilter = params.get('keyword');
        
        // 刷新指令对于旧版App可能无效，但我们依然返回
        // 更好的做法是，如果筛选功能不工作，需要进一步适配
        return JSON.stringify({ url: '', refresh: true, message: '筛选已更新' });
    }
    return JSON.stringify({ url: id });
}

