// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3000/api'; 
// --- 配置区 ---

// XPTV App 环境提供的全局函数，实际由App注入
function $log(msg) { console.log(`[App提供] ${msg}`); }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(ext) { return typeof ext === 'object' ? ext : {}; }

/**
 * 封装网络请求，处理错误和超时（修复页面加载失败问题）
 * @param {string} url 请求的URL
 * @returns {Promise<object>} 返回解析后的JSON数据或错误对象
 */
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    // 修复：增加请求前的URL有效性校验
    if (!url || url.trim() === '') {
      throw new Error("请求URL为空");
    }
    const response = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 20000, // 延长超时时间至20秒
    });
    // 修复：处理非200状态码但返回有效数据的情况
    if (!response.data) {
      throw new Error("服务器返回空数据");
    }
    const data = JSON.parse(response.data);
    if (data.error) {
      throw new Error(`API返回错误: ${data.error}`);
    }
    log(`请求成功, 收到 ${data.list?.length || 0} 条数据`);
    return data;
  } catch (error) {
    log(`请求失败: ${error.message}`);
    // 修复：返回结构化错误，避免页面白屏
    return { error: true, message: error.message, list: [] };
  }
}

/**
 * 获取分类卡片数据（含图片处理）
 * @param {object} ext - 包含id（分类ID）和page（页码）
 * @returns {Promise<string>} 格式化后的卡片数据JSON
 */
async function getCards(ext) {
  ext = argsify(ext);
  const { id, page = 1 } = ext;
  
  log(`获取分类数据: id=${id}, page=${page}`);
  
  // 修复：确保分类ID和页码正确拼接
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  
  // 修复：处理后端返回空数据的情况
  if (!data || !data.list) {
    log("分类数据为空，返回默认结构");
    return jsonify({ list: [] });
  }
  
  // 构造卡片数据，确保图片显示
  const cards = data.list.map(item => ({
    vod_id: item.vod_id || `thread-${Math.random().toString(36).substr(2, 9)}.htm`, // 兜底ID
    vod_name: item.vod_name || '未知标题',
    vod_pic: item.vod_pic || 'default_pic.png', // 无图时显示默认图
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id }
  }));
  
  return jsonify({ list: cards });
}

/**
 * 获取播放链接（修复网盘链接捕获）
 * @param {object} ext - 包含url（帖子ID）
 * @returns {Promise<string>} 格式化后的播放链接JSON
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) {
    log("详情URL为空");
    return jsonify({ list: [] });
  }
  
  log(`获取详情数据: url=${url}`);
  
  // 修复：确保详情接口URL正确拼接
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  
  // 修复：处理详情数据为空的情况
  if (!data || !data.list) {
    log("未获取到详情数据");
    return jsonify({ list: [{ title: '资源列表', tracks: [] }] });
  }
  
  const tracks = [];
  data.list.forEach(item => {
    if (item.vod_play_url) {
      // 修复：兼容多种链接分隔符
      const separators = ['$$$', '|||', ',', ';'];
      let playUrls = [item.vod_play_url];
      separators.forEach(sep => {
        if (item.vod_play_url.includes(sep)) {
          playUrls = item.vod_play_url.split(sep);
        }
      });
      playUrls.forEach((playUrl, index) => {
        if (playUrl.trim()) {
          let name = `网盘链接 ${index + 1}`;
          if (playUrl.includes('pan.baidu.com')) name = `百度网盘 ${index + 1}`;
          else if (playUrl.includes('aliyundrive.com')) name = `阿里云盘 ${index + 1}`;
          else if (playUrl.includes('thunder://')) name = `迅雷链接 ${index + 1}`;
          
          tracks.push({
            name: name,
            id: playUrl.trim()
          });
        }
      });
    }
  });
  
  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

/**
 * 搜索功能（修复搜索无结果问题）
 * @param {object} ext - 包含搜索关键词text
 * @returns {Promise<string>} 格式化后的搜索结果JSON
 */
async function search(ext) {
  ext = argsify(ext);
  const { text } = ext;
  if (!text || text.trim() === '') {
    log("搜索关键词为空");
    return jsonify({ list: [] });
  }
  
  const keyword = text.trim();
  log(`执行搜索: keyword=${keyword}`);
  
  // 修复：搜索接口URL正确拼接
  const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}`;
  const data = await request(url);
  
  if (!data || !data.list) {
    log("搜索结果为空");
    return jsonify({ list: [] });
  }
  
  const cards = data.list.map(item => ({
    vod_id: item.vod_id || `thread-${Math.random().toString(36).substr(2, 9)}.htm`,
    vod_name: item.vod_name || '未知标题',
    vod_pic: item.vod_pic || 'default_pic.png',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id }
  }));
  
  log(`搜索完成，返回 ${cards.length} 条结果`);
  return jsonify({ list: cards });
}

/**
 * 获取播放信息
 * @param {object} ext - 包含pan（网盘链接）
 * @returns {Promise<string>} 格式化后的播放信息JSON
 */
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext;
  if (!pan) {
    log("网盘链接为空");
    return jsonify({ urls: [] });
  }
  
  log(`获取播放信息: pan=${pan}`);
  return jsonify({ urls: [pan] });
}

/**
 * 获取配置信息
 * @returns {Promise<string>} 格式化后的配置JSON
 */
async function getConfig() {
  log("获取配置信息");
  const url = `${API_BASE_URL}/config`;
  const data = await request(url);
  
  // 补充分类配置（确保页面能加载到分类列表）
  const appConfig = {
    ver: 1,
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

// 兼容XPTV App标准接口
async function init() {
  log("初始化插件");
  return getConfig();
}

async function home() {
  log("获取首页数据");
  const config = await getConfig();
  return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg, filter, extend) {
  log(`分类数据: tid=${tid}, pg=${pg}`);
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg });
}

async function detail(id) {
  log(`详情数据: id=${id}`);
  return getTracks({ url: id });
}

async function play(flag, id) {
  log(`播放数据: flag=${flag}, id=${id}`);
  return getPlayinfo({ pan: id });
}

// 日志输出函数
function log(message) {
  try { $log(`[网盘资源社插件] ${message}`); } 
  catch (_) { console.log(`[网盘资源社插件] ${message}`); }
}
