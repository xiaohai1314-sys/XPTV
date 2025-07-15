import { Crypto, load, _ } from 'assets://js/lib/cat.js';

// 注意：替换为你的服务器实际IP和端口
const siteUrl = 'http://192.168.1.6:3000/api';

export default {
  async init() {
    console.log('插件初始化，API地址:', siteUrl);
    return {};
  },

  async home(filter) {
    console.log('获取首页分类');
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
    console.log('获取分类数据:', { tid, pg });
    
    const res = await request(`${siteUrl}/vod?type_id=${tid}&page=${pg || 1}`);
    
    // 添加详细的错误处理和日志
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
    
    console.log('分类数据获取成功，条数:', res.list?.length || 0);
    
    return {
      list: res.list || [],
      page: pg || 1,
      pagecount: 10, // 根据实际情况调整
      limit: 20,
      total: res.total || 200
    };
  },

  async detail(id) {
    console.log('获取详情数据:', { id });
    
    const res = await request(`${siteUrl}/detail?id=${id}`);
    
    // 添加详细的错误处理和日志
    if (res.error) {
      console.error('详情加载失败:', res.message);
      return {
        list: []
      };
    }
    
    console.log('详情数据获取成功');
    
    return {
      list: res.list || []
    };
  },

  async search(wd, quick) {
    console.log('执行搜索:', { wd, quick });
    
    // 修复：使用正确的参数名 keyword
    const res = await request(`${siteUrl}/search?keyword=${encodeURIComponent(wd)}`);
    
    // 添加详细的错误处理和日志
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
    
    console.log('搜索数据获取成功，条数:', res.list?.length || 0);
    
    return {
      list: res.list || [],
      page: 1,
      pagecount: 1,
      limit: 20,
      total: res.total || 0
    };
  },

  async play(flag, id, flags) {
    console.log('播放请求:', { flag, id, flags });
    return {
      parse: 1,  // 需要客户端解析网盘链接
      url: id
    };
  }
};

// 请求封装（完善错误处理和日志）
async function request(url) {
  console.log('发起请求:', url);
  
  try {
    const res = await req_fetch(url);
    const data = JSON.parse(res);
    
    // 检查是否有错误信息
    if (data.error) {
      console.error("API返回错误:", data.error);
      return {
        error: true,
        message: data.error,
        list: [],
        total: 0
      };
    }
    
    console.log('请求成功:', url);
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
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const text = await res.text();
    console.log('响应内容长度:', text.length);
    
    return text;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    
    throw error;
  }
}

