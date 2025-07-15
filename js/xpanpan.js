/**
 * 网盘资源社 - 前端插件 (最终修复版 v3)
 *
 * 版本说明：
 * - 采用稳定的后端通信框架。
 * - 精确匹配用户原始脚本的 class/tabs 结构 (包含 name 和 ext)。
 * - 移除冗余代码，提升性能和可维护性。
 */

// --- 配置区 ---
// 在这里填入你后端服务的实际IP地址和端口
const API_BASE_URL = 'http://192.168.1.6:3000/api'; 
// --- 配置区 ---

/**
 * 打印日志
 * @param {string} message 日志信息
 */
function log(message) {
  console.log(`[网盘资源社插件] ${message}`);
}

/**
 * 封装网络请求，处理错误和超时
 * @param {string} url 请求的URL
 * @returns {Promise<object>} 返回解析后的JSON数据或错误对象
 */
async function request(url) {
  log(`发起请求: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    return { error: true, message: error.message, list: [] };
  }
}

export default {
  /**
   * 初始化插件
   */
  async init() {
    log(`插件初始化，后端API地址: ${API_BASE_URL}`);
    await request(`${API_BASE_URL}/health`); // 测试后端连通性
    return {};
  },

  /**
   * 获取首页数据（分类）- 按照您指定的 class 结构
   */
  async home() {
    log('获取首页分类数据');
    return {
      // **关键修改：完全按照您的要求调整 class 数组的结构**
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
      // filters 部分可以保留或移除，取决于您的前端是否使用
      filters: {} 
    };
  },

  /**
   * 获取分类列表数据
   * @param {string | {id: string}} tid 分类ID (可能是字符串或对象)
   * @param {string} pg 页码
   * @param {boolean} filter 是否筛选
   * @param {object} extend 扩展参数
   */
  async category(tid, pg, filter, extend) {
    // **关键修改：兼容您指定的 class 结构，从 ext 对象中获取 id**
    const type_id = typeof tid === 'object' ? tid.id : tid;
    const page = pg || 1;
    
    log(`获取分类数据: id=${type_id}, page=${page}`);
    
    const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(type_id)}&page=${page}`;
    const data = await request(url);

    return {
      list: data.list || [],
      page: page,
      pagecount: data.total > 0 ? page + 1 : page,
      limit: 20,
      total: data.total || 0,
    };
  },

  /**
   * 获取详情页数据
   * @param {string} id 视频ID
   */
  async detail(id) {
    log(`获取详情数据: id=${id}`);
    const url = `${API_BASE_URL}/detail?id=${encodeURIComponent(id)}`;
    const data = await request(url);
    
    return {
      list: data.list || [],
    };
  },

  /**
   * 搜索功能
   * @param {string} wd 搜索关键词
   */
  async search(wd) {
    log(`执行搜索: keyword=${wd}`);
    if (!wd) return { list: [] };

    const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(wd)}`;
    const data = await request(url);

    return {
      list: data.list || [],
    };
  },

  /**
   * 获取播放链接
   * @param {string} flag 播放源标识
   * @param {string} id 播放链接
   */
  async play(flag, id) {
    log(`请求播放: flag=${flag}, url=${id}`);
    return {
      parse: 0,
      url: id,
    };
  },
};

