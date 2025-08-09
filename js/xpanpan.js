/**
 * XPTV App 插件前端代码 (v5 - 精准识别版)
 * 
 * 功能:
 * - 与后端API交互，获取网盘资源社的内容。
 * - 支持分类浏览、搜索、详情查看。
 * - 精准识别后端返回的网盘类型（夸克、阿里、UC）并显示提取码。
 * 
 * v5 版本关键优化:
 * 1. 【精准识别】getTracks 函数中的网盘识别逻辑更新，与后端返回的链接类型严格对应。
 * 2. 【代码简化】移除了对百度、迅雷等App不支持的网盘的识别代码，使逻辑更清晰。
 * 3. 【体验优化】当链接中包含由后端拼接好的提取码时，能在资源名称中清晰地展示出来。
 */

// --- 配置区 ---
const API_BASE_URL = 'http://192.168.1.4:3000/api'; // 请务必替换为你的后端服务实际地址
// --- 配置区 ---

// XPTV App 环境函数 (如果在真实环境中 ，这些函数由App提供)
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
    // 假设 $fetch 和 $log 是由 XPTV App 环境提供的
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
 * 获取详情和播放链接 - 【v5 核心优化】
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

  if (data.error || !data.list || data.list.length === 0) {
    log(`获取详情数据失败或内容为空: ${data.message || '无有效列表'}`);
    return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败或帖子无内容', pan: '', ext: {} }] }] });
  }

  const tracks = [];
  const detailItem = data.list[0];

  if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '' && detailItem.vod_play_url !== '暂无有效网盘链接') {
    const playUrls = detailItem.vod_play_url.split('$$$');
    
    playUrls.forEach((playUrl, index) => {
      if (playUrl.trim()) {
        let panName = `网盘 ${index + 1}`; // 默认名称
        let cleanUrl = playUrl.trim();
        let passCode = '';

        // 【v5 核心优化】尝试从后端拼接好的链接中解析出提取码
        // 这个正则能匹配 ?pwd=xxxx 或 &pwd=xxxx
        const passCodeMatch = cleanUrl.match(/[?&]pwd=([a-zA-Z0-9]+)/);
        if (passCodeMatch && passCodeMatch[1]) {
          passCode = passCodeMatch[1];
        }
        
        // --- 【v5 核心优化】---
        // 根据链接关键词精准识别App支持的网盘类型
        if (cleanUrl.includes('quark.cn')) {
            panName = `夸克网盘 ${index + 1}`;
        } else if (cleanUrl.includes('aliyundrive.com') || cleanUrl.includes('alipan.com')) {
            panName = `阿里云盘 ${index + 1}`;
        } else if (cleanUrl.includes('uc.cn')) {
            panName = `UC网盘 ${index + 1}`;
        }
        // --- 【修改结束】---
        
        if (passCode) {
          // 如果有提取码，附加到名称上，给用户清晰的提示
          panName += ` [码:${passCode}]`;
        }
        
        tracks.push({
          name: panName,
          pan: cleanUrl, // 直接使用后端返回的、可能已经拼接好的链接
          ext: {},
        });
        
        log(`添加网盘链接: ${panName}, URL: ${cleanUrl}`);
      }
    });
  }

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
// 假设 jsonify, argsify, $fetch, $log 是由App环境提供的
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

log('网盘资源社插件加载完成 (v5 - 精准识别版)');
