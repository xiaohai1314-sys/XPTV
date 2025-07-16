// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
// 例如，如果后端和App在同一台电脑上运行，可以是 'http://127.0.0.1:3000/api'
// 如果在局域网内，可以是 'http://192.168.x.x:3000/api'
const API_BASE_URL = 'http://192.168.10.111:3000/api'; 
// --- 配置区 ---

// 假设这些函数由 XPTV App 环境提供
// function $log(msg) { console.log(msg); }
// function jsonify(obj) { return JSON.stringify(obj); }
// function argsify(ext) { return typeof ext === 'string' ? JSON.parse(ext) : ext; }
// const $fetch = { get: async (url) => { const res = await fetch(url); return { status: res.status, data: await res.text() }; } };

function log(msg) {
  try { $log(`[网盘资源社插件] ${msg}`); } catch (_) { console.log(`[网盘资源社插件] ${msg}`); }
}

/**
 * 封装网络请求，处理错误和超时
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
  await request(`${API_BASE_URL}/health`); 

  const appConfig = {
    ver: 1,
    title: '网盘资源社',
    site: API_BASE_URL,
    cookie: '',
    tabs: [
      { name: '影视/剧集', ext: { id: 'forum-1.htm' } },
      { name: '4K专区', ext: { id: 'forum-12.htm' } },
      { name: '动漫区', ext: { id: 'forum-3.htm' } },
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

  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '', // 使用后端抓取的封面
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id }, // ext.url 使用 vod_id
  }));

  return jsonify({ list: cards });
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
    if (detailItem.vod_play_url && detailItem.vod_play_url !== '暂无有效网盘链接') {
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
    } else {
        tracks.push({ name: '暂无资源', pan: '', ext: {} });
    }
  }

  return jsonify({ list: [{ title: '资源列表', tracks }] });
}

async function getPlayinfo(ext) {
  ext = argsify(ext);
  const { pan } = ext;
  log(`请求播放: url=${pan}`);
  if (!pan) return jsonify({ urls: [] });
  return jsonify({ urls: [pan] });
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
    vod_pic: item.vod_pic || '', // 搜索结果暂时无封面，除非后端也二次抓取
    vod_remarks: item.vod_remarks || '',
    ext: { url: item.vod_id },
  }));

  return jsonify({ list: cards });
}

// --- 兼容旧版 XPTV App 接口 ---
async function init() {
  return getConfig();
}

async function home() {
  const configStr = await getConfig();
  const config = JSON.parse(configStr);
  return jsonify({ class: config.tabs, filters: {} });
}

async function category(tid, pg, filter, extend) {
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg });
}

async function detail(id) {
  return getTracks({ url: id });
}

async function play(flag, id) {
  return getPlayinfo({ pan: id });
}

