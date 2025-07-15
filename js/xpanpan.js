import { Crypto, load, _ } from 'assets://js/lib/cat.js';

// ✅ 改成你的实际服务器地址
const siteUrl = 'http://192.168.1.6:3000/api';

export default {
  async init() {
    return {};
  },

  async home(filter) {
    // ✅ ✅ ✅ 分类只保留纯 forum 路径，不要带 ?page=
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
    const page = pg || 1;
    // ✅ 拼 page 只在这里拼，不要在 home 里写死
    const res = await request(`${siteUrl}/vod?type_id=${tid}&page=${page}`);
    return {
      list: res.list || [],
      page: page,
      pagecount: 10, // 你可以改成实际总页数
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

  async search(wd) {
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
      parse: 1,
      url: id // 这里就是 detail 里返回的 hidden
    };
  }
};

// ============= 请求封装 =============
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
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  });
  return await res.text();
}
