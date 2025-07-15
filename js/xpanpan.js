import { Crypto, load, _ } from 'assets://js/lib/cat.js';

const siteUrl = 'http://192.168.1.6:3000/api';

export default {
  async init() {
    await logToBackend(`插件初始化，API地址: ${siteUrl}`);
    return {};
  },

  async home(filter) {
    await logToBackend(`获取首页分类`);
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
    await logToBackend(`获取分类数据: tid=${tid}, pg=${pg}`);
    const res = await request(`${siteUrl}/vod?type_id=${tid}&page=${pg || 1}`);
    
    if (res.error) {
      await logToBackend(`分类加载失败: ${res.message}`);
      return {
        list: [],
        page: pg || 1,
        pagecount: 1,
        limit: 20,
        total: 0
      };
    }

    await logToBackend(`分类数据获取成功，条数: ${res.list?.length || 0}`);
    return {
      list: res.list || [],
      page: pg || 1,
      pagecount: 10,
      limit: 20,
      total: res.total || 200
    };
  },

  async detail(id) {
    await logToBackend(`获取详情数据: id=${id}`);
    const res = await request(`${siteUrl}/detail?id=${id}`);
    
    if (res.error) {
      await logToBackend(`详情加载失败: ${res.message}`);
      return {
        list: []
      };
    }

    await logToBackend(`详情数据获取成功`);
    return {
      list: res.list || []
    };
  },

  async search(wd, quick) {
    await logToBackend(`执行搜索: wd=${wd}`);
    const res = await request(`${siteUrl}/search?keyword=${encodeURIComponent(wd)}`);
    
    if (res.error) {
      await logToBackend(`搜索失败: ${res.message}`);
      return {
        list: [],
        page: 1,
        pagecount: 1,
        limit: 20,
        total: 0
      };
    }

    await logToBackend(`搜索数据获取成功，条数: ${res.list?.length || 0}`);
    return {
      list: res.list || [],
      page: 1,
      pagecount: 1,
      limit: 20,
      total: res.total || 0
    };
  },

  async play(flag, id, flags) {
    await logToBackend(`播放请求: flag=${flag}, id=${id}`);
    return {
      parse: 1,
      url: id
    };
  }
};

// ==== 工具方法 ====

async function request(url) {
  await logToBackend(`发起请求: ${url}`);
  try {
    const res = await req_fetch(url);
    const data = JSON.parse(res);
    if (data.error) {
      await logToBackend(`API返回错误: ${data.error}`);
      return { error: true, message: data.error, list: [], total: 0 };
    }
    await logToBackend(`请求成功: ${url}`);
    return data;
  } catch (e) {
    await logToBackend(`请求失败: ${e.message}`);
    return { error: true, message: e.message || '网络请求失败', list: [], total: 0 };
  }
}

async function req_fetch(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await req(url); // 使用 XPTV 原生请求方法
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error.name === 'AbortError' ? new Error('请求超时') : error;
  }
}

async function logToBackend(msg) {
  try {
    await req(`${siteUrl.replace('/api', '')}/log?msg=${encodeURIComponent(msg)}`);
  } catch (e) {
    // 静默失败不影响主流程
  }
}
