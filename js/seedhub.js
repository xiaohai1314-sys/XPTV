const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
	ver: 1,
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

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	const url =appConfig.site + id + `?page=${page}`
	const { data } = await $fetch.get(url, {
    headers: {
		"User-Agent": UA,
  	  },
});
	
	const $ = cheerio.load(data)
	const videos = $('.cover')
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

    // 【🛠️ 修正分页判断】
    // 1. 尝试使用分页链接判断 (如果存在 a 标签，就认为有下一页)
    const hasNextPageLink = $('span.next a').length > 0;
    let lastPage = !hasNextPageLink;

    if (cards.length === 0) {
        // 2. 【最终保险】如果当前页没有抓到任何卡片，强制认定为最后一页。
        // 这是最可靠的停止信号。
        lastPage = true;
    }

	return jsonify({
		list: cards,
        last: lastPage, // 告诉调用方是否是最后一页
	})
}

async function getTracks(ext) {
	ext = argsify(ext);
	const detailUrl = ext.url;

	// 1. 获取详情页 HTML
	const { data: detailHtml } = await $fetch.get(detailUrl, {
		headers: { 'User-Agent': UA },
	});
	
	const $ = cheerio.load(detailHtml);
	const panLinkElements = $('.pan-links li a');
	
	if (panLinkElements.length === 0) {
		$utils.toastError('没有网盘资源条目'); 
		return jsonify({ list: [] }); 
	}

	// 提取帖子主标题，用于后续命名
	const postTitle = $('h1').text().replace(/^#\s*/, '').split(' ')[0].trim();

	// 2. 并行处理所有网盘链接的解析
	const trackPromises = panLinkElements.get().map(async (link) => {
		const intermediateUrl = appConfig.site + $(link).attr('href');
		const originalTitle = $(link).attr('title') || $(link).text().trim();
		
		try {
			// 3. 获取中间页的 HTML
			const { data: intermediateHtml } = await $fetch.get(intermediateUrl, {
				headers: { 'User-Agent': UA },
			});

			// 4. 使用正则表达式从 HTML 文本中直接提取 panLink
			const match = intermediateHtml.match(/var panLink = "([^"]+)"/);
			
			if (match && match[1]) {
				const finalPanUrl = match[1];

				// --- 自定义命名逻辑 ---
				let newName = originalTitle;
                // [修改处] 在正则表达式中加入了 '合集' 和 '次时代'
				const specMatch = originalTitle.match(/(合集|次时代|\d+部|\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);
				
				if (specMatch) {
					const tags = specMatch.join(' ');
					newName = `${postTitle} [${tags}]`;
				} else {
					newName = postTitle;
				}
				// --- 自定义命名逻辑结束 ---

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

	// 等待所有解析完成
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

async function search(ext) {
	ext = argsify(ext)
	let cards = []

	let text = encodeURIComponent(ext.text)
	let page = ext.page || 1
	let url = `${appConfig.site}/s/${text}/?page=${page}`

	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA,
		},
	})

	const $ = cheerio.load(data)
	const videos = $('.cover')
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

    // 【🔥 修正搜索分页判断】
    // 1. 尝试使用分页链接判断 (如果存在 a 标签，就认为有下一页)
    const hasNextPageLink = $('span.next a').length > 0;
    let lastPage = !hasNextPageLink;

    if (cards.length === 0) {
        // 2. 【最终保险】如果当前页没有抓到任何卡片，强制认定为最后一页。
        lastPage = true;
    }

	return jsonify({
		list: cards,
        last: lastPage, // 告诉调用方是否是最后一页
	})
}
