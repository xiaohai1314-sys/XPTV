/**
 * 观影网前端脚本 (局域网版本)
 * 
 * 功能:
 * - 与局域网内的后端API交互，获取观影网的内容
 * - 支持分类浏览、搜索、详情查看
 * - 完全兼容现有手机App环境
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
		{
			name: '电影',
			ext: {
				id: 'mv?page=',
			},
		},
		{
			name: '剧集',
			ext: {
				id: 'tv?page=',
			},
		},
		{
			name: '动漫',
			ext: {
				id: 'ac?page=',
			},
		}
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
	
	try {
		const detailUrl = `${API_BASE_URL}/detail?id=${encodeURIComponent(url)}`;
		const { data } = await $fetch.get(detailUrl, {
			headers: { 'Accept': 'application/json' },
			timeout: 30000,
		});
		
		const result = JSON.parse(data);
		
		if (result.error || !result.list || result.list.length === 0) {
			console.log(`获取详情数据失败: ${result.error || '无有效列表'}`);
			return jsonify({ 
				list: [{ 
					title: '资源列表', 
					tracks: [{ name: '获取资源失败或内容为空', pan: '', ext: {} }] 
				}] 
			});
		}
		
		const tracks = [];
		const detailItem = result.list[0];
		
		if (detailItem.vod_play_url && 
			detailItem.vod_play_url.trim() !== '' && 
			detailItem.vod_play_url !== '暂无有效链接') {
			
			const playUrls = detailItem.vod_play_url.split('$$$');
			
			playUrls.forEach((playUrl, index) => {
				if (playUrl.trim()) {
					let panName = `网盘 ${index + 1}`;
					let cleanUrl = playUrl.trim();
					
					// 解析格式：名称$链接
					const parts = playUrl.split('$');
					if (parts.length === 2) {
						panName = parts[0];
						cleanUrl = parts[1];
					}
					
					tracks.push({
						name: panName,
						pan: cleanUrl,
						ext: {},
					});
				}
			});
		}
		
		if (tracks.length === 0) {
			tracks.push({ name: '暂无有效资源链接', pan: '', ext: {} });
		}
		
		return jsonify({ list: [{ title: '资源列表', tracks }] });
		
	} catch (error) {
		console.log(`获取详情失败: ${error.message}`);
		return jsonify({ 
			list: [{ 
				title: '资源列表', 
				tracks: [{ name: '网络请求失败', pan: '', ext: {} }] 
			}] 
		});
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
			vod_remarks: '',
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

