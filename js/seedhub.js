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

async function getTracks(ext) {
	ext = argsify(ext);
	let tracks = [];
	let url = ext.url;

	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA,
		},
	});
	
	const $ = cheerio.load(data);
	// 第一项：获取帖子标题作为分组标题
	const postTitle = $('h1').text().split(' ')[0].trim();
	const playlist = $('.pan-links');
	
	if (playlist.length === 0 || playlist.find('li').length === 0) {
		$utils.toastError('没有网盘资源'); 
		return jsonify({ list: [] }); 
	}
	
	playlist.find('li a').each((_, link) => {
		const href = $(link).attr('data-link');
		const originalTitle = $(link).attr('title');
		let newName = originalTitle;

		// 第二项：从原始标题中提取关键词作为提示词
		const specMatch = originalTitle.match(/(\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);
		
		if (specMatch) {
			// 将提取到的关键词数组用空格连接成一个字符串
			const tags = specMatch.join(' ');
			// 将帖子名和提取的标签组合成新的名称
			newName = `${postTitle} [${tags}]`;
		} else {
			// 如果没有匹配到关键词，则使用帖子名作为基础名称
			newName = postTitle;
		}

		tracks.push({
			name: newName, // 使用包含提示词的新名称
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
