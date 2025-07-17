/**
 * XPTV App 插件前端代码 (修复卡死问题版)
 * 
 * 修复点:
 * - 增强getTracks函数的异常处理能力
 * - 优化网盘链接解析逻辑
 * - 添加详细的错误日志
 */

// --- 配置区 ---
const API_BASE_URL = 'http://localhost:3000/api'; // 请替换为你的后端服务地址
// --- 配置区 ---

// XPTV App 环境函数
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
 * 获取详情和播放链接 - 修复卡死问题
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
  
  try {
    if (data.list && data.list.length > 0) {
      const detailItem = data.list[0];
      
      // 安全检查防止未定义错误
      if (!detailItem.vod_play_url || detailItem.vod_play_url === '暂无有效网盘链接') {
        tracks.push({ 
          name: '暂无资源', 
          pan: '', 
          ext: {} 
        });
        log('该帖子暂无有效的网盘链接');
      } else {
        // 健壮的分割逻辑
        const playUrls = (detailItem.vod_play_url || '')
          .split(/\$\$\$|\n/)
          .map(url => url.trim())
          .filter(url => url !== '');
        
        log(`原始链接分割后得到 ${playUrls.length} 条链接`);
        
        // 使用for循环替代forEach避免中断
        for (let i = 0; i < playUrls.length; i++) {
          const playUrl = playUrls[i];
          if (!playUrl) continue;
          
          try {
            // 优化提取码识别逻辑
            let panName = `网盘 ${i + 1}`;
            let actualUrl = playUrl;
            let passCode = '';
            
            // 精确的提取码匹配
            const passCodeMatch = actualUrl.match(/提取码[:：]?\s*([a-zA-Z0-9]{4,})/i);
            if (passCodeMatch) {
              passCode = passCodeMatch[1];
              // 从URL中移除提取码部分
              actualUrl = actualUrl.replace(passCodeMatch[0], '').trim();
            }
            
            // 网盘类型识别
            if (/quark|夸克/.test(actualUrl)) panName = `夸克网盘 ${i + 1}`;
            else if (/baidu|百度/.test(actualUrl)) panName = `百度网盘 ${i + 1}`;
            else if (/aliyun|阿里/.test(actualUrl)) panName = `阿里云盘 ${i + 1}`;
            else if (/115/.test(actualUrl)) panName = `115网盘 ${i + 1}`;
            else if (/lanzou|蓝奏/.test(actualUrl)) panName = `蓝奏云 ${i + 1}`;
            else if (/weiyun|微云/.test(actualUrl)) panName = `微云 ${i + 1}`;
            
            // 添加提取码到名称
            if (passCode) panName += ` [码:${passCode}]`;
            
            tracks.push({
              name: panName,
              pan: actualUrl,
              ext: { passCode }
            });
            
            log(`添加网盘链接: ${panName}`);
          } catch (error) {
            log(`处理第 ${i+1} 条链接时出错: ${error.message}`);
          }
        }
      }
    } else {
      log('详情数据解析失败');
      tracks.push({ 
        name: '解析失败', 
        pan: '', 
        ext: {} 
      });
    }
  } catch (error) {
    log(`处理详情数据时发生严重错误: ${error.message}`);
    tracks.push({ 
      name: '数据处理错误', 
      pan: '', 
      ext: {} 
    });
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

async function init() { 
  return getConfig(); 
}

async function home() { 
  const c = await getConfig(); 
  const config = JSON.parse(c);
  return jsonify({ 
    class: config.tabs, 
    filters: {} 
  }); 
}

async function category(tid, pg) { 
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg }); 
}

async function detail(id) { 
  return getTracks({ url: id }); 
}

async function play(flag, id) { 
  return jsonify({ url: id }); 
}

// --- 工具函数 ---

function jsonify(obj) {
  return JSON.stringify(obj);
}

function argsify(ext) {
  if (typeof ext === 'string') {
    return JSON.parse(ext);
  }
  return ext;
}

log('网盘资源社插件加载完成');
