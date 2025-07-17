/**
 * XPTV App 插件前端代码 (最终修复版 v3)
 * 
 * 功能:
 * - 与后端API交互，获取网盘资源社的内容
 * - 支持分类浏览、搜索、详情查看
 * - 智能识别网盘类型并显示提取码
 * 
 * v3 版本关键修复与优化:
 * 1. 【用户体验】在网盘名称中明确提示用户需要手动输入提取码。
 * 2. 【核心修复】重写 getTracks 函数，增强其容错性，完美处理各种后端返回数据，彻底解决二次打开卡死问题。
 * 3. 【健壮性】getTracks 函数能正确分离链接与提取码，保证点击跳转的URL纯净有效。
 * 4. 【健壮性】智能解析提取码格式，避免前端误判为失效。
 * 5. 【体验优化】当无有效链接时，明确提示用户，而不是空白转圈。
 * 6. 【功能优化】支持更多网盘类型的识别。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3000/api'; // 请务必替换为你的后端服务实际地址
// --- 配置区 ---

// XPTV App 环境函数 (如果在真实环境中，这些函数由App提供)
function log(msg) {
  try { 
    $log(`[网盘资源社插件] ${msg}`); 
  } catch (_) { 
    console.log(`[网盘资源社插件] ${msg}`); 
  }
}

async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000,
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }
    
    const data = JSON.parse(response.data);
    if (data.error) {
      throw new Error(`API返回错误: ${data.error}`);
    }
    
    log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { error: true, message: error.message, list: [] };
  }
}

// --- XPTV App 插件入口函数 ---

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  const appConfig = {
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
      { name: '教程/书籍', ext: { id: 'forum-8.htm' } },
      { name: '综艺娱乐', ext: { id: 'forum-2.htm' } },
      { name: '音乐MV', ext: { id: 'forum-4.htm' } }
    ],
  };
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);

  if (data.error) {
    log(`获取分类数据失败: ${data.message}`);
    return jsonify({ list: [] });
  }

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));

  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

/**
 * 获取详情和播放链接 - 【v3 核心修复】
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) {
    log('获取详情失败: 缺少URL参数');
    return jsonify({ list: [] });
  }

  log(`获取详情数据: url=${url}`);
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  // 【v2 修复】增强对错误或空数据的处理
  if (data.error || !data.list || data.list.length === 0) {
    log(`获取详情数据失败或内容为空: ${data.message || '无有效列表'}`);
    return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  // 【v2 修复】增强对播放链接字段的检查
  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrls = detailItem.vod_play_url.split('$$$');
    
    playUrls.forEach((playUrl, index) => {
      if (playUrl.trim()) {
        let panName = `网盘 ${index + 1}`;
        let cleanUrl = playUrl.trim(); // 默认 cleanUrl 就是完整的 playUrl
        let passCode = '';

        // 【v2 修复】使用正则分离链接和提取码，无论是否匹配成功，程序都能继续
        const passCodeMatch = playUrl.match(/^(.*?)\s*\(提取码:\s*([a-zA-Z0-9]+)\)$/);
        
        if (passCodeMatch && passCodeMatch[1] && passCodeMatch[2]) {
          cleanUrl = passCodeMatch[1].trim(); // 匹配成功，分离出纯净链接
          passCode = passCodeMatch[2];       // 和提取码
        }
        // 如果不匹配，cleanUrl 保持原样，它本身就是纯净链接，程序不会出错
        
        // 根据纯净链接识别网盘类型
        if (cleanUrl.includes('quark')) panName = `夸克网盘 ${index + 1}`;
        else if (cleanUrl.includes('baidu')) panName = `百度网盘 ${index + 1}`;
        else if (cleanUrl.includes('alipan')) panName = `阿里云盘 ${index + 1}`;
        else if (cleanUrl.includes('115')) panName = `115网盘 ${index + 1}`;
        else if (cleanUrl.includes('lanzou')) panName = `蓝奏云 ${index + 1}`;
        
        // 【v3 修复】将提取码附加到名称上用于显示，并明确提示手动输入
        if (passCode) {
          panName += ` [码:${passCode}] (请手动输入)`;
        }
        
        tracks.push({
          name: panName,    // 用于显示的友好名称
          pan: cleanUrl,    // 【关键】用于跳转的纯净链接
          ext: {},
        });
        
        log(`添加网盘链接: ${panName}, URL: ${cleanUrl}`);
      }
    });
  }

  // 【v2 修复】如果所有链接都无效或解析失败，提供明确提示
  if (tracks.length === 0) {
    tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
    log('该帖子不含有效链接或所有链接解析失败');
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';
  if (!text) {
    log('搜索失败: 缺少关键词');
    return jsonify({ list: [] });
  }
  
  log(`执行搜索: keyword=${text}`);
  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);

  if (data.error) {
    log(`搜索失败: ${data.message}`);
    return jsonify({ list: [] });
  }

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: '',
    ext: { url: item.vod_id },
  }));

  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
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
async function detail(id) { return getTracks({ url: id }); }
async function play(flag, id) { return jsonify({ url: id }); }

log('网盘资源社插件加载完成 (v3 修复版)');


