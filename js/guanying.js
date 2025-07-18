/**
 * =======================================================================
 * ==                                                                   ==
 * ==                   观影网 - 前端脚本 (局域网版) - 修正版               ==
 * ==                                                                   ==
 * 功能:
 * - 与局域网内的后端API交互，获取观影网的内容
 * - 支持分类浏览、搜索、详情查看
 * - 完全兼容现有手机App环境
 *
 * ===================== 修正日志 (由 Manus AI 完成) =====================
 * 1. [修复] getTracks: 修正了ID传递的BUG。现在会把完整的 vod_id 
 *    (如 "tv/X93Y") 直接传递给后端，而不是错误地截取为 "X93Y"。
 *    这是导致"网络请求失败"的核心原因。
 * 2. [优化] getTracks: 调整了逻辑以适配后端返回的包含多个播放源
 *    (在线、网盘) 的新数据结构。
 * 3. [优化] search: 确保搜索结果的 ext.url 也是完整的 vod_id。
 * =======================================================================
 */

// --- 配置区 ---
// 请将此地址替换为您电脑上运行的后端服务地址
// 例如：如果您的电脑IP是 192.168.1.100，则设置为 'http://192.168.1.100:3001/api'
const API_BASE_URL = 'http://192.168.1.6:3001/api'; 
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
			ext: { url: item.vod_id }, // 确保 ext.url 是完整的 vod_id
		}));
		
		return jsonify({ list: cards });
		
	} catch (error) {
		console.log(`获取分类数据失败: ${error.message}`);
		return jsonify({ list: [] });
	}
}

async function getTracks(ext) {
	ext = argsify(ext);
	let { url } = ext; // url 现在是完整的 vod_id, e.g., "tv/X93Y"
	
	if (!url) {
		console.log('获取详情失败: 缺少URL参数');
		return jsonify({ list: [] });
	}
	
	// [已修复] 不再需要清理ID，直接使用完整的url作为id传给后端
	console.log(`请求详情的ID: ${url}`);

	try {
		const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
		const { data } = await $fetch.get(detailUrl, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		
		if (result.error || !result.list || result.list.length === 0) {
			console.log(`获取详情数据失败: ${result.error || '无有效列表'}`);
			return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败', pan: '', ext: {} }] }] });
		}
		
		const detailItem = result.list[0];
		const playFrom = detailItem.vod_play_from.split('$$$');
		const playUrlGroups = detailItem.vod_play_url.split('$$$');
		
		const trackGroups = [];

		playFrom.forEach((from, i) => {
			const tracks = [];
			const urlGroup = playUrlGroups[i];
			if (urlGroup) {
				urlGroup.split('#').forEach(playUrl => {
					if (playUrl.trim()) {
						const urlParts = playUrl.split('$');
						const panName = urlParts[0] || '未知资源';
						const cleanUrl = urlParts[1] || '';
						tracks.push({ name: panName, pan: cleanUrl, ext: {} });
					}
				});
			}
			if (tracks.length > 0) {
				trackGroups.push({ title: from, tracks: tracks });
			}
		});
		
		if (trackGroups.length === 0) {
			return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '暂无有效资源链接', pan: '', ext: {} }] }] });
		}
		
		return jsonify({ list: trackGroups });
		
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
			ext: { url: item.vod_id }, // 确保 ext.url 是完整的 vod_id
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

