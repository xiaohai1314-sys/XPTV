/**
 * wpzysq.js
 * 放在: /storage/emulated/0/TVBox/wpzysq.js
 * TVBox/猫爪里选择「自定义源」, 类型=3, 路径填: file:///storage/emulated/0/TVBox/wpzysq.js
 * 一定能出页面!
 */

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
    const page = pg || 1;
    const url = `${siteUrl}/vod?type_id=${tid}&page=${page}`;
    const res = await request(url);
    console.log('【调试】分类返回:', JSON.stringify(res));
    return {
      list: res.list || [],
      page: page,
      pagecount: 10,
      limit: 20,
      total: res.total || 200
    };
  },

  async detail(id) {
    const url = `${siteUrl}/detail?id=${id}`;
    const res = await request(url);
    console.log('【调试】详情返回:', JSON.stringify(res));
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
    const url = `${siteUrl}/search?keyword=${encodeURIComponent(wd)}`;
    const res = await request(url);
    console.log('【调试】搜索返回:', JSON.stringify(res));
    return {
      list: res.list || [],
      page: 1,
      pagecount: 1,
      limit: 20,
      total: res.total || 0
    };
  },

  async play(flag, id) {
    return {
      parse: 1,
      url: id
    };
  }
};

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
