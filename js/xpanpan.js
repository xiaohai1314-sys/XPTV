import { Crypto, load, _ } from 'assets://js/lib/cat.js';

// ✅ 替换为你的实际服务器 IP + 端口
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
          type_id: 'forum-1.htm'
        },
        {
          type_name: '4K专区',
          type_id: 'forum-12.htm'
        },
        {
          type_name: '动漫区',
          type_id: 'forum-3.htm'
        }
      ]
    };
  },

  async category(tid, pg, filter, extend) {
    const res = await request(`${siteUrl}/vod?type_id=${tid}&page=${pg || 1}`);
    return {
      list: res.list || [],
      page: pg || 1,
      pagecount: 10, // 你可以按需要改
      limit: 20,
      total: res.total || 200
    };
  },

  async detail(id) {
    const res = await request(`${siteUrl}/detail?id=${id}`);
    return {
      list: [
        {
          vod_name: res.title || '',
          vod_content: res.message || '',
          vod_play_url: res.hidden || ''
        }
      ]
    };
  },

  async search(wd, quick) {
    const res = await request(`${siteUrl}/search?keyword=${encodeURIComponent(wd)}`);
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
      parse: 1, // 需要客户端解析
      url: id   // id 就是 hidden 里的网盘链接
    };
  }
};

// =========== 请求封装 =============
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
