/**
 * 网盘资源社 - 前端插件 (XPTV App 适配版)
 *
 * 适配内容：
 * - 使用 XPTV App 环境提供的 `$fetch` 进行网络请求。
 * - 使用 XPTV App 环境提供的 `$log` 进行日志输出。
 * - 使用 XPTV App 环境提供的 `jsonify` 封装返回数据。
 * - 移除 `cheerio` 依赖，因为后端返回 JSON。
 * - 移除手动 Cookie 管理，由后端统一处理。
 * - 保持与 Node.js 后端 API 的通信逻辑。
 */

// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
// 请务必确保这个地址是前端设备可以访问到的！
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

/**
 * 打印日志 (适配 XPTV App 的 $log)
 * @param {string} message 日志信息
 */
function log(message) {
  try { $log(`[网盘资源社插件] ${message}`); } catch (_) { console.log(`[网盘资源社插件] ${message}`); }
}

/**
 * 封装网络请求，处理错误和超时 (适配 XPTV App 的 $fetch)
 * @param {string} url 请求的URL
 * @returns {Promise<object>} 返回解析后的JSON数据或错误对象
 */
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    // XPTV App 的 $fetch 可能没有 AbortController 和 timeout 选项，
    // 这里假设它支持 headers 和 timeout。
    // 如果实际不支持，可能需要更简单的 $fetch.get(url) 调用。
    const response = await $fetch.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000, // 15秒超时
    });

    // $fetch 返回的可能是 { data, status } 结构
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

export default {
  /**
   * 初始化插件
   */
  async init() {
    log(`插件初始化，后端API地址: ${API_BASE_URL}`);
    // 尝试调用后端健康检查接口，确认连通性
    await request(`${API_BASE_URL}/health`); 
    return jsonify({}); // XPTV App 插件需要 jsonify 返回
  },

  /**
   * 获取首页数据（分类）
   */
  async home() {
    log('获取首页分类数据');
    const homeData = {
      class: [
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
      filters: {} 
    };
    return jsonify(homeData); // XPTV App 插件需要 jsonify 返回
  },

  /**
   * 获取分类列表数据
   * @param {string | {id: string}} tid 分类ID (可能是字符串或对象)
   * @param {string} pg 页码
   * @param {boolean} filter 是否筛选
   * @param {object} extend 扩展参数
   */
  async category(tid, pg, filter, extend) {
    const type_id = typeof tid === 'object' ? tid.id : tid;
    const page = pg || 1;
    
    log(`获取分类数据: id=${type_id}, page=${page}`);
    
    const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(type_id)}&page=${page}`;
    const data = await request(url);

    const categoryData = {
      list: data.list || [],
      page: page,
      pagecount: data.total > 0 ? page + 1 : page,
      limit: 20,
      total: data.total || 0,
    };
    return jsonify(categoryData); // XPTV App 插件需要 jsonify 返回
  },

  /**
   * 获取详情页数据
   * @param {string} id 视频ID
   */
  async detail(id) {
    log(`获取详情数据: id=${id}`);
    const url = `${API_BASE_URL}/detail?id=${encodeURIComponent(id)}`;
    const data = await request(url);
    
    const detailData = {
      list: data.list || [],
    };
    return jsonify(detailData); // XPTV App 插件需要 jsonify 返回
  },

  /**
   * 搜索功能
   * @param {string} wd 搜索关键词
   */
  async search(wd) {
    log(`执行搜索: keyword=${wd}`);
    if (!wd) return jsonify({ list: [] });

    const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(wd)}`;
    const data = await request(url);

    const searchData = {
      list: data.list || [],
    };
    return jsonify(searchData); // XPTV App 插件需要 jsonify 返回
  },

  /**
   * 获取播放链接
   * @param {string} flag 播放源标识
   * @param {string} id 播放链接
   */
  async play(flag, id) {
    log(`请求播放: flag=${flag}, url=${id}`);
    const playData = {
      parse: 0,
      url: id,
    };
    return jsonify(playData); // XPTV App 插件需要 jsonify 返回
  },
};

