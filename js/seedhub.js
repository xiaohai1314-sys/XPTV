const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// 【🚀 引入全局缓存】用于存储总页数等信息
const searchCache = {}

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
    
    // 【✅ 缓存读取】如果不是第一页，且缓存中有 pagecount，直接使用缓存
    let pagecount = searchCache.pagecount || 0;
    if (page > 1 && pagecount > 0) {
        // 如果当前页码超过了缓存中的总页数，直接返回空列表，阻止加载
        if (page > pagecount) {
            return jsonify({ list: [], pagecount: pagecount, total: 0 });
        }
    }
    
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

    // 【🛠️ 页码计算与缓存存储】只在第一页或缓存无效时才计算
    if (page === 1 || pagecount === 0) {
        // 遍历所有页码链接 (span.page 内部的 a 标签)
        $('span.page a').each((_, link) => {
            const p = parseInt($(link).text().trim());
            if (!isNaN(p)) {
                // 找到最大的页码，即为总页数
                pagecount = Math.max(pagecount, p);
            }
        });

        // 如果有内容，但没有其他页码链接，则总页数设为 1
        if (cards.length > 0 && pagecount === 0) {
            pagecount = 1;
        } 
        
        // 【✅ 缓存写入】将计算结果存入缓存
        searchCache.pagecount = pagecount;
    }
    
    // 【最终保险】如果列表为空，强制认定总页数为当前页（并停止加载）
    if (cards.length === 0) {
        pagecount = page - 1; // 假定请求当前页失败，总页数为上一页
        if (pagecount < 1) pagecount = 1; // 至少为 1
        searchCache.pagecount = pagecount;
    }


	return jsonify({
		list: cards,
        pagecount: pagecount, // 明确告诉调用方总页数
        total: pagecount > 0 ? 99999 : 0, // 随便给个大数字，让框架知道需要分页请求
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
	
    // 【✅ 缓存读取】如果不是第一页，且缓存中有 pagecount，直接使用缓存
    let pagecount = searchCache.pagecount || 0;
    if (page > 1 && pagecount > 0) {
        // 如果当前页码超过了缓存中的总页数，直接返回空列表，阻止加载
        if (page > pagecount) {
            return jsonify({ list: [], pagecount: pagecount, total: 0 });
        }
    }
    
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

    // 【🔥 页码计算与缓存存储】只在第一页或缓存无效时才计算
    if (page === 1 || pagecount === 0) {
        // 遍历所有页码链接 (span.page 内部的 a 标签)
        $('span.page a').each((_, link) => {
            const p = parseInt($(link).text().trim());
            if (!isNaN(p)) {
                // 找到最大的页码，即为总页数
                pagecount = Math.max(pagecount, p);
            }
        });

        // 如果有内容，但没有其他页码链接，则总页数设为 1
        if (cards.length > 0 && pagecount === 0) {
            pagecount = 1;
        }
        
        // 【✅ 缓存写入】将计算结果存入缓存
        searchCache.pagecount = pagecount;
    }
    
    // 【最终保险】如果列表为空，强制认定总页数为当前页（并停止加载）
    if (cards.length === 0) {
        pagecount = page - 1; // 假定请求当前页失败，总页数为上一页
        if (pagecount < 1) pagecount = 1; // 至少为 1
        searchCache.pagecount = pagecount;
    }

	return jsonify({
		list: cards,
        pagecount: pagecount, // 明确告诉调用方总页数
        total: pagecount > 0 ? 99999 : 0, // 随便给个大数字，让框架知道需要分页请求
	})
}
