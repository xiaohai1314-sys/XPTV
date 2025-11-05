const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
	// 更新版本号，表示这是一个新的稳定版
	ver: '1.2.0',
	title: 'SeedHub',
	site: 'https://www.seedhub.cc',
	tabs: [
		{
			name: '首页',
			ext: {
				id: '/',
			},
		},
		{
			name: '电影',
			ext: {
				id: '/categories/1/movies/',
			},
		},
		{
			name: '剧集',
			ext: {
				id: '/categories/3/movies/',
			},
		},
		{
			name: '动漫',
			ext: {
				id: '/categories/2/movies/',
			},
		}
		
	],
}
async function getConfig(  ) {
	return jsonify(appConfig)
}

// [STABLE] getCards 函数，包含分页修复
async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	const url = appConfig.site + id + `?page=${page}`
	const { data } = await $fetch.get(url, {
		headers: {
			"User-Agent": UA,
		},
	});
	
	const $ = cheerio.load(data)
	// 首页和搜索页的列表项类名不同，需要做兼容
	const videos = $('.cover-container .cover');
	videos.each((_, e) => {
		const href = $(e).find('a').attr('href')
		const title = $(e).find('a img').attr('alt')
		const cover = $(e).find('a img').attr('src')
		cards.push({
			vod_id: href,
			vod_name: title,
			vod_pic: cover,
			vod_remarks: '',
			ext: {
				url: `${appConfig.site}${href}`,
			},
		})
	})

	// --- 分页逻辑 ---
	let pagecount = 0;
	const pageLinks = $('.page-nav a[href*="?page="]');
	if (pageLinks.length > 0) {
		const lastPageLink = pageLinks.last();
		const lastPageHref = lastPageLink.attr('href');
		const pageMatch = lastPageHref.match(/page=(\d+)/);
		if (pageMatch && pageMatch[1]) {
			pagecount = parseInt(pageMatch[1], 10);
		}
	}
	if (pagecount === 0 && cards.length > 0) {
		pagecount = 1;
	}

	return jsonify({
		list: cards,
		page: parseInt(page, 10),
		pagecount: pagecount,
		limit: videos.length,
		total: 0
	})
}

// [STABLE] getTracks 函数，修复网盘链接获取
async function getTracks(ext) {
	ext = argsify(ext);
	const detailUrl = ext.url;

	const { data: detailHtml } = await $fetch.get(detailUrl, {
		headers: { 'User-Agent': UA },
	});
	
	const $ = cheerio.load(detailHtml);
	const panLinkElements = $('.pan-links li a');
	
	if (panLinkElements.length === 0) {
		$utils.toastError('没有网盘资源条目'); 
		return jsonify({ list: [] }); 
	}

	const postTitle = $('h1').text().replace(/^#\s*/, '').split(' ')[0].trim();

	const trackPromises = panLinkElements.get().map(async (link) => {
		const intermediateUrl = appConfig.site + $(link).attr('href');
		const originalTitle = $(link).attr('title') || $(link).text().trim();
		
		try {
			const { data: intermediateHtml } = await $fetch.get(intermediateUrl, {
				headers: { 'User-Agent': UA },
			});

			const match = intermediateHtml.match(/var panLink = "([^"]+)"/);
			
			if (match && match[1]) {
				const finalPanUrl = match[1];
				let newName = originalTitle;
				const specMatch = originalTitle.match(/(合集|次时代|\d+部|\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);
				
				if (specMatch) {
					const tags = specMatch.join(' ');
					newName = `${postTitle} [${tags}]`;
				} else {
					newName = postTitle;
				}

				return {
					name: newName,
					pan: finalPanUrl,
				};
			}
		} catch (error) {
			console.log(`解析链接 "${originalTitle}" 失败: ${error.message}`);
		}
		return null;
	});

	const resolvedTracks = await Promise.all(trackPromises);
	const tracks = resolvedTracks.filter(track => track !== null);

	if (tracks.length === 0) {
		$utils.toastError('所有网盘链接解析均失败');
		return jsonify({ list: [] });
	}
	
	return jsonify({
		list: [
			{
				title: postTitle,
				tracks,
			},
		],
	});
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	const url = ext.url
   	  
	return jsonify({ urls: [ext.url] })
}

// [STABLE] search 函数，包含分页修复，已移除缓存
async function search(ext) {
	ext = argsify(ext)
	let cards = []

	let text = encodeURIComponent(ext.text || '');
	let page = ext.page || 1;
	let url = `${appConfig.site}/s/${text}/?page=${page}`

	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA,
		},
	})

	const $ = cheerio.load(data)
	// 首页和搜索页的列表项类名不同，需要做兼容
	const videos = $('.cover-container .cover');
	videos.each((_, e) => {
		const href = $(e).find('a').attr('href')
		const title = $(e).find('a img').attr('alt')
		const cover = $(e).find('a img').attr('src')
		cards.push({
			vod_id: href,
			vod_name: title,
			vod_pic: cover,
			vod_remarks: '',
			ext: {
				url: `${appConfig.site}${href}`,
			},
		})
	})

	// --- 分页逻辑 ---
	let pagecount = 0;
	const pageLinks = $('.page-nav a[href*="?page="]');
	if (pageLinks.length > 0) {
		const lastPageLink = pageLinks.last();
		const lastPageHref = lastPageLink.attr('href');
		const pageMatch = lastPageHref.match(/page=(\d+)/);
		if (pageMatch && pageMatch[1]) {
			pagecount = parseInt(pageMatch[1], 10);
		}
	}
	if (pagecount === 0 && cards.length > 0) {
		pagecount = 1;
	}

	return jsonify({
		list: cards,
		page: parseInt(page, 10),
		pagecount: pagecount,
		limit: videos.length,
		total: 0
	})
}
