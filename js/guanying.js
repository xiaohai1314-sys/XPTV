// ================== Gying 插件 for XPTV App - 最终修复版 v6 ==================
// 版本: v23-final-fix
// 修复内容: 
// 1. 进一步加强category函数中ext参数解析的健壮性，确保分类ID正确传递。
// 2. 确保getCards函数返回的分类列表数据结构完全符合App预期，解决分类列表不显示问题。
// 3. 恢复并优化筛选功能，将其完全封装在getTracks中，避免影响分类列表。
// ========================================================================

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 【重要】请替换为你的后端服务实际地址
const PLUGIN_NAME = 'Gying观影';
const PLUGIN_VERSION = 'v23-final-fix';

// --- 全局状态管理 (仅用于getTracks内部的筛选逻辑) ---
let fullResourceCache = []; // 缓存完整的资源列表
let currentPanTypeFilter = 'all'; // 当前网盘类型筛选
let currentKeywordFilter = 'all'; // 当前关键字筛选

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
    if (typeof $fetch !== 'undefined') {
      const res = await $fetch.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 30000 
      });
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
    // 返回空列表，而不是错误对象，避免App崩溃
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
    description: '观影网站资源聚合插件 - 最终修复版',
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
 * 获取首页内容
 */
async function home() {
  log('加载首页内容');
  // 首页默认加载剧集分类
  return getCards({ id: 'tv', page: 1 });
}

/**
 * 获取分类内容
 */
async function category(ext) {
  let id = 'tv'; // 默认分类ID，以防万一
  let page = 1;

  log(`category函数原始ext参数: ${JSON.stringify(ext)}`);

  try {
    // XPTV App在调用category时，ext可能直接是分类ID字符串，也可能是包含id和page的对象
    // 尝试解析ext，兼容多种App传递参数的方式
    const parsedExt = JSON.parse(JSON.stringify(ext));
    
    if (typeof parsedExt === 'object' && parsedExt !== null) {
      // 如果ext是对象，尝试从id和page属性中获取
      if (parsedExt.id !== undefined && parsedExt.id !== null) {
        id = String(parsedExt.id);
      }
      if (parsedExt.page !== undefined && parsedExt.page !== null) {
        page = Number(parsedExt.page);
      }
    } else if (typeof parsedExt === 'string' && parsedExt.length > 0) {
      // 如果ext直接是ID字符串，例如 'tv', 'mv', 'ac'
      id = parsedExt;
    } else {
      log(`警告: category函数收到未知或无效ext类型/值: ${typeof parsedExt}, ext: ${JSON.stringify(parsedExt)}`);
    }
  } catch (e) {
    log(`解析category ext参数失败: ${e.message}, ext: ${JSON.stringify(ext)}`);
  }

  log(`加载分类: 解析后id=${id}, page=${page}`);
  return getCards({ id, page });
}

/**
 * 获取卡片列表 - 核心函数，确保返回结构完全符合App预期
 */
async function getCards(ext) {
  const { id, page = 1, keyword = '' } = JSON.parse(JSON.stringify(ext));
  
  log(`获取卡片列表: id=${id}, page=${page}, keyword=${keyword}`);
  
  let apiUrl;
  if (keyword) {
    apiUrl = `${API_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  } else {
    apiUrl = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  }
  
  const data = await request(apiUrl);
  
  if (data.error || !data.list) {
    log(`获取数据失败: ${data.message || '未知错误'}`);
    // 返回空列表，而不是错误对象，避免App崩溃
    return JSON.stringify({ 
      list: [], 
      hasMore: false
    });
  }
  
  // 确保返回的卡片结构包含App所需的所有字段
  // 关键：确保字段名和类型与App期望的完全一致
  const cards = data.list.map(item => ({
    id: String(item.vod_id),       // 影片唯一ID，必须有，确保是字符串
    name: String(item.vod_name),   // 影片名称，必须有，确保是字符串
    pic: String(item.vod_pic),     // 影片图片URL，必须有，确保是字符串
    remarks: String(item.vod_remarks || ''), // 备注，如“更至XX集”，可选，确保是字符串
    // 以下字段App可能不直接显示在列表页，但为了完整性保留，并确保类型正确
    year: String(item.vod_year || ''),
    area: String(item.vod_area || ''),
    director: String(item.vod_director || ''),
    actor: String(item.vod_actor || ''),
    des: String(item.vod_content || item.vod_blurb || '')
  }));
  
  log(`成功转换 ${cards.length} 个卡片`);
  
  // App通常期望一个包含list和hasMore的JSON字符串
  return JSON.stringify({
    list: cards,
    hasMore: cards.length >= 20, // 假设每页20个，如果少于20个说明没有更多了
    total: data.total || cards.length // total字段App可能不强制要求，但提供更完整
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
 * 获取详情 - 带筛选功能的版本
 */
async function getTracks(ext) {
  const { url, action = 'init' } = JSON.parse(JSON.stringify(ext));
  
  log(`获取详情: url=${url}, action=${action}`);
  
  // 如果是初始化，获取完整资源列表
  if (action === 'init') {
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

    // 解析并缓存所有资源
    fullResourceCache = playUrlString.split('#').map(item => {
      const parts = item.split('$');
      if (parts.length < 2) return null;
      
      const title = parts[0];
      const link = parts[1];
      
      // 智能推断网盘类型
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
        title,
        link,
        panType,
        displayName: `[${panType}] ${title}`
      };
    }).filter(Boolean);

    log(`缓存了 ${fullResourceCache.length} 个资源`);
    
    // 重置筛选状态
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';
  }
  
  // 应用筛选逻辑
  let filteredResources = [...fullResourceCache];
  
  // 网盘类型筛选
  if (currentPanTypeFilter !== 'all') {
    filteredResources = filteredResources.filter(resource => 
      resource.panType === currentPanTypeFilter
    );
  }
  
  // 关键字筛选
  if (currentKeywordFilter !== 'all') {
    const keywords = ['4K', '1080P', '720P', '蓝光', '高清', '超清'];
    if (keywords.includes(currentKeywordFilter)) {
      filteredResources = filteredResources.filter(resource => 
        resource.title.includes(currentKeywordFilter)
      );
    }
  }
  
  // 构建返回结果
  const result = {
    list: []
  };
  
  // 网盘分类按钮
  const panTypes = ['all', ...new Set(fullResourceCache.map(r => r.panType))];
  const panTypeButtons = panTypes.map(type => ({
    name: type === 'all' ? `全部 (${fullResourceCache.length})` : 
          `${type} (${fullResourceCache.filter(r => r.panType === type).length})`,
    pan: `filter://pan_type=${type}`
  }));
  
  result.list.push({
    title: '网盘分类',
    tracks: panTypeButtons
  });
  
  // 关键字筛选按钮
  const keywords = ['all', '4K', '1080P', '720P', '蓝光', '高清', '超清'];
  const keywordButtons = keywords.map(keyword => {
    const count = keyword === 'all' ? fullResourceCache.length :
                  fullResourceCache.filter(r => r.title.includes(keyword)).length;
    return {
      name: keyword === 'all' ? `全部 (${count})` : `${keyword} (${count})`,
      pan: `filter://keyword=${keyword}`
    };
  });
  
  result.list.push({
    title: '关键字筛选',
    tracks: keywordButtons
  });
  
  // 筛选后的资源列表
  const resourceTracks = filteredResources.map(resource => ({
    name: resource.displayName,
    pan: resource.link
  }));
  
  if (resourceTracks.length === 0) {
    result.list.push({
      title: '资源列表',
      tracks: [{ name: '无匹配资源', pan: '' }] 
    });
  } else {
    result.list.push({
      title: `资源列表 (${resourceTracks.length})`,
      tracks: resourceTracks
    });
  }
  
  return JSON.stringify(result);
}

/**
 * 获取详情信息
 */
async function detail(id) {
  log(`获取详情信息: id=${id}`);
  // 清空缓存，重新开始
  fullResourceCache = [];
  currentPanTypeFilter = 'all';
  currentKeywordFilter = 'all';
  return getTracks({ url: id, action: 'init' }); 
}

/**
 * 播放功能 - 处理筛选指令和播放链接
 */
async function play(flag, id) {
  log(`播放请求: flag=${flag}, id=${id}`);
  
  // 检查是否是筛选指令
  if (id.startsWith('filter://')) {
    const params = new URLSearchParams(id.replace('filter://', ''));
    
    if (params.has('pan_type')) {
      currentPanTypeFilter = params.get('pan_type');
      log(`设置网盘类型筛选: ${currentPanTypeFilter}`);
    }
    
    if (params.has('keyword')) {
      currentKeywordFilter = params.get('keyword');
      log(`设置关键字筛选: ${currentKeywordFilter}`);
    }
    
    // 返回刷新指令，让App重新调用getTracks
    return JSON.stringify({ 
      url: '',
      refresh: true,
      message: '筛选已更新'
    });
  }
  
  // 普通播放链接
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

log(`${PLUGIN_NAME} ${PLUGIN_VERSION} 加载完成`);

