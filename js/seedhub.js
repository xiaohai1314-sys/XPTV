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

// ====================【第三次修正后的函数】====================
async function getTracks(ext) {
	ext = argsify(ext);
	let tracks = [];
	let url = ext.url;

	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA, // 确保使用手机UA
		},
	});
	
	// 直接在整个页面文本中搜索 panLink 变量，避免 Cheerio 解析 script 标签内容的问题
	const panLinkRegex = /var panLink = "(.*?)";/;
	const match = data.match(panLinkRegex);
	
	let panLink = '';
	if (match && match[1]) {
		panLink = match[1];
	}

	if (!panLink) {
		$utils.toastError('未能从页面中提取到网盘链接变量。请检查网站结构是否再次变化。'); 
		return jsonify({ list: [] }); 
	}
	
	// 使用 Cheerio 解析标题
	const $ = cheerio.load(data);
	const postTitle = $('h1, h2').first().text().replace(/^#\s*/, '').split(' ')[0].trim();
	
	// 提取网盘名称（可选，但能让名称更友好）
	let panName = '网盘资源';
	const keyNames = {
      "baidu": "百度网盘",
      "quark": "夸克网盘",
      "ali": "阿里云盘",
      "xunlei": "迅雷",
    };
	
	for (const key in keyNames) {
		if (panLink.includes(key)) {
			panName = keyNames[key];
			break;
		}
	}

	// 提取码逻辑（仅针对百度网盘）
	let extractCode = '';
	if (panLink.includes("baidu") && panLink.includes("?pwd=")) {
		const matchPwd = panLink.match(/\?pwd=(.*)/);
		if (matchPwd && matchPwd[1]) {
			extractCode = ` (提取码: ${matchPwd[1]})`;
		}
	}
	
	// 构造 tracks 数组
	let newName = `${postTitle} [${panName}]${extractCode}`;
	
	tracks.push({
		name: newName,
		pan: panLink, 
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
