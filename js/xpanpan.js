import { Crypto, load, _ } from 'assets://js/lib/cat.js';

// 注意：替换为你的服务器实际IP和端口
const siteUrl = 'http://192.168.1.6:3000/api';

export default {
  async init() {
    return {};
  },

  async home(filter) {
    return {
      class: [
        {
          type_name: '影视/剧集',
          type_id: 'forum-1.htm?page='
        },
        {
          type_name: '4K专区',
          type_id: 'forum-12.htm?page='
        },
        {
          type_name: '动漫区',
          type_id: 'forum-3.htm?page='
        }
      ]
    };
  },

  async category(tid, pg, filter, extend) {
    const res = await request(`${siteUrl}/vod?type_id=${tid}&page=${pg || 1}`);
    
    // 添加错误处理
    if (res.error) {
      console.error('分类加载失败:', res.message);
      return {
        list: [],
        page: pg || 1,
        pagecount: 1,
        limit: 20,
        total: 0
      };
    }
    
    return {
      list: res.list || [],
      page: pg || 1,
      pagecount: 10, // 根据实际情况调整
      limit: 20,
      total: res.total || 200
    };
  },

  async detail(id) {
    const res = await request(`${siteUrl}/detail?id=${id}`);
    
    // 添加错误处理
    if (res.error) {
      console.error('详情加载失败:', res.message);
      return {
        list: []
      };
    }
    
    return {
      list: res.list || []
    };
  },

  async search(wd, quick) {
    // 修复：使用正确的参数名 keyword
    const res = await request(`${siteUrl}/search?keyword=${encodeURIComponent(wd)}`);
    
    // 添加错误处理
    if (res.error) {
      console.error('搜索失败:', res.message);
      return {
        list: [],
        page: 1,
        pagecount: 1,
        limit: 20,
        total: 0
      };
    }
    
    return {
      list: res.list || [],
      page: 1,
      pagecount: 1,
      limit: 20,
      total: res.total || 0
    };
  },

  async play(flag, id, flags) {
    return {
      parse: 1,  // 需要客户端解析网盘链接
      url: id
    };
  }
};

// 请求封装（改进错误处理）
async function request(url) {
  try {
    const res = await req_fetch(url);
    const data = JSON.parse(res);
    
    // 检查是否有错误信息
    if (data.error) {
      console.error("API错误:", data.error);
      return {
        error: true,
        message: data.error,
        list: [],
        total: 0
      };
    }
    
    return data;
  } catch (e) {
    console.error("请求失败:", url, e);
    
    // 返回更明确的错误信息
    return {
      error: true,
      message: e.message || '网络请求失败',
      list: [],
      total: 0
    };
  }
}

async function req_fetch(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    return await res.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

