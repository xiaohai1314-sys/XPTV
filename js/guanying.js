/**
 * =======================================================================
 * ==                                                                   ==
 * ==                     观影网 - 后端代理服务 (Node.js)                   ==
 * ==                                                                   ==
 * =======================================================================
 *
 * 功能:
 * - 作为 XPTV App 插件的前置代理，爬取 "观影网" 网站内容。
 * - 自动处理登录、Cookie 维持。
 * - 提供标准化的API接口供前端调用。
 */

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // 启用CORS

// --- 1. 全局变量与配置 ---
const SITE_URL = "https://www.gying.org";
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)";
// 请注意：Cookie有有效期，如果失效，请替换为您的有效Cookie
const COOKIE = "BT_auth=2c8fPECC1SI3ZwBxM4x5tAT_o_DUiRHAQnuN3L5H19o6c92YXWfgU7F2cx8v4Mjz4KNpjbmamhfMyg1tLQLR1LcJTD6ygN9NwAZWgSWIZ8EIU9fseUg0Xn-VThtIMdeXTi9wwE_hLjr_myCwNMoaJEwEekaCZVPr-x3MRqV91IbZxEUF9PPXRw;BT_cookietime=bb42AxkxuuufNMDq9B2C9EYsYRCSfb4vWkxzVNsexGTryT4vPnGs;browser_verified=b142dc23ed95f767248f452739a94198;";

const getHeaders = () => ({
  "User-Agent": USER_AGENT,
  "Cookie": COOKIE,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
});

async function safeRequest(url, config = {}) {
  try {
    const response = await axios.get(url, {
      headers: getHeaders(),
      timeout: 15000, // 15秒超时
      ...config,
    });
    return response;
  } catch (error) {
    console.error(`请求失败 ${url}: ${error.message}`);
    return null;
  }
}

// --- 2. API 路由 ---

/**
 * [GET] /api/vod - 获取分类列表
 */
app.get("/api/vod", async (req, res) => {
  const { type_id, page = 1 } = req.query;
  console.log(`[分类] 收到请求: type_id=${type_id}, page=${page}`);

  try {
    const url = `${SITE_URL}/${type_id}${page}`;
    const response = await safeRequest(url);

    if (!response) {
      return res.json({ error: "网络请求失败", list: [], total: 0 });
    }

    const $ = cheerio.load(response.data);

    let scriptContent = null;
    $("script").each((i, script) => {
      const scriptHtml = $(script).html();
      if (scriptHtml && scriptHtml.includes("_obj.inlist")) {
        scriptContent = scriptHtml;
        return false;
      }
    });

    if (!scriptContent) {
      return res.json({ error: "未找到数据脚本", list: [], total: 0 });
    }

    const inlistMatch = scriptContent.match(/_obj\.inlist\s*=\s*({.*?});/);
    if (!inlistMatch || !inlistMatch[1]) {
      return res.json({ error: "未找到影片列表数据", list: [], total: 0 });
    }

    const inlistData = JSON.parse(inlistMatch[1]);
    const list_data = [];

    inlistData.i.forEach((item_id, i) => {
      list_data.push({
        vod_id: `${inlistData.ty}/${item_id}`, // 传递 "类型/ID" 格式，如 "mv/Bnme"
        vod_name: inlistData.t[i] || "N/A",
        vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item_id}.webp`,
        vod_remarks: inlistData.g[i] || "",
      });
    });

    console.log(`[分类] 成功抓取 ${list_data.length} 条数据`);
    res.json({ list: list_data, total: list_data.length, page: parseInt(page), pagecount: 99 });
  } catch (error) {
    console.error(`[分类] 接口错误: ${error.message}`);
    res.status(500).json({ error: error.message, list: [], total: 0 });
  }
});

/**
 * [GET] /api/search - 搜索接口
 */
app.get("/api/search", async (req, res) => {
  const keyword = req.query.keyword || req.query.wd;
  console.log(`[搜索] 收到请求: keyword=${keyword}`);

  if (!keyword) {
    return res.json({ error: "缺少关键词", list: [], total: 0 });
  }

  try {
    const searchUrl = `${SITE_URL}/s/1---1/${encodeURIComponent(keyword)}`;
    const response = await safeRequest(searchUrl);

    if (!response) {
      return res.json({ error: "网络请求失败", list: [], total: 0 });
    }

    const $ = cheerio.load(response.data);
    const list_data = [];

    $(".v5d").each((i, element) => {
      const link_elem = $(element).find("a");
      const path = (link_elem.attr("href") || "").replace('.html', ''); // 得到 /mv/Bnme
      
      list_data.push({
        vod_id: path.startsWith('/') ? path.substring(1) : path, // 得到 mv/Bnme
        vod_name: $(element).find("b").text().trim() || "N/A",
        vod_pic: $(element).find("picture source[data-srcset]").attr("data-srcset") || "",
        vod_remarks: $(element).find("p").text().trim() || "",
      });
    });

    console.log(`[搜索] 成功抓取 ${list_data.length} 条数据`);
    res.json({ list: list_data, total: list_data.length });
  } catch (error) {
    console.error(`[搜索] 接口错误: ${error.message}`);
    res.status(500).json({ error: error.message, list: [], total: 0 });
  }
});

/**
 * [GET] /api/detail - 获取详情，直接请求JSON接口获取播放链接
 */
app.get("/api/detail", async (req, res) => {
  const id_param = req.query.id;
  console.log(`[详情] 收到请求: id=${id_param}`);

  if (!id_param) {
    return res.json({ error: "缺少ID", list: [] });
  }

  try {
    const detail_url = `${SITE_URL}/res/downurl/${id_param}`;
    console.log(`[详情] 正在请求数据接口: ${detail_url}`);
    
    const response = await safeRequest(detail_url, { responseType: 'json' });

    if (!response || response.status !== 200 || typeof response.data !== 'object') {
      console.error(`[详情] 从 ${detail_url} 获取数据失败或格式不正确`);
      return res.json({ error: "网络请求失败或响应格式错误", list: [] });
    }

    const data = response.data;
    const play_url_parts = [];

    if (data.panlist && data.panlist.url && data.panlist.name) {
      data.panlist.url.forEach((item_url, i) => {
        const displayName = data.panlist.name[i] || `资源${i + 1}`;
        play_url_parts.push(`${displayName}$${item_url}`);
      });
      console.log(`[详情] 成功解析 ${data.panlist.url.length} 条 panlist 资源`);
    } else {
      console.log("[详情] 未找到 panlist 数据");
    }
    
    if (data.file) {
        play_url_parts.push("提示：此资源需要网页验证$");
    }

    if (play_url_parts.length === 0) {
        play_url_parts.push("没有找到可用的资源$");
    }

    const result = {
      list: [{
        vod_id: id_param,
        vod_name: `资源列表`,
        vod_play_from: "网盘",
        vod_play_url: play_url_parts.join("$$$"),
      }],
    };

    res.json(result);

  } catch (error) {
    console.error(`[详情] 接口捕获到错误: ${error.message}`);
    if (error.response) {
        res.status(500).json({ error: `目标服务器错误: ${error.response.status}`, list: [] });
    } else {
        res.status(500).json({ error: '请求超时或无响应', list: [] });
    }
  }
});


// --- 3. 服务器启动 ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log("  观影网后端代理服务 (Node.js) 已启动  ");
  console.log("==========================================");
  console.log(`  监听地址: http://0.0.0.0:${PORT}  `);
  console.log("==========================================");
});


/**
 * =======================================================================
 * ==                                                                   ==
 * ==                      观影网 - 前端脚本 (局域网版)                     ==
 * ==                                                                   ==
 * =======================================================================
 * 
 * 功能:
 * - 与局域网内的后端API交互，获取观影网的内容
 * - 支持分类浏览、搜索、详情查看
 * - 完全兼容现有手机App环境
 */

// --- 配置区 ---
// 请将此地址替换为您电脑上运行的后端服务地址
// 例如：如果您的电脑IP是 192.168.1.100，则设置为 'http://192.168.1.100:3001/api'
const API_BASE_URL = 'http://127.0.0.1:3001/api'; 
// --- 配置区 ---

const appConfig = {
	ver: 1,
	title: '观影网',
	site: API_BASE_URL,
	tabs: [
		{ name: '电影', ext: { id: 'mv?page=' } },
		{ name: '剧集', ext: { id: 'tv?page=' } },
		{ name: '动漫', ext: { id: 'ac?page=' } }
	],
}

async function getConfig() {
	return jsonify(appConfig);
}

async function getCards(ext) {
	ext = argsify(ext);
	let { page = 1, id } = ext;
	
	try {
		const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
		const { data } = await $fetch.get(url, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		
		if (result.error) {
			console.log(`后端错误: ${result.error}`);
			return jsonify({ list: [] });
		}
		
		const cards = (result.list || []).map(item => ({
			vod_id: item.vod_id,
			vod_name: item.vod_name,
			vod_pic: item.vod_pic || '',
			vod_remarks: item.vod_remarks || '',
			ext: { url: item.vod_id },
		}));
		
		return jsonify({ list: cards });
		
	} catch (error) {
		console.log(`获取分类数据失败: ${error.message}`);
		return jsonify({ list: [] });
	}
}

async function getTracks(ext) {
	ext = argsify(ext);
	let { url } = ext;
	
	if (!url) {
		console.log('获取详情失败: 缺少URL参数');
		return jsonify({ list: [] });
	}
	
	// --- 前端优化：清理ID，确保只传递最后一部分给后端 ---
	const parts = url.split('/');
	const cleanId = parts[parts.length - 1];
	console.log(`原始URL: ${url}, 清理后的ID: ${cleanId}`);
	// --- 清理结束 ---

	try {
		const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(cleanId)}`;
		const { data } = await $fetch.get(detailUrl, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		
		if (result.error || !result.list || result.list.length === 0) {
			console.log(`获取详情数据失败: ${result.error || '无有效列表'}`);
			return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败', pan: '', ext: {} }] }] });
		}
		
		const tracks = [];
		const detailItem = result.list[0];
		
		if (detailItem.vod_play_url && detailItem.vod_play_url.trim() !== '') {
			const playUrls = detailItem.vod_play_url.split('$$$');
			playUrls.forEach(playUrl => {
				if (playUrl.trim()) {
					const urlParts = playUrl.split('$');
					const panName = urlParts[0] || '未知资源';
					const cleanUrl = urlParts[1] || '';
					tracks.push({ name: panName, pan: cleanUrl, ext: {} });
				}
			});
		}
		
		if (tracks.length === 0) {
			tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
		}
		
		return jsonify({ list: [{ title: '资源列表', tracks }] });
		
	} catch (error) {
		console.log(`获取详情失败: ${error.message}`);
		return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '网络请求失败', pan: '', ext: {} }] }] });
	}
}

async function search(ext) {
	ext = argsify(ext);
	let text = ext.text || '';
	
	if (!text) {
		console.log('搜索失败: 缺少关键词');
		return jsonify({ list: [] });
	}
	
	try {
		const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
		const { data } = await $fetch.get(url, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		
		if (result.error) {
			console.log(`搜索失败: ${result.error}`);
			return jsonify({ list: [] });
		}
		
		const cards = (result.list || []).map(item => ({
			vod_id: item.vod_id,
			vod_name: item.vod_name,
			vod_pic: item.vod_pic || '',
			vod_remarks: item.vod_remarks || '',
			ext: { url: item.vod_id },
		}));
		
		return jsonify({ list: cards });
		
	} catch (error) {
		console.log(`搜索失败: ${error.message}`);
		return jsonify({ list: [] });
	}
}

async function getPlayinfo(ext) {
	ext = argsify(ext);
	return jsonify({ urls: [ext.url] });
}

