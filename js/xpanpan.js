/**
 * XPTV App 插件前端代码 (最终优化版)
 * 
 * 功能:
 * - 与后端API交互，获取网盘资源社的内容
 * - 支持分类浏览、搜索、详情查看
 * - 智能识别网盘类型并显示提取码
 * 
 * 最终版本优化:
 * 1. 【修复】优化getTracks函数，正确处理多个网盘链接
 * 2. 【修复】智能解析提取码格式，避免前端误判为失效
 * 3. 【优化】增强错误处理和用户体验
 * 4. 【优化】支持更多网盘类型的识别
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3000/api'; // 请替换为你的后端服务地址
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
      timeout: 30000, // 增加超时时间以应对海报抓取
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

/**
 * 获取插件配置
 */
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

/**
 * 获取分类列表
 */
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
    vod_pic: item.vod_pic || '', // 使用后端返回的海报地址
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));

  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

/**
 * 获取详情和播放链接 - 【核心优化】
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

  if (data.error) {
    log(`获取详情数据失败: ${data.message}`);
    return jsonify({ list: [{ title: '获取失败', tracks: [{ name: '网络错误或解析失败', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  if (data.list && data.list.length > 0) {
    const detailItem = data.list[0];
    if (detailItem.vod_play_url && detailItem.vod_play_url !== '暂无有效网盘链接') {
      const playUrls = detailItem.vod_play_url.split('$$$');
      
      playUrls.forEach((playUrl, index) => {
        if (playUrl.trim()) {
          // 【优化】智能识别网盘类型并生成友好的名称
          let panName = `网盘 ${index + 1}`;
          const urlPart = playUrl.split(' ')[0]; // 获取链接部分
          
          // 根据URL识别网盘类型
          if (urlPart.includes('quark')) {
            panName = `夸克网盘 ${index + 1}`;
          } else if (urlPart.includes('baidu') || urlPart.includes('pan.baidu')) {
            panName = `百度网盘 ${index + 1}`;
          } else if (urlPart.includes('aliyundrive') || urlPart.includes('alipan')) {
            panName = `阿里云盘 ${index + 1}`;
          } else if (urlPart.includes('115')) {
            panName = `115网盘 ${index + 1}`;
          } else if (urlPart.includes('lanzou')) {
            panName = `蓝奏云 ${index + 1}`;
          } else if (urlPart.includes('weiyun')) {
            panName = `微云 ${index + 1}`;
          }
          
          // 【修复】提取并显示提取码
          const passCodeMatch = playUrl.match(/\(提取码: ([a-zA-Z0-9]+)\)/);
          if (passCodeMatch && passCodeMatch[1]) {
            panName += ` [码:${passCodeMatch[1]}]`;
          }
          
          tracks.push({
            name: panName,
            pan: playUrl.trim(), // 完整的链接信息，包含提取码
            ext: {},
          });
          
          log(`添加网盘链接: ${panName}`);
        }
      });
    } else {
      tracks.push({ 
        name: '暂无资源', 
        pan: '', 
        ext: {} 
      });
      log('该帖子暂无有效的网盘链接');
    }
  } else {
    tracks.push({ 
      name: '解析失败', 
      pan: '', 
      ext: {} 
    });
    log('详情数据解析失败');
  }

  log(`成功处理 ${tracks.length} 个播放链接`);
  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

/**
 * 搜索功能
 */
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
    vod_pic: item.vod_pic || '', // 搜索结果可能没有海报
    vod_remarks: '',
    ext: { url: item.vod_id },
  }));

  log(`搜索成功，找到 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

// --- 兼容旧版 XPTV App 接口 ---

/**
 * 初始化接口 (兼容旧版)
 */
async function init() { 
  return getConfig(); 
}

/**
 * 首页接口 (兼容旧版)
 */
async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return jsonify({ 
    class: config.tabs, 
    filters: {} 
  }); 
}

/**
 * 分类接口 (兼容旧版)
 */
async function category(tid, pg) { 
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg }); 
}

/**
 * 详情接口 (兼容旧版)
 */
async function detail(id) { 
  return getTracks({ url: id }); 
}

/**
 * 播放接口 (兼容旧版)
 */
async function play(flag, id) { 
  // 直接返回pan字段的内容，让App处理
  return jsonify({ url: id }); 
}

// --- 工具函数 ---

/**
 * 格式化网盘链接显示
 */
function formatPanLink(url) {
  if (!url) return '';
  
  // 如果包含提取码，分离显示
  const match = url.match(/^(.+?)\s*\(提取码:\s*([a-zA-Z0-9]+)\)$/);
  if (match) {
    return {
      url: match[1],
      code: match[2],
      display: `${match[1]} (提取码: ${match[2]})`
    };
  }
  
  return {
    url: url,
    code: '',
    display: url
  };
}

/**
 * 获取网盘类型图标
 */
function getPanIcon(url) {
  if (url.includes('quark')) return '🌟';
  if (url.includes('baidu')) return '🔵';
  if (url.includes('aliyundrive') || url.includes('alipan')) return '🟠';
  if (url.includes('115')) return '🟢';
  if (url.includes('lanzou')) return '🔷';
  if (url.includes('weiyun')) return '🟣';
  return '💾';
}

log('网盘资源社插件加载完成');

