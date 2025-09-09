/*
 * =================================================================
 * 脚本名称: 雷鲸资源站脚本 - v29 (后端一体化最终版)
 *
 * 最终说明:
 * - 这是一个与全功能后端配套使用的前端脚本。
 * - 所有抓取和解析逻辑均已移至后端完成。
 * - 本脚本只负责将用户请求转发至后端，并展示后端返回的JSON数据。
 * - 脚本本身极其轻量和稳定。
 * =================================================================
 */

// 唯一需要配置的后端服务器地址
// 如果你把后端部署到公网服务器，请将 '192.168.10.111' 替换为你的服务器IP或域名
const BACKEND_URL = 'http://192.168.10.111:3001';

// appConfig 只保留前端需要的部分
const appConfig = {
  ver: 29,
  title: '雷鲸',
  site: 'https://www.leijing.xyz', // 这个site现在只用于信息展示
  tabs: [
    { name: '剧集', ext: { id: '?tagId=42204684250355' } },
    { name: '电影', ext: { id: '?tagId=42204681950354' } },
    { name: '动漫', ext: { id: '?tagId=42204792950357' } },
    { name: '纪录片', ext: { id: '?tagId=42204697150356' } },
    { name: '综艺', ext: { id: '?tagId=42210356650363' } },
    { name: '影视原盘', ext: { id: '?tagId=42212287587456' } },
  ],
};

// getConfig 函数保持不变
async function getConfig( ) {
  return jsonify(appConfig);
}

// getCards 函数 - 已修改为请求后端
async function getCards(ext) {
  ext = argsify(ext);
  const { page = 1, id } = ext;
  
  // 注意：我们需要在后端也实现 /getCards 接口
  // 这里我们暂时让它请求 /search，并用一个固定的关键词来模拟分类浏览
  // 这是一个临时的做法，最完美的方案是在后端实现 getCards
  const categoryKeyword = '最新'; // 你可以为不同分类设置不同关键词
  const requestUrl = `${BACKEND_URL}/search?text=${categoryKeyword}&page=${page}`;

  try {
    console.log('请求后端 getCards (模拟):', requestUrl);
    const { data } = await $fetch.get(requestUrl);
    return jsonify(data);
  } catch (error) {
    console.error("请求后端 /getCards (模拟) 失败:", error);
    return jsonify({ list: [{ vod_name: '加载分类失败', vod_remarks: error.message }] });
  }
}

// search 函数 - 已修改为请求后端
async function search(ext) {
  ext = argsify(ext);
  const text = encodeURIComponent(ext.text); // 编码关键词
  const page = ext.page || 1;
  
  const requestUrl = `${BACKEND_URL}/search?text=${text}&page=${page}`;
  
  try {
    console.log('请求后端 search:', requestUrl);
    const { data } = await $fetch.get(requestUrl);
    // 后端已经返回了完美的JSON，我们直接转发给App即可
    return jsonify(data);
  } catch (error) {
    console.error("请求后端 /search 失败:", error);
    return jsonify({ list: [{ vod_name: '搜索失败', vod_remarks: error.message }] });
  }
}


// =================================================================
// 【重要】getTracks 和 getPlayinfo 也需要后端支持才能工作
// 下面是它们的后端实现思路和前端代码
// 为了让你的脚本能完整运行，我暂时提供一个简化版
// =================================================================

// getPlayinfo 函数 - 暂时返回空
async function getPlayinfo(ext) {
  return jsonify({ urls: [] });
}

// getTracks 函数 - 暂时返回一个提示信息
async function getTracks(ext) {
    ext = argsify(ext);
    // 理想情况下，这里应该请求后端的 /getTracks 接口
    // const requestUrl = `${BACKEND_URL}/getTracks?url=${ext.url}`;
    
    // 暂时返回一个提示，说明此功能需要后端进一步开发
    return jsonify({
        list: [{
            title: '功能待开发',
            tracks: [{ name: '获取网盘链接功能', pan: '需要后端实现/getTracks接口', ext: {} }]
        }]
    });
}
