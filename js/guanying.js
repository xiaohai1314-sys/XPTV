/**
 * Gying 插件 for XPTV App (最终适配版 v9)
 *
 * --- 版本说明 ---
 * v9:
 * - 完美融合了 "Gying 后端代理服务 (最终融合版)" 的功能与 "XPTV App (v3)" 的前端框架。
 * - 核心功能: 实现了详情页内"钻取式"的两级筛选。
 * - API 适配:
 *   - 分类接口调用 `/api/vod`，使用参数 `id`。
 *   - 搜索接口调用 `/api/search`，使用参数 `wd`。
 *   - 详情接口调用 `/api/detail`，使用参数 `ids`。
 * - 数据解析: 重写了详情页资源解析逻辑，以处理后端返回的 `标题$链接#标题$链接` 格式，并智能推断网盘类型。
 * - 兼容性: 完全兼容 XPTV App 的 `detail(id)` 和 `play(flag, id)` 调用机制，通过拦截自定义指令实现UI刷新。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请务必替换为你的后端服务实际地址
const PAN_TYPE_MAP = { '0': '百度', '1': '迅雷', '2': '夸克', '3': '阿里', '4': '天翼', '5': '115', '6': 'UC', 'unknown': '其他' };
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
// --- 配置区 ---

// --- 缓存区 (用于实现筛选功能) ---
let fullResourceCache = []; // 缓存当前影片的全部资源
let currentPanTypeFilter = 'all'; // 当前网盘类型筛选状态
let currentKeywordFilter = 'all'; // 当前关键字筛选状态

// --- XPTV App 环境函数 (做了兼容处理，可在浏览器或App中运行) ---
function log(msg) {
  const logMsg = `[Gying插件] ${msg}`;
  try {
    $log(logMsg);
  } catch (_) {
    console.log(logMsg);
  }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    let response;
    if (typeof $fetch !== 'undefined') {
      // 在 XPTV App 环境中
      const res = await $fetch.get(url, { timeout: 30000 });
      if (res.status !== 200) throw new Error(`HTTP错误! 状态: ${res.status}`);
      response = JSON.parse(res.data);
    } else {
      // 在浏览器等标准环境中
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

// --- 插件核心函数 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  return JSON.stringify({
    ver: 1,
    title: 'Gying', // 插件名称
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '剧集', ext: { id: 'tv' } },
      { name: '电影', ext: { id: 'mv' } },
      { name: '动漫', ext: { id: 'ac' } },
    ],
  });
}

async function getCards(ext) {
  const { id, page = 1 } = JSON.parse(JSON.stringify(ext));
  if (!id) return JSON.stringify({ list: [] });

  log(`获取分类: id=${id}, page=${page}`);
  const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  const data = await request(url);

  if (data.error) return JSON.stringify({ list: [] });

  // 适配App的ext结构，为detail调用做准备
  data.list = data.list.map(item => ({ ...item, ext: { url: item.vod_id } }));
  return JSON.stringify(data);
}

async function search(ext) {
  const { text } = JSON.parse(JSON.stringify(ext));
  if (!text) return JSON.stringify({ list: [] });

  log(`执行搜索: wd=${text}`);
  const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
  const data = await request(url);

  if (data.error) return JSON.stringify({ list: [] });
  
  data.list = data.list.map(item => ({ ...item, ext: { url: item.vod_id } }));
  return JSON.stringify(data);
}

/**
 * 获取详情 - 【核心】实现钻取式两级筛选
 */
async function getTracks(ext) {
  const { url, pan_type, keyword, action } = JSON.parse(JSON.stringify(ext));

  // 步骤1: 数据获取与缓存 (仅在首次加载时执行)
  if (action === 'init' || fullResourceCache.length === 0) {
    log(`首次加载详情: url=${url}`);
    const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(url)}`;
    const data = await request(detailUrl);
    
    if (data.error || !data.list || data.list.length === 0) {
      return JSON.stringify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return JSON.stringify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }

    // 【关键】解析后端数据并存入缓存
    const inferPanType = (title) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('阿里')) return '3';
        if (lowerTitle.includes('夸克')) return '2';
        if (lowerTitle.includes('百度')) return '0';
        if (lowerTitle.includes('迅雷')) return '1';
        if (lowerTitle.includes('天翼')) return '4';
        if (lowerTitle.includes('115')) return '5';
        if (lowerTitle.includes('uc')) return '6';
        return 'unknown';
    };

    fullResourceCache = playUrlString.split('#').map(item => {
        const parts = item.split('$');
        if (parts.length < 2) return null;
        return { type: inferPanType(parts[0]), title: parts[0], link: parts[1] };
    }).filter(Boolean);

    log(`解析完成，缓存了 ${fullResourceCache.length} 条资源`);
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';
  }

  // 步骤2: 处理用户筛选操作，更新状态
  if (action === 'filter') {
    if (pan_type) currentPanTypeFilter = pan_type;
    if (keyword) currentKeywordFilter = keyword;
    log(`筛选状态更新: 网盘=${currentPanTypeFilter}, 关键字=${currentKeywordFilter}`);
  }

  // 步骤3: 根据当前状态筛选资源
  let resourcesToShow = [...fullResourceCache];
  if (currentPanTypeFilter !== 'all') {
    resourcesToShow = resourcesToShow.filter(r => r.type === currentPanTypeFilter);
  }
  if (currentKeywordFilter !== 'all') {
    const lowerKeyword = currentKeywordFilter.toLowerCase();
    if (lowerKeyword === '其他') {
        resourcesToShow = resourcesToShow.filter(r => KEYWORD_FILTERS.slice(0, -1).every(kw => !r.title.toLowerCase().includes(kw.toLowerCase())));
    } else {
        resourcesToShow = resourcesToShow.filter(r => r.title.toLowerCase().includes(lowerKeyword));
    }
  }

  // 步骤4: 构建UI界面（按钮 + 资源列表）
  const resultLists = [];
  
  // 第一行：网盘分类按钮
  const panTypeCounts = fullResourceCache.reduce((acc, r) => ({ ...acc, [r.type]: (acc[r.type] || 0) + 1 }), {});
  const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all` }];
  Object.keys(panTypeCounts).sort().forEach(typeCode => {
      panTypeButtons.push({ name: `${PAN_TYPE_MAP[typeCode]} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}` });
  });
  resultLists.push({ title: '网盘分类', tracks: panTypeButtons });

  // 第二行：关键字筛选按钮
  const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all` }];
  KEYWORD_FILTERS.forEach(kw => {
      keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}` });
  });
  resultLists.push({ title: '关键字筛选', tracks: keywordButtons });

  // 第三行：最终资源列表
  const resourceTracks = resourcesToShow.length > 0
    ? resourcesToShow.map(r => ({ name: `[${PAN_TYPE_MAP[r.type]}] ${r.title}`, pan: r.link }))
    : [{ name: '在当前筛选条件下无结果', pan: '' }];
  resultLists.push({ title: `资源列表 (${resourcesToShow.length})`, tracks: resourceTracks });

  return JSON.stringify({ list: resultLists });
}

// --- XPTV App 兼容层 ---
async function init() { return getConfig(); }

async function home() { 
  const c = await getConfig(); 
  return JSON.stringify({ class: JSON.parse(c).tabs, filters: {} }); 
}

async function category(tid, pg) { 
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id, page: pg }); 
}

// App点击卡片时调用此函数
async function detail(id) { 
    fullResourceCache = []; // 关键：进入新影片时清空旧缓存
    // 首次加载，必须带上 action=init
    return getTracks({ url: id, action: 'init' }); 
}

// App点击筛选按钮或资源链接时调用此函数
async function play(flag, id) {
    if (id.startsWith('custom:')) {
        // 拦截自定义指令，重新调用 getTracks 刷新UI
        const params = new URLSearchParams(id.replace('custom:', ''));
        const ext = Object.fromEntries(params.entries());
        return getTracks(ext);
    }
    // 否则是普通链接，直接返回给App播放
    return JSON.stringify({ url: id });
}

log('Gying插件加载完成 (最终适配版 v9)');


