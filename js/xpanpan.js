// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

// XPTV App 环境提供的全局函数，这里只是为了代码检查不报错，实际由App提供
// const cheerio = createCheerio(); // 如果后端返回JSON，则不需要cheerio
// function $log(msg) { /* App will provide this */ }
// function jsonify(obj) { /* App will provide this */ return JSON.stringify(obj); }
// function argsify(ext) { /* App will provide this */ return ext; }

function log(msg) {
  try { $log(`[网盘资源社插件] ${msg}`); } catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}

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

    const data = JSON.parse(response.data); // $fetch.get 返回的 data 可能是字符串，需要手动解析

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
// 按照用户原始脚本的结构，直接定义全局函数

async function getConfig() {
  log(`插件初始化，后端API地址: ${API_BASE_URL}`);
  // 尝试调用后端健康检查接口，确认连通性
  await request(`${API_BASE_URL}/health`); 

  const appConfig = {
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL, // 这里不再是原始网站，而是后端API地址
    cookie: '', // 移除手动Cookie，由后端处理
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
  ext = argsify(ext); // 确保 ext 被正确解析
  const { page = 1, id } = ext;
  
  log(`获取分类数据: id=${id}, page=${page}`);
  
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_url || item.vod_id }, // 确保ext.url有值，优先使用vod_url，否则使用vod_id
  }));

  return jsonify({ list: cards });
}

async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext; // 这里的url是getCards返回的item.vod_url或vod_id
  if (!url) return jsonify({ list: [] });

  log(`获取详情数据: url=${url}`);
  // 假设后端detail接口可以直接处理这个url作为id
  // 如果url是完整的，后端会解析；如果只是vod_id，后端也应该能处理
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);

  const tracks = [];
  if (data.list && data.list.length > 0) {
    // 假设后端返回的list中第一个元素就是详情数据，且包含play_url
    const detailItem = data.list[0];
    if (detailItem.vod_play_url) {
      // 假设vod_play_url是一个字符串，包含多个链接用$$$分隔
      const playUrls = detailItem.vod_play_url.split('$$$');
      playUrls.forEach(playUrl => {
        if (playUrl.trim()) {
          tracks.push({
            name: '网盘链接',
            pan: playUrl.trim(),
            ext: {},
          });
        }
      });
    }
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext; // 这里的pan是getTracks返回的网盘链接
  log(`请求播放: url=${pan}`);
  return jsonify({ urls: [pan] }); // 直接返回网盘链接让播放器处理
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
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_url || item.vod_id },
  }));

  return jsonify({ list: cards });
}

// 原始脚本中的 autoReply 和 extractPanLinks 等函数不再需要，因为后端处理了
// sleep 函数也不再需要，因为我们不直接操作网页

// 兼容旧的 init, home, category, detail, search, play 接口
// XPTV App 可能会调用这些函数，所以需要保留
async function init() {
  return getConfig();
}

async function home() {
  const config = await getConfig();
  return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg, filter, extend) {
  const id = typeof tid === 'object' ? tid.id : tid; // 兼容 tid 可能是对象的情况
  return getCards({ id: id, page: pg });
}

async function detail(id) {
  // XPTV App 的 detail 接口传入的id，通常是getCards返回的vod_id (thread-xxx.htm)
  // 这里的id就是我们需要的，直接传递给getTracks
  return getTracks({ url: id });
}

async function play(flag, id) {
  // XPTV App 的 play 接口传入的id，就是getPlayinfo需要的pan
  return getPlayinfo({ pan: id });
}


