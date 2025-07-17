
/**
 * XPTV App 插件前端代码 (最终优化版)
 * 
 * 功能:
 * - 与后端API交互，获取网盘资源社的内容
 * - 支持分类浏览、搜索、详情查看
 * - 智能识别网盘类型并显示提取码
 * 
 * 最终版本优化:
 * 1. 【修复】正确处理多个网盘链接。
 * 2. 【修复】分离纯净URL和提取码，解决链接点击无效问题。
 * 3. 【优化】增强错误处理和用户体验，支持自动复制提取码。
 * 4. 【优化】支持更多网盘类型的识别。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.6:3000/api'; // 请替换为你的后端服务地址
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
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));

  log(`成功处理 ${cards.length} 条分类数据`);
  return jsonify({ list: cards });
}

/**
 * 获取详情和播放链接
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
          let finalPanUrl = playUrl.trim();
          let displayName = finalPanUrl;

          const match = finalPanUrl.match(/^(https?:\[^\s]+\s*\(提取码[:：\s]*([a-zA-Z0-9]+)\)/i);
          
          if (match) {
            const pureUrl = match[1];
            const extractCode = match[2];
            
            finalPanUrl = pureUrl;
            displayName = `${getPanName(pureUrl, index)} [码:${extractCode}]`;
            
            try {
                $copy(extractCode);
                displayName += ' (已复制)';
            } catch(e) {
                log('当前环境不支持 $copy 函数，跳过自动复制。');
            }
          } else {
            displayName = getPanName(finalPanUrl, index);
          }

          tracks.push({
            name: displayName,
            pan: finalPanUrl,
            ext: {},
          });
          
          log(`添加网盘链接: ${displayName}, 跳转地址: ${finalPanUrl}`);
        }
      });
    } else {
      tracks.push({ name: '暂无资源', pan: '', ext: {} });
      log('该帖子暂无有效的网盘链接');
    }
  } else {
    tracks.push({ name: '解析失败', pan: '', ext: {} });
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

// --- 工具函数 ---
function getPanName(url, index) {
    const i = index + 1;
    if (url.includes('quark')) return `夸克网盘 ${i}`;
    if (url.includes('baidu')) return `百度网盘 ${i}`;
    if (url.includes('aliyundrive') || url.includes('alipan')) return `阿里云盘 ${i}`;
    if (url.includes('115')) return `115网盘 ${i}`;
    if (url.includes('lanzou')) return `蓝奏云 ${i}`;
    if (url.includes('weiyun')) return `微云 ${i}`;
    return `网盘 ${i}`;
}

log('网盘资源社插件加载完成');


