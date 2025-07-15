// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

// XPTV App 环境提供的全局函数
function $log(msg) { /* App will provide this */ }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(ext) { 
  try {
    return typeof ext === 'string' ? JSON.parse(ext) : ext;
  } catch {
    return ext || {};
  }
}

function log(msg) {
  try { 
    $log(`[网盘资源社插件] ${msg}`); 
  } catch (_) { 
    console.log(`[网盘资源社插件] ${msg}`); 
  }
}

/**
 * 封装网络请求，处理错误和超时
 * @param {string} url 请求的URL
 * @returns {Promise<object>} 返回解析后的JSON数据或错误对象
 */
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000 // 15秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`API返回错误: ${data.error}`);
    }
    
    log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
    return data;

  } catch (error) {
    log(`请求失败: ${error.message}`);
    return { 
      error: true, 
      message: error.message, 
      list: [],
      page: 1,
      total: 1,
      count: 0
    };
  }
}

// 缓存对象
const vodCache = {};

// --- XPTV App 插件入口函数 --- 

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  
  // 尝试调用后端健康检查接口
  const health = await request(`${API_BASE_URL}/health`);
  log(`后端健康状态: ${health.status}, 登录状态: ${health.cookies}`);
  
  // 如果未登录，尝试触发登录
  if (health.cookies === 'not_logged_in') {
    log('检测到未登录，尝试自动登录...');
    await request(`${API_BASE_URL}/login`);
  }

  const appConfig = {
    ver: 2,
    title: '网盘资源社',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      {
        name: '影视/剧集',
        ext: { id: 'forum-1.htm?page=' },
      },
      {
        name: '4K专区',
        ext: { id: 'forum-12.htm?page=' },
      },
      {
        name: '动漫区',
        ext: { id: 'forum-3.htm?page=' },
      },
    ],
  };
  return jsonify(appConfig);
}

async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  
  // 创建唯一缓存键
  const cacheKey = `${id}-${page}`;
  
  log(`获取分类数据: id=${id}, page=${page}`);
  
  // 检查缓存
  if (vodCache[cacheKey]) {
    log(`返回缓存数据: ${cacheKey}`);
    return vodCache[cacheKey];
  }
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    vod_remarks: item.vod_remarks || '无备注',
    vod_poster: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    vod_cover: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    ext: { url: item.vod_id },
  }));

  const result = jsonify({ 
    list: cards,
    page: data.page || 1,
    total: data.total || 1,
    count: data.count || cards.length
  });
  
  // 缓存结果
  vodCache[cacheKey] = result;
  
  return result;
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });

  log(`获取详情数据: url=${url}`);
  
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  const tracks = [];
  
  if (data.list && data.list.length > 0) {
    const detailItem = data.list[0];
    
    // 处理多个网盘链接
    if (detailItem.vod_play_url && detailItem.vod_play_url !== '暂无资源') {
      // 使用$$$分隔符拆分多个链接
      const playUrls = detailItem.vod_play_url.split('$$$');
      
      playUrls.forEach((playUrl, index) => {
        if (playUrl.trim()) {
          tracks.push({
            name: `网盘链接 ${index + 1}`,
            pan: playUrl.trim(),
            ext: {},
          });
        }
      });
      
      // 如果没有找到有效链接
      if (tracks.length === 0) {
        tracks.push({
          name: '资源解析失败',
          pan: '未找到有效链接',
          ext: { raw: detailItem.vod_play_url }
        });
      }
    } else {
      tracks.push({
        name: '资源获取失败',
        pan: detailItem.vod_play_url || '暂无资源',
        ext: {}
      });
    }
  } else {
    tracks.push({
      name: '未获取到详情',
      pan: '请稍后重试',
      ext: {}
    });
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext;
  log(`请求播放: url=${pan}`);
  
  // 处理阿里云盘链接
  let playUrl = pan;
  if (playUrl.includes('aliyundrive.com') && !playUrl.includes('alipan.com')) {
    playUrl = playUrl.replace('aliyundrive.com', 'alipan.com');
  }
  
  return jsonify({ 
    urls: [playUrl],
    header: {
      'Referer': 'https://www.alipan.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    }
  });
}

async function search(ext) {
  ext = argsify(ext);
  const text = ext.text || '';

  if (!text) return jsonify({ list: [] });

  log(`执行搜索: keyword=${text}`);

  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
  const data = await request(url);

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    vod_remarks: item.vod_remarks || '无备注',
    vod_poster: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    vod_cover: item.vod_pic || 'https://via.placeholder.com/150x200?text=No+Image',
    ext: { url: item.vod_id },
  }));

  return jsonify({ 
    list: cards,
    page: data.page || 1,
    total: data.total || 1,
    count: data.count || cards.length
  });
}

// 兼容旧的 init, home, category, detail, search, play 接口
async function init() {
  return getConfig();
}

async function home() {
  const config = JSON.parse(await getConfig());
  return jsonify({ 
    class: config.tabs, 
    filters: {}
  });
}

async function category(tid, pg, filter, extend) {
  try {
    log(`分类请求参数: tid=${JSON.stringify(tid)}, pg=${pg}, filter=${JSON.stringify(filter)}, extend=${JSON.stringify(extend)}`);
    
    // 处理页码
    let page = 1;
    if (typeof pg === 'number') {
      page = pg;
    } else if (typeof pg === 'object' && pg.page) {
      page = pg.page;
    } else if (typeof pg === 'string' && !isNaN(pg)) {
      page = parseInt(pg);
    }
    
    // 处理分类ID
    let id = 'forum-1.htm?page=';
    if (typeof tid === 'object') {
      id = tid.id || tid.ext?.id || 'forum-1.htm?page=';
    } else if (typeof tid === 'string') {
      id = tid;
    }
    
    log(`处理后的参数: id=${id}, page=${page}`);
    
    return getCards({ id, page });
  } catch (error) {
    log(`分类处理错误: ${error.message}`);
    return jsonify({
      list: [],
      page: 1,
      total: 1,
      count: 0,
      error: error.message
    });
  }
}

async function detail(id) {
  return getTracks({ url: id });
}

async function play(flag, id) {
  return getPlayinfo({ pan: id });
}

// 导出函数供 XPTV App 使用
module.exports = {
  getConfig,
  getCards,
  getTracks,
  getPlayinfo,
  search,
  init,
  home,
  category,
  detail,
  play
};
