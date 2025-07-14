const appConfig = {
  ver: 1,
  title: '网盘资源社',
  site: 'https://www.wpzysq.com', 
  tabs: [
    {
      name: '影视/剧集',
      ext: { id: 'forum-1.htm?page='  },
    },
    {
      name: '4K专区',
      ext: { id: 'forum-12.htm?page='  },
    },
    {
      name: '动漫区',
      ext: { id: 'forum-3.htm?page='  },
    },
  ],
};
 
// 工具函数：参数解析
function argsify(ext) {
  return typeof ext === 'string' ? JSON.parse(ext)  : ext || {};
}
 
// 工具函数：JSON 包装器
function jsonify(data) {
  return JSON.stringify(data); 
}
 
// 工具函数：HTTP 请求封装 
const $fetch = {
  get: async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(),  options.timeout  || 10000);
 
    try {
      const res = await fetch(url, { ...options, signal: controller.signal  });
      clearTimeout(timeoutId);
      if (!res.ok)  throw new Error(`HTTP error! status: ${res.status}`); 
      const text = await res.text(); 
      return { data: text, status: res.status  };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Fetch  error:', err);
      return { data: null, status: 500 };
    }
  },
};
 
// 创建 Cheerio 实例用于 HTML 解析
function createCheerio() {
  return window.cheerio  || require('cheerio');
}
 
// 获取分类卡片列表（分页）
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  const url = `${appConfig.site}/${id}${page}`; 
 
  const { data, status } = await $fetch.get(url,  {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
 
  if (status !== 200) return jsonify({ list: [] });
 
  const $ = createCheerio().load(data);
  const cards = [];
 
  $('li[data-href^="thread-"]').each((i, el) => {
    const href = $(el).attr('data-href');
    const title = $(el).find('a').text().trim();
    let pic = $(el).find('img').attr('src') || '';
    if (pic && !pic.startsWith('http'))  {
      pic = pic.startsWith('/')  ? `${appConfig.site}${pic}`  : pic;
    }
 
    if (href && title) {
      cards.push({ 
        vod_id: href,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: '',
        ext: {
          url: new URL(href, appConfig.site).href, 
        },
      });
    }
  });
 
  // 获取总页数 
  let pagecount = 1;
  try {
    const lastPageLink = $('.pg .last a').attr('href');
    const match = lastPageLink.match(/page=(\d+)/); 
    if (match) pagecount = parseInt(match[1]);
  } catch (e) {
    console.log('⚠️  分页信息未找到');
  }
 
  return jsonify({ list: cards, page, pagecount });
}
 
// 搜索接口
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text  || '';
  const page = Math.max(1,  parseInt(ext.page)  || 1);
  if (!text) return jsonify({ list: [] });
 
  const api = `/api/search?keyword=${encodeURIComponent(text)}&page=${page}`;
  const { data, status } = await $fetch.get(api,  { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });
 
  return data;
}
 
// 获取资源链接（自动回帖逻辑由后端处理）
async function getTracks(ext) {
  ext = argsify(ext);
  const { url } = ext;
  if (!url) return jsonify({ list: [] });
 
  const api = `/api/getTracks?url=${encodeURIComponent(url)}`;
  const { data, status } = await $fetch.get(api,  { timeout: 20000 });
  if (status !== 200) return jsonify({ list: [] });
 
  return data;
}
 
// 播放信息（可选）
async function getPlayinfo() {
  return jsonify({ urls: [] });
}
 
// 暴露接口
export default {
  getConfig: () => jsonify(appConfig),
  getCards,
  search,
  getTracks,
  getPlayinfo,
};
