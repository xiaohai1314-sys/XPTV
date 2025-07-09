// 适配苹果TV的观影网XPTV脚本
const cheerio = createCheerio()
// 调整UA为苹果TV兼容的Safari标识
const UA = 'Mozilla/5.0 (AppleTV; U; CPU AppleTV OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const appConfig = {
	ver: 1,
	title: '观影网',
	site: 'https://www.gying.org',
	tabs: [
		{ name: '电影', ext: { id: '/mv/------' } },
		{ name: '剧集', ext: { id: '/tv/------' } },
		{ name: '动漫', ext: { id: '/ac/------' } }
	],
}

async function getConfig() {
	return jsonify(appConfig)
}

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	const url = `${appConfig.site}${id}${page}`
	
	try {
		// 增加超时设置，适配TV网络环境
		const { data } = await $fetch.get(url, {
			headers: { "User-Agent": UA },
			timeout: 15000
		})
		
		const $ = cheerio.load(data)
		// 错误页检测优化
		if ($('p.error').length > 0) {
			$utils.toastError('页面加载错误')
			return jsonify({ list: [] })
		}
		
		// 提取数据逻辑优化
		const scriptContent = $('script').filter((_, script) => {
			return $(script).html()?.includes('_obj.header')
		}).html()
		
		if (!scriptContent) {
			$utils.toastError('未找到数据脚本')
			return jsonify({ list: [] })
		}
		
		const jsonStart = scriptContent.indexOf('{')
		const jsonEnd = scriptContent.lastIndexOf('}') + 1
		const jsonString = scriptContent.slice(jsonStart, jsonEnd)
		const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/)
		
		if (!inlistMatch) {
			$utils.toastError("未找到数据列表")
			return jsonify({ list: [] })
		}
		
		const inlistData = JSON.parse(inlistMatch[1])
		if (!inlistData["i"] || !Array.isArray(inlistData["i"])) {
			$utils.toastError("数据格式错误")
			return jsonify({ list: [] })
		}
		
		inlistData["i"].forEach((item, index) => {
			cards.push({
				vod_id: item,
				vod_name: inlistData["t"]?.[index] || '未知名称',
				vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
				vod_remarks: inlistData["g"]?.[index] || '',
				ext: {
					url: `https://www.gyg.la/res/downurl/${inlistData["ty"]}/${item}`,
				},
			})
		})
		
		return jsonify({ list: cards })
		
	} catch (e) {
		$utils.toastError(`加载失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}

async function getTracks(ext) {
	ext = argsify(ext)
	let tracks = []
	const url = ext.url
	
	if (!url) {
		$utils.toastError('播放地址为空')
		return jsonify({ list: [] })
	}
	
	try {
		const { data } = await $fetch.get(url, {
			headers: { 'User-Agent': UA },
			timeout: 15000
		})
		
		const respstr = JSON.parse(data)
		
		if (respstr.panlist?.url && Array.isArray(respstr.panlist.url)) {
			respstr.panlist.url.forEach(item => {
				tracks.push({
					name: '网盘',
					pan: item,
					ext: { url: '' },
				})
			})
		} else if (respstr.hasOwnProperty('file')) {
			$utils.toastError('网盘验证失效')
		} else {
			$utils.toastError('无可用资源')
		}
		
		return jsonify({
			list: [{ title: '默认分组', tracks }]
		})
		
	} catch (e) {
		$utils.toastError(`资源获取失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	const url = ext.url
	return jsonify({ urls: [url || ''] })
}

async function search(ext) {
	ext = argsify(ext)
	const text = encodeURIComponent(ext.text || '')
	const page = ext.page || 1
	const url = `${appConfig.site}/s/1---${page}/${text}`
	
	if (!text) {
		$utils.toastError('请输入搜索内容')
		return jsonify({ list: [] })
	}
	
	try {
		const { data } = await $fetch.get(url, {
			headers: { "User-Agent": UA },
			timeout: 15000
		})
		
		const $ = cheerio.load(data)
		let cards = []
		
		$('.v5d').each((index, element) => {
			const name = $(element).find('b').text().trim() || '未知名称'
			const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || ''
			const additionalInfo = $(element).find('p').text().trim() || ''
			const pathMatch = $(element).find('a').attr('href') || ''
			
			cards.push({
				vod_id: pathMatch,
				vod_name: name,
				vod_pic: imgUrl,
				vod_remarks: additionalInfo,
				ext: {
					url: `${appConfig.site}/res/downurl${pathMatch}`,
				},
			})
		})
		
		return jsonify({ list: cards })
		
	} catch (e) {
		$utils.toastError(`搜索失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}// 适配苹果TV的观影网XPTV脚本
const cheerio = createCheerio()
// 调整UA为苹果TV兼容的Safari标识
const UA = 'Mozilla/5.0 (AppleTV; U; CPU AppleTV OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const appConfig = {
	ver: 1,
	title: '观影网',
	site: 'https://www.gying.org',
	tabs: [
		{ name: '电影', ext: { id: '/mv/------' } },
		{ name: '剧集', ext: { id: '/tv/------' } },
		{ name: '动漫', ext: { id: '/ac/------' } }
	],
}

async function getConfig() {
	return jsonify(appConfig)
}

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	const url = `${appConfig.site}${id}${page}`
	
	try {
		// 增加超时设置，适配TV网络环境
		const { data } = await $fetch.get(url, {
			headers: { "User-Agent": UA },
			timeout: 15000
		})
		
		const $ = cheerio.load(data)
		// 错误页检测优化
		if ($('p.error').length > 0) {
			$utils.toastError('页面加载错误')
			return jsonify({ list: [] })
		}
		
		// 提取数据逻辑优化
		const scriptContent = $('script').filter((_, script) => {
			return $(script).html()?.includes('_obj.header')
		}).html()
		
		if (!scriptContent) {
			$utils.toastError('未找到数据脚本')
			return jsonify({ list: [] })
		}
		
		const jsonStart = scriptContent.indexOf('{')
		const jsonEnd = scriptContent.lastIndexOf('}') + 1
		const jsonString = scriptContent.slice(jsonStart, jsonEnd)
		const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/)
		
		if (!inlistMatch) {
			$utils.toastError("未找到数据列表")
			return jsonify({ list: [] })
		}
		
		const inlistData = JSON.parse(inlistMatch[1])
		if (!inlistData["i"] || !Array.isArray(inlistData["i"])) {
			$utils.toastError("数据格式错误")
			return jsonify({ list: [] })
		}
		
		inlistData["i"].forEach((item, index) => {
			cards.push({
				vod_id: item,
				vod_name: inlistData["t"]?.[index] || '未知名称',
				vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
				vod_remarks: inlistData["g"]?.[index] || '',
				ext: {
					url: `https://www.gyg.la/res/downurl/${inlistData["ty"]}/${item}`,
				},
			})
		})
		
		return jsonify({ list: cards })
		
	} catch (e) {
		$utils.toastError(`加载失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}

async function getTracks(ext) {
	ext = argsify(ext)
	let tracks = []
	const url = ext.url
	
	if (!url) {
		$utils.toastError('播放地址为空')
		return jsonify({ list: [] })
	}
	
	try {
		const { data } = await $fetch.get(url, {
			headers: { 'User-Agent': UA },
			timeout: 15000
		})
		
		const respstr = JSON.parse(data)
		
		if (respstr.panlist?.url && Array.isArray(respstr.panlist.url)) {
			respstr.panlist.url.forEach(item => {
				tracks.push({
					name: '网盘',
					pan: item,
					ext: { url: '' },
				})
			})
		} else if (respstr.hasOwnProperty('file')) {
			$utils.toastError('网盘验证失效')
		} else {
			$utils.toastError('无可用资源')
		}
		
		return jsonify({
			list: [{ title: '默认分组', tracks }]
		})
		
	} catch (e) {
		$utils.toastError(`资源获取失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	const url = ext.url
	return jsonify({ urls: [url || ''] })
}

async function search(ext) {
	ext = argsify(ext)
	const text = encodeURIComponent(ext.text || '')
	const page = ext.page || 1
	const url = `${appConfig.site}/s/1---${page}/${text}`
	
	if (!text) {
		$utils.toastError('请输入搜索内容')
		return jsonify({ list: [] })
	}
	
	try {
		const { data } = await $fetch.get(url, {
			headers: { "User-Agent": UA },
			timeout: 15000
		})
		
		const $ = cheerio.load(data)
		let cards = []
		
		$('.v5d').each((index, element) => {
			const name = $(element).find('b').text().trim() || '未知名称'
			const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || ''
			const additionalInfo = $(element).find('p').text().trim() || ''
			const pathMatch = $(element).find('a').attr('href') || ''
			
			cards.push({
				vod_id: pathMatch,
				vod_name: name,
				vod_pic: imgUrl,
				vod_remarks: additionalInfo,
				ext: {
					url: `${appConfig.site}/res/downurl${pathMatch}`,
				},
			})
		})
		
		return jsonify({ list: cards })
		
	} catch (e) {
		$utils.toastError(`搜索失败: ${e.message}`)
		return jsonify({ list: [] })
	}
}
