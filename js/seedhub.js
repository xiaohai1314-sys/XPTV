const cheerio = createCheerio()
// 保持手机版的User-Agent，这是能直接获取到网盘链接的关键
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
async function getConfig( ) {
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
		return jsonify({
		list: cards,
	})
}

// ====================【修改后的函数】====================
async function getTracks(ext) {
	ext = argsify(ext);
	let tracks = [];
	let url = ext.url;

	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA, // 确保使用手机UA
		},
	});
	
	const $ = cheerio.load(data);
	
	// 标题的获取逻辑保持不变
	const postTitle = $('h1').text().replace(/^#\s*/, '').split(' ')[0].trim();
	
	// **【核心修正】**
	// 目标链接现在位于 <div class="text-center"> 下的 <a> 标签中
	const playlistContainer = $('.text-center');
	const links = playlistContainer.find('a');

	if (links.length === 0) {
		$utils.toastError('没有找到网盘资源'); 
		return jsonify({ list: [] }); 
	}
	
	links.each((_, link) => {
		// 链接地址现在直接从 href 属性获取
		const href = $(link).attr('href');
		// 链接的标题文本作为原始标题
		const originalTitle = $(link).text().trim();
		
		// 检查href是否存在且不为空
		if (!href) {
			return; // 跳过无效的链接
		}

		let newName = originalTitle;

		// 从原始标题中提取关键词的逻辑可以保持不变
		const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);
		
		if (specMatch) {
			const tags = specMatch.join(' ');
			newName = `${postTitle} [${tags}]`;
		} else {
			// 如果没有匹配到关键词，则使用 "帖子标题 [资源]" 的格式
			newName = `${postTitle} [${originalTitle}]`;
		}

		tracks.push({
			name: newName,
			pan: href, 
		});
	});
	
	return jsonify({
		list: [
			{
				title: postTitle, // 使用帖子标题作为分组名
				tracks,
			},
		],
	});
}
// =======================================================

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

	return jsonify({
		list: cards,
	})
}
