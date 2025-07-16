// --- 配置区 ---
const API_BASE_URL = 'http://192.168.10.111:3000/api'; 
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

// 获取卡片数据（补充图片显示）
async function getCards(ext) {
  ext = argsify(ext);
  const { id, page = 1 } = ext;
  const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
  const data = await request(url);
  const cards = (data.list || []).map(item => ({
    vod_id: item.vod_id,
    vod_name: item.vod_name,
    vod_pic: item.vod_pic || '', // 现在能获取到图片
    vod_remarks: item.vod_remarks || ''
  }));
  return jsonify({ list: cards });
}

// 获取播放链接（修复链接解析）
async function getTracks(ext) {
  const { url } = ext;
  const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
  const data = await request(detailUrl);
  if (data.list && data.list.length > 0) {
    const tracks = data.list[0].tracks.map(track => ({
      name: track.name,
      id: track.pan // 直接使用解析后的网盘链接
    }));
    return jsonify({ list: [{ title: '资源列表', tracks }] });
  }
  return jsonify({ list: [] });
}

// 保留原有兼容函数
async function category(tid, pg, filter, extend) {
  const id = typeof tid === 'object' ? tid.id : tid;
  return getCards({ id: id, page: pg });
}
async function detail(id) {
  return getTracks({ url: id });
}
async function play(flag, id) {
  return getPlayinfo({ pan: id });
