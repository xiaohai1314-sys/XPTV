/**
 * XPTV App 插件前端代码 (v8.1 - 健壮性修复版)
 *
 * --- 版本说明 ---
 * - 基于 v8 版本，集成了由用户发现并提出的关键性修复。
 * - [核心修复] 重写了 `category` 函数，增加了对传入参数 `tid` 的健壮性检查。
 * - [功能增强] 当 `category` 函数接收到无效的 `tid` (如 undefined, null, 空值) 时，
 *   不再导致请求失败，而是会自动回退到默认分类 'tv'，并打印警告日志，
 *   从根本上解决了"有分类无内容"的问题。
 * - 其他功能 (如详情页筛选、搜索等) 保持不变。
 */

// --- 配置区 ---
// !!! 重要：请务必将这里的 IP 地址替换为您后端服务所在的电脑的局域网IP !!!
const API_BASE_URL = 'http://192.168.1.6:3001/api'; // 示例IP，请务必修改

const PAN_TYPE_MAP = {0: '百度', 1: '迅雷', 2: '夸克', 3: '阿里', 4: '天翼', 5: '115', 6: 'UC'};
const KEYWORD_FILTERS = ['4K', 'Remux', '高码', '原盘', '杜比', '1080', '其他'];
// --- 配置区 ---

// --- XPTV App 环境函数 (保持不变) ---
function log(msg) {
  console.log(`[Gying] ${msg}`);
}

async function request(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
        log(`网络错误: HTTP ${response.status} - ${response.statusText}`);
        return { error: `HTTP ${response.status}` };
    }
    return await response.json();
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

// --- 缓存区 (保持不变) ---
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
  if (!id) {
      log("错误: getCards 调用时 id 为空，已中止。");
      return jsonify({ list: [], total: 0 });
  }

  log(`获取分类数据: id=${id}, page=${page}`);
  const url = `${API_BASE_URL}/vod?id=${id}&page=${page}`;
  log(`即将请求的URL: ${url}`);
  const data = await request(url);

  if (data.error || !data.list) {
    log(`获取分类数据失败或返回数据格式不正确。错误信息: ${data.error || '无'}`);
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

  if (data.error || !data.list) {
    log(`搜索失败或返回数据格式不正确。错误信息: ${data.error || '无'}`);
    return jsonify({ list: [], total: 0 });
  }

  log(`搜索到 ${data.list.length} 条结果`);
  return jsonify(data);
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url, pan_type, keyword, action } = ext;

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

    fullResourceCache = playUrlString.split('$$$').map(item => {
        const parts = item.split('$');
        return { type: parts[0], title: parts[1], link: parts[2] };
    });
    currentPanTypeFilter = 'all';
    currentKeywordFilter = 'all';
  }

  if (action === 'filter') {
    if (pan_type) currentPanTypeFilter = pan_type;
    if (keyword) currentKeywordFilter = keyword;
  }

  let resourcesToShow = [...fullResourceCache];

  if (currentPanTypeFilter !== 'all') {
    resourcesToShow = resourcesToShow.filter(r => r.type === currentPanTypeFilter);
  }

  if (currentKeywordFilter !== 'all') {
    const lowerKeyword = currentKeywordFilter.toLowerCase();
    if (lowerKeyword === '其他') {
        resourcesToShow = resourcesToShow.filter(r => {
            const lowerTitle = r.title.toLowerCase();
            return KEYWORD_FILTERS.slice(0, -1).every(kw => !lowerTitle.includes(kw.toLowerCase()));
        });
    } else {
        resourcesToShow = resourcesToShow.filter(r => r.title.toLowerCase().includes(lowerKeyword));
    }
  }

  const resultLists = [];
  
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

  const keywordButtons = [{ name: '全部', pan: `custom:action=filter&keyword=all` }];
  KEYWORD_FILTERS.forEach(kw => {
      keywordButtons.push({ name: kw, pan: `custom:action=filter&keyword=${kw}` });
  });
  resultLists.push({ title: '关键字筛选', tracks: keywordButtons });

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

/**
 * 分类页 - 【已采纳您的修复建议】
 * 增加了对传入参数 tid 的健壮性检查。
 * 当 tid 无效时，默认使用第一个分类 'tv' 作为ID，
 * 从而防止向后端请求一个 undefined 的分类地址。
 */
async function category(tid, pg) {
  let id;

  // 检查 tid 是否是一个包含有效 id 属性的对象
  if (typeof tid === 'object' && tid && tid.id) {
    id = tid.id;
  }
  // 检查 tid 是否是一个非空字符串
  else if (typeof tid === 'string' && tid) {
    id = tid;
  }
  // 如果以上条件都不满足，说明传入的 tid 有问题
  else {
    // 打印警告日志，方便调试
    log(`警告: category 调用收到的 tid 无效 (值为: ${JSON.stringify(tid)}), 已自动修正为默认分类 "tv"`);
    // 设置一个默认的、有效的分类ID
    id = 'tv';
  }

  // 使用修正后 (或原本就有效) 的 id 去调用 getCards 函数
  return getCards({ id: id, page: pg });
}

async function detail(id) { 
    fullResourceCache = [];
    return getTracks({ url: id, action: 'init' }); 
}

async function play(flag, id) {
    if (id.startsWith('custom:')) {
        const params = new URLSearchParams(id.replace('custom:', ''));
        const ext = Object.fromEntries(params.entries());
        return getTracks(ext);
    }
    return jsonify({ url: id });
}

