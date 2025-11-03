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

// ====================【二次修正后的函数】====================
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
	const postTitle = $('h1, h2').first().text().replace(/^#\s*/, '').split(' ')[0].trim();
	
	// **【核心修正 V2】**
	// 目标链接现在位于 <a class="direct-pan"> 标签中
	// 并且链接地址是通过 JavaScript 变量 panLink 注入到 href 属性的
	// 我们的爬虫无法执行 JavaScript，所以需要从 script 标签中提取 panLink 变量的值。
	
	let panLink = '';
	
	// 1. 查找包含 panLink 变量的 <script> 标签
	$('script').each((i, el) => {
		const scriptContent = $(el).html();
		if (scriptContent && scriptContent.includes('var panLink =')) {
			// 2. 使用正则表达式提取 panLink 的值
			const match = scriptContent.match(/var panLink = "(.*?)";/);
			if (match && match[1]) {
				panLink = match[1];
				return false; // 找到后跳出循环
			}
		}
	});

	if (!panLink) {
		$utils.toastError('未能从页面中提取到网盘链接变量。'); 
		return jsonify({ list: [] }); 
	}
	
	// 3. 从 panLink 中提取网盘名称（可选，但能让名称更友好）
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

	// 4. 提取码逻辑（仅针对百度网盘）
	let extractCode = '';
	if (panLink.includes("baidu") && panLink.includes("?pwd=")) {
		const match = panLink.match(/\?pwd=(.*)/);
		if (match && match[1]) {
			extractCode = ` (提取码: ${match[1]})`;
		}
	}
	
	// 5. 构造 tracks 数组
	let newName = `${postTitle} [${panName}]${extractCode}`;
	
	// 尝试从标题中提取规格信息，如果 panLink 中没有，则不提取
	// 这一步可以简化，直接使用 panName 作为资源名
	
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
