// ================== Gying 插件 for XPTV App - 修复版 ==================
// 版本: v10-fixed
// 修复内容: 
// 1. 修复request函数兼容性问题
// 2. 简化交互逻辑，移除复杂的筛选功能
// 3. 优化数据解析和错误处理
// ========================================================================

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请替换为你的后端服务实际地址
const PLUGIN_NAME = 'Gying观影';
const PLUGIN_VERSION = 'v10-fixed';

// --- 工具函数 ---
function log(message) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[${PLUGIN_NAME}] ${message}`);
  }
}

// 修复后的网络请求函数 - 与成功案例保持一致
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    let response;
    // 统一使用 $fetch 的逻辑，并添加 headers
    if (typeof $fetch !== 'undefined') {
      const res = await $fetch.get(url, {
        headers: { 'Accept': 'application/json' }, // 与成功案例保持一致
        timeout: 30000 
      });
      if (res.status !== 200) throw new Error(`HTTP错误! 状态: ${res.status}`);
      response = JSON.parse(res.data);
    } else { // 保留浏览器环境的备用逻辑
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP错误! 状态: ${res.status}`);
      response = await res.json();
    }
    
    if (response.error) throw new Error(`API返回错误: ${response.error}`);
    log(`请求成功, 收到 ${response.list?.length || 0} 条数据`);
    return response;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    // 返回一个符合App预期的错误结构
    return { error: true, message: error.message, list: [] };
  }
}

// --- 插件主要函数 ---

/**
 * 获取插件配置信息
 */
async function getConfig() {
  log(`插件初始化: ${PLUGIN_NAME} ${PLUGIN_VERSION}`);
  
  return JSON.stringify({
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    author: 'Gying Team',
    description: '观影网站资源聚合插件 - 修复版',
    tabs: [
      { name: '剧集', ext: { id: 'tv' } },
      { name: '电影', ext: { id: 'mv' } },
      { name: '动漫', ext: { id: 'ac' } },
    ],
    supportSearch: true,
    supportDetail: true
  });
}

/**
 * 获取首页内容 - 默认返回剧集分类
 */
async function home() {
  log('加载首页内容');
  return getCards({ id: 'tv', page: 1 });
}

/**
 * 获取分类内容
 */
async function category(ext) {
  const { id, page = 1 } = JSON.parse(JSON.stringify(ext));
  log(`加载分类: id=${id}, page=${page}`);
  return getCards({ id, page });
}

/**
 * 获取卡片列表 - 核心函数
 */
async function getCards(ext) {
  const { id, page = 1, keyword = '' } = JSON.parse(JSON.stringify(ext));
  
  log(`获取卡片列表: id=${id}, page=${page}, keyword=${keyword}`);
  
  // 构建请求URL
  let apiUrl;
  if (keyword) {
    // 搜索请求
    apiUrl = `${API_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  } else {
    // 分类请求
    apiUrl = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  }
  
  const data = await request(apiUrl);
  
  if (data.error || !data.list) {
    log(`获取数据失败: ${data.message || '未知错误'}`);
    return JSON.stringify({ 
      list: [], 
      hasMore: false,
      error: data.message || '获取数据失败'
    });
  }
  
  // 转换数据格式为App期望的格式
  const cards = data.list.map(item => ({
    id: item.vod_id,
    name: item.vod_name,
    pic: item.vod_pic,
    remarks: item.vod_remarks || '',
    year: item.vod_year || '',
    area: item.vod_area || '',
    director: item.vod_director || '',
    actor: item.vod_actor || '',
    des: item.vod_content || item.vod_blurb || ''
  }));
  
  log(`成功转换 ${cards.length} 个卡片`);
  
  return JSON.stringify({
    list: cards,
    hasMore: cards.length >= 20, // 假设每页20个，如果少于20个说明没有更多了
    total: data.total || cards.length
  });
}

/**
 * 搜索功能
 */
async function search(ext) {
  const { keyword, page = 1 } = JSON.parse(JSON.stringify(ext));
  log(`执行搜索: keyword=${keyword}, page=${page}`);
  return getCards({ keyword, page });
}

/**
 * 获取详情 - 简化版，直接展示所有资源
 */
async function getTracks(ext) {
  const { url } = JSON.parse(JSON.stringify(ext));
  log(`加载详情: url=${url}`);
  
  const detailUrl = `${API_BASE_URL}/detail?ids=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  
  if (data.error || !data.list || data.list.length === 0) {
    return JSON.stringify({ 
      list: [{ 
        title: '错误', 
        tracks: [{ name: '获取资源失败', pan: '' }] 
      }] 
    });
  }
  
  const playUrlString = data.list[0].vod_play_url;
  if (!playUrlString || playUrlString === '暂无任何网盘资源') {
    return JSON.stringify({ 
      list: [{ 
        title: '提示', 
        tracks: [{ name: '暂无任何网盘资源', pan: '' }] 
      }] 
    });
  }

  // 解析后端返回的 "标题$链接#标题$链接" 格式
  const resourceTracks = playUrlString.split('#').map(item => {
    const parts = item.split('$');
    if (parts.length < 2) return null;
    
    const title = parts[0];
    const link = parts[1];
    
    // 智能推断网盘类型用于显示
    const inferPanType = (title) => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('阿里')) return '阿里';
      if (lowerTitle.includes('夸克')) return '夸克';
      if (lowerTitle.includes('百度')) return '百度';
      if (lowerTitle.includes('迅雷')) return '迅雷';
      if (lowerTitle.includes('天翼')) return '天翼';
      if (lowerTitle.includes('115')) return '115';
      if (lowerTitle.includes('uc')) return 'UC';
      return '其他';
    };
    
    const panType = inferPanType(title);
    
    return { 
      name: `[${panType}] ${title}`, // 用于显示的名称
      pan: link                     // 用于点击跳转的链接
    };
  }).filter(Boolean); // 过滤掉解析失败的 null 项

  if (resourceTracks.length === 0) {
    return JSON.stringify({ 
      list: [{ 
        title: '提示', 
        tracks: [{ name: '解析后无有效资源', pan: '' }] 
      }] 
    });
  }

  // 返回App能理解的简单列表结构
  return JSON.stringify({ 
    list: [{ 
      title: `资源列表 (${resourceTracks.length})`, 
      tracks: resourceTracks 
    }] 
  });
}

/**
 * 获取详情信息
 */
async function detail(id) { 
  log(`获取详情信息: id=${id}`);
  return getTracks({ url: id }); 
}

/**
 * 播放功能 - 简化版，只负责传递URL
 */
async function play(flag, id) {
  log(`播放请求: flag=${flag}, id=${id}`);
  return JSON.stringify({ url: id });
}

// --- 导出函数（如果需要） ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getConfig,
    home,
    category,
    getCards,
    search,
    getTracks,
    detail,
    play
  };
}

// --- 插件信息 ---
log(`${PLUGIN_NAME} ${PLUGIN_VERSION} 加载完成`);

