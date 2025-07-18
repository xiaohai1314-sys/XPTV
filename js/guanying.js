/**
 * =======================================================================
 * ==                                                                   ==
 * ==                   观影网 - 前端脚本 (局域网版) - 优化版               ==
 * ==                                                                   ==
 * 功能:
 * - 与局域网内的后端API交互，获取观影网的内容
 * - 支持分类浏览、搜索、详情查看
 * - 完全兼容现有手机App环境
 *
 * ===================== 修正日志 (由 Manus AI 完成) =====================
 * 1. [优化] 增加了更详细的日志输出，方便调试前端数据处理过程。
 * 2. [优化] 确保数据字段的兼容性，防止因字段缺失导致前端渲染失败。
 * 3. [修复] 修复了 getTracks 中可能存在的 pan 字段为空导致的问题。
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
	console.log('getConfig called');
	return jsonify(appConfig);
}

async function getCards(ext) {
	console.log('getCards called with ext:', ext);
	ext = argsify(ext);
	let { page = 1, id } = ext;
	
	if (!id) {
		console.log('getCards: Missing id parameter');
		return jsonify({ list: [] });
	}

	try {
		const url = `${API_BASE_URL}/vod?type_id=${encodeURIComponent(id)}&page=${page}`;
		console.log('getCards: Requesting URL:', url);
		const { data } = await $fetch.get(url, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		console.log('getCards: Backend raw response:', result);
		
		if (result.error) {
			console.log(`getCards: Backend error: ${result.error}`);
			return jsonify({ list: [] });
		}
		
		const cards = (result.list || []).map(item => ({
			vod_id: item.vod_id || '',
			vod_name: item.vod_name || 'N/A',
			vod_pic: item.vod_pic || '',
			vod_remarks: item.vod_remarks || '',
			ext: { url: item.vod_id || '' }, // 确保 ext.url 是完整的 vod_id
		}));
		
		console.log('getCards: Processed cards:', cards);
		return jsonify({ list: cards });
		
	} catch (error) {
		console.log(`getCards: Failed to fetch category data: ${error.message}`);
		return jsonify({ list: [] });
	}
}

async function getTracks(ext) {
	console.log('getTracks called with ext:', ext);
	ext = argsify(ext);
	let { url } = ext; // url 现在是完整的 vod_id, e.g., "tv/X93Y"
	
	if (!url) {
		console.log('getTracks: Missing URL parameter');
		return jsonify({ list: [] });
	}
	
	// [已修复] 不再需要清理ID，直接使用完整的url作为id传给后端
	console.log(`getTracks: Requesting detail for ID: ${url}`);

	try {
		const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
		console.log('getTracks: Requesting detail URL:', detailUrl);
		const { data } = await $fetch.get(detailUrl, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		console.log('getTracks: Backend raw detail response:', result);
		
		if (result.error || !result.list || result.list.length === 0) {
			console.log(`getTracks: Failed to get detail data: ${result.error || 'No valid list'}`);
			return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '获取资源失败', pan: '', ext: {} }] }] });
		}
		
		const detailItem = result.list[0];
		const playFrom = detailItem.vod_play_from ? detailItem.vod_play_from.split('$$$') : [];
		const playUrlGroups = detailItem.vod_play_url ? detailItem.vod_play_url.split('$$$') : [];
		
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
		
		console.log('getTracks: Processed track groups:', trackGroups);
		if (trackGroups.length === 0) {
			return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '暂无有效资源链接', pan: '', ext: {} }] }] });
		}
		
		return jsonify({ list: trackGroups });
		
	} catch (error) {
		console.log(`getTracks: Failed to get detail: ${error.message}`);
		return jsonify({ list: [{ title: '资源列表', tracks: [{ name: '网络请求失败', pan: '', ext: {} }] }] });
	}
}

async function search(ext) {
	console.log('search called with ext:', ext);
	ext = argsify(ext);
	let text = ext.text || '';
	
	if (!text) {
		console.log('search: Missing keyword');
		return jsonify({ list: [] });
	}
	
	try {
		const url = `${API_BASE_URL}/search?keyword=${encodeURIComponent(text)}`;
		console.log('search: Requesting URL:', url);
		const { data } = await $fetch.get(url, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		console.log('search: Backend raw response:', result);
		
		if (result.error) {
			console.log(`search: Backend error: ${result.error}`);
			return jsonify({ list: [] });
		}
		
		const cards = (result.list || []).map(item => ({
			vod_id: item.vod_id || '',
			vod_name: item.vod_name || 'N/A',
			vod_pic: item.vod_pic || '',
			vod_remarks: item.vod_remarks || '',
			ext: { url: item.vod_id || '' }, // 确保 ext.url 是完整的 vod_id
		}));
		
		console.log('search: Processed cards:', cards);
		return jsonify({ list: cards });
		
	} catch (error) {
		console.log(`search: Failed to search: ${error.message}`);
		return jsonify({ list: [] });
	}
}

async function getPlayinfo(ext) {
	console.log('getPlayinfo called with ext:', ext);
	ext = argsify(ext);
	return jsonify({ urls: [ext.url] });
}


