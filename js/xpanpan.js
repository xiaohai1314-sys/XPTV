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
    return {
      list: res.list || []
    };
  },

  async search(wd, quick) {
    const res = await request(`${siteUrl}/search?wd=${encodeURIComponent(wd)}`);
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

// 请求封装
async function request(url) {
  try {
    const res = await req_fetch(url);
    return JSON.parse(res);
  } catch (e) {
    console.error("请求失败:", url, e);
    return {};
  }
}

async function req_fetch(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  return await res.text();
}
