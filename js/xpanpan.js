// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

// XPTV App 环境提供的全局函数，这里只是为了代码检查不报错，实际由App提供
function $log(msg) { console.log(`[App提供] ${msg}`); }
function jsonify(obj) { return JSON.stringify(obj); }
function argsify(ext) { return typeof ext === 'object' ? ext : {}; }

/**
 * 封装网络请求，处理错误和超时 (适配 XPTV App 的 $fetch)
 * @param {string} url 请求的URL
 * @returns {Promise<object>} 返回解析后的JSON数据或错误对象
 */
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const response = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000, // 15秒超时
    });
    if (response.status !== 200) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }
    const data = JSON.parse(response.data); // 手动解析确保兼容性
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

/**
 * 获取卡片数据（分类页面帖子，包含图片）
 * @param {object} ext - 包含id（分类ID）和page（页码）
 * @returns {Promise<string>} 格式化后的卡片数据JSON
 */
async function getCards(ext) {
  ext = argsify(ext);
  const { id, page = 1 } = ext;
  
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  
  // 构造卡片数据，确保图片显示（无图时用默认图）
  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || 'default_pic.png', // 补充默认图片避免空白
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id } // 传递原始ID用于详情页
  }));
  
  return jsonify({ list: cards });
}

/**
 * 获取播放链接（网盘链接处理）
 * @param {object} ext - 包含url（帖子ID）
 * @returns {Promise<string>} 格式化后的播放链接JSON
 */
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });
  
  log(`获取详情数据: url=${url}`);
  
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  
  if (data.list && data.list.length > 0) {
    const tracks = [];
    // 解析多网盘链接（按$$$拆分）
    data.list.forEach(item => {
      if (item.vod_play_url) {
        const playUrls = item.vod_play_url.split('$$$');
        playUrls.forEach((playUrl, index) => {
          if (playUrl.trim()) {
            // 识别不同网盘类型并命名
            let name = '网盘链接';
            if (playUrl.includes('pan.baidu.com')) name = '百度网盘';
            else if (playUrl.includes('aliyundrive.com')) name = '阿里云盘';
            else if (playUrl.includes('thunder://')) name = '迅雷链接';
            
            tracks.push({
              name: `${name} ${index + 1}`,
              id: playUrl.trim()
            });
          }
        });
      }
    });
    return jsonify({ list: [{ title: '资源列表', tracks }] });
  }
  
  return jsonify({ list: [] });
}

/**
 * 获取播放信息
 * @param {object} ext - 包含pan（网盘链接）
 * @returns {Promise<string>} 格式化后的播放信息JSON
 */
async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext;
  log(`获取播放信息: pan=${pan}`);
  return jsonify({ urls: [pan] }); // 直接返回网盘链接给播放器
}

/**
 * 获取配置信息
 * @returns {Promise<string>} 格式化后的配置JSON
 */
async function getConfig() {
  log("获取配置信息");
  const url = `${API_BASE_URL}/config`;
  const data = await request(url);
  
  // 补充分类配置（确保4K专区等显示）
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

/**
 * 搜索功能
 * @param {object} ext - 包含搜索关键词
 * @returns {Promise<string>} 格式化后的搜索结果JSON
 */
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
    vod_pic: item.vod_pic || 'default_pic.png',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));
  return jsonify({ list: cards });
}

// 兼容XPTV App调用的标准接口
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
