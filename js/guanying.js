/**
 * XPTV App 插件前端代码 (v8 - 钻取式两级筛选版)
 *
 * 功能:
 * - 完美适配 gying-backend v8 后端。
 * - 实现了详情页内"钻取式"的两级筛选功能。
 * - 筛选关键字和大小写处理均已按最终要求配置。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 请务必替换为你的后端服务实际地址
const PAN_TYPE_MAP = {0: '百度', 1: '迅雷', 2: '夸克', 3: '阿里', 4: '天翼', 5: '115', 6: 'UC'};
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
// --- 配置区 ---

// XPTV App 环境函数
function log(msg) {
  console.log(`[Gying] ${msg}`);
}

async function request(url) {
  try {
    // 增强日志：记录请求URL
    log(`发送请求: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    // 增强日志：记录响应关键信息
    log(`收到响应: status=${response.status}, keys=${Object.keys(data).join(', ')}, list_count=${data.list?.length || 0}`);
    
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: error.message };
  }
}

function jsonify(obj) {
  return JSON.stringify(obj);
}

function argsify(str) {
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// --- 缓存区 ---
let fullResourceCache = []; // 用于缓存详情页的全部资源
let currentPanTypeFilter = 'all'; // 当前网盘类型筛选
let currentKeywordFilter = 'all'; // 当前关键字筛选

// --- XPTV App 插件入口函数 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  return jsonify({
    ver: 1,
    title: 'Gying',
    site: API_BASE_URL,
    tabs: [
      { name: '剧集', ext: { id: 'tv' } },
      { name: '电影', ext: { id: 'mv' } },
      { name: '动漫', ext: { id: 'ac' } },
    ],
  });
}

async function getCards(ext) {
  ext = argsify(ext);
  const { id, page = 1 } = ext;
  if (!id) return jsonify({ list: [] });

  log(`获取分类数据: id=${id}, page=${page}`);
  const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  const data = await request(url);

  if (data.error) {
    return jsonify({ list: [], total: 0 });
  }

  log(`成功获取 ${data.list.length} 条数据`);
  return jsonify(data);
}

async function search(ext) {
  ext = argsify(ext);
  const { text } = ext;
  if (!text) return jsonify({ list: [] });

  log(`搜索: ${text}`);
  const url = `${API_BASE_URL}/search?wd=${encodeURIComponent(text)}`;
  const data = await request(url);

  if (data.error) {
    return jsonify({ list: [] });
  }

  log(`搜索到 ${data.list.length} 条结果`);
  return jsonify(data);
}

/**
 * 获取详情 - 【v8核心】实现钻取式两级筛选
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url, pan_type, keyword, action } = ext;

  // 步骤1: 数据获取与缓存
  if (action === 'init' || fullResourceCache.length === 0) {
    log(`首次加载或强制刷新: url=${url}`);
    const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
    const data = await request(detailUrl);
    
    if (data.error || !data.list || data.list.length === 0) {
      return jsonify({ list: [{ title: '错误', tracks: [{ name: '获取资源失败', pan: '' }] }] });
    }
    
    const playUrlString = data.list[0].vod_play_url;
    if (!playUrlString || playUrlString === '暂无任何网盘资源') {
        return jsonify({ list: [{ title: '提示', tracks: [{ name: '暂无任何网盘资源', pan: '' }] }] });
    }

    // 解析后端数据并存入缓存
    fullResourceCache = playUrlString.split('$$$').map(item => {
        const parts = item.split('$');
        return { type: parts[0], title: parts[1], link: parts[2] };
    });
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';
  }

  // 步骤2: 处理用户操作，更新筛选状态
  if (action === 'filter') {
    if (pan_type) currentPanTypeFilter = pan_type;
    if (keyword) currentKeywordFilter = keyword;
  }

  // 步骤3: 根据当前筛选状态，生成UI数据
  let resourcesToShow = [...fullResourceCache];

  // 应用第一级：网盘类型筛选
  if (currentPanTypeFilter !== 'all') {
    resourcesToShow = resourcesToShow.filter(r => r.type === currentPanTypeFilter);
  }

  // 应用第二级：关键字筛选
  if (currentKeywordFilter !== 'all') {
    const lowerKeyword = currentKeywordFilter.toLowerCase();
    if (lowerKeyword === '其他') {
        resourcesToShow = resourcesToShow.filter(r => {
            const lowerTitle = r.title.toLowerCase();
            // 检查是否不包含任何其他预设关键字
            return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase()));
        });
    } else {
        resourcesToShow = resourcesToShow.filter(r => r.title.toLowerCase().includes(lowerKeyword));
    }
  }

  // 步骤4: 构建要渲染的按钮列表
  const resultLists = [];
  
  // 构建第一层：网盘分类按钮
  const panTypeCounts = fullResourceCache.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
  }, {});
  const panTypeButtons = [{ name: `全部 (${fullResourceCache.length})`, pan: `custom:action=filter&pan_type=all` }];
  Object.keys(panTypeCounts).forEach(typeCode => {
      const typeName = PAN_TYPE_MAP[typeCode] || `类型${typeCode}`;
      panTypeButtons.push({ name: `${typeName} (${panTypeCounts[typeCode]})`, pan: `custom:action=filter&pan_type=${typeCode}` });
  });
  resultLists.push({ title: '网盘分类', tracks: panTypeButtons });

  // 构建第二层：关键字筛选按钮
  const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all` }];
  KEYWORD_FILTERS.forEach(kw => {
      keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}` });
  });
  resultLists.push({ title: '关键字筛选', tracks: keywordButtons });

  // 构建第三层：资源列表
  if (resourcesToShow.length > 0) {
      const resourceTracks = resourcesToShow.map(r => ({
          name: `[${PAN_TYPE_MAP[r.type] || '未知'}] ${r.title}`,
          pan: r.link
      }));
      resultLists.push({ title: '资源列表', tracks: resourceTracks });
  } else {
      resultLists.push({ title: '资源列表', tracks: [{ name: '在当前筛选条件下无结果', pan: '' }] });
  }

  log(`UI刷新: 网盘类型='${currentPanTypeFilter}', 关键字='${currentKeywordFilter}', 显示${resourcesToShow.length}条`);
  return jsonify({ list: resultLists });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() { return getConfig(); }
async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return jsonify({ class: config.tabs, filters: {} }); 
}
async function category(tid, pg) { 
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg }); 
}
// 关键：重写detail的调用方式，首次加载时带上action=init
async function detail(id) { 
    fullResourceCache = []; // 清空上一部影片的缓存
    return getTracks({ url: id, action: 'init' }); 
}
// 关键：重写play的调用方式，用于处理自定义的筛选指令
async function play(flag, id) {
    if (id.startsWith('custom:')) {
        // 这是我们的自定义筛选指令，重新调用getTracks进行刷新
        const params = new URLSearchParams(id.replace('custom:', ''));
        const ext = Object.fromEntries(params.entries());
        return getTracks(ext);
    }
    // 否则是普通链接，正常播放
    return jsonify({ url: id });
}
