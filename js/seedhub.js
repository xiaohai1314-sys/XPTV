Const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// 【🚀 引入全局缓存】用于存储总页数等信息（可选，但用于保险）
// 注意：此处的 searchCache 主要由 getCards 使用，新的 search 函数将有自己的独立缓存。
const searchCacheForGetCards = {} // 为了不与 search 函数的缓存冲突，可以这样命名或放在其作用域内

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
async function getConfig(   ) {
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

    // 【🛠️ 核心修正逻辑 - 页码计算和停止信号】
    let pagecount = 0;
    
    // 1. 尝试计算总页数（如果页面上有页码链接）
    $('span.page a').each((_, link) => {
        const p = parseInt($(link).text().trim());
        if (!isNaN(p)) {
            pagecount = Math.max(pagecount, p);
        }
    });

    // 2. 修正逻辑：如果列表为空，说明已经翻到头了
    if (cards.length === 0) {
        // 总页数就是前一页
        pagecount = page - 1; 
        if (pagecount < 1) pagecount = 1; // 至少保证 pagecount 是 1
        
    } else if (pagecount === 0) {
        // 修正逻辑：如果列表不为空，但计算出的页码为 0，说明只有一页结果
        pagecount = page; // 当前页就是总页数
    }
    
    // 将计算出的总页数存入缓存，供下次请求使用（保险）
    searchCacheForGetCards.pagecount = pagecount;
    
    // 【✅ 返回字段】返回 pagecount 和 total (模仿参考脚本)
	return jsonify({
		list: cards,
        pagecount: pagecount, // 明确告诉调用方总页数
        total: cards.length,  // 模仿参考脚本，返回当前页的卡片数量
	})
}

async function getTracks(ext) {
    // ... (保持不变，与分页无关) ...
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


// =======================================================================
// =================== 【修改后的 search 函数】 ============================
// =======================================================================

// 【🚀 引入全局缓存】用于存储搜索结果和分页信息
const searchCache = {};

async function search(ext) {
	ext = argsify(ext);
	const text = ext.text || '';
	const page = ext.page || 1;

	if (!text) {
		return jsonify({ list: [] });
	}

	// 1. 【✅ 缓存命中逻辑】如果搜索词变化，则清空缓存
	if (searchCache.keyword !== text) {
		// 使用 $log 或 console.log 进行调试输出
		try { $log(`新关键词 "${text}"，重置搜索缓存`); } catch(e) { console.log(`新关键词 "${text}"，重置搜索缓存`); }
		searchCache.keyword = text;
		searchCache.data = {}; // 使用对象存储，键为页码
		searchCache.pagecount = 0;
	}

	// 2. 【✅ 页越界保护】利用缓存的总页数判断是否需要继续请求
    // 如果 pagecount 已知且大于0，并且请求的页码超出了范围，则直接返回空列表
	if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
		try { $log(`页码越界 (请求第 ${page} 页, 总共 ${searchCache.pagecount} 页)，直接返回空`); } catch(e) { console.log(`页码越界 (请求第 ${page} 页, 总共 ${searchCache.pagecount} 页)，直接返回空`); }
		return jsonify({ list: [], pagecount: searchCache.pagecount });
	}

    // 3. 【✅ 命中页缓存】如果当前页的数据已在缓存中，直接返回
    if (searchCache.data && searchCache.data[page]) {
        try { $log(`命中第 ${page} 页的缓存`); } catch(e) { console.log(`命中第 ${page} 页的缓存`); }
        return jsonify({
            list: searchCache.data[page],
            pagecount: searchCache.pagecount
        });
    }

	// 4. 【🌐 网络请求】如果缓存未命中且未越界，则发起网络请求
	try { $log(`缓存未命中，请求第 ${page} 页`); } catch(e) { console.log(`缓存未命中，请求第 ${page} 页`); }
	const url = `${appConfig.site}/s/${encodeURIComponent(text)}/?page=${page}`;
	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA,
		},
	});

	const $ = cheerio.load(data);
	const cards = [];
	$('.cover').each((_, e) => {
		const href = $(e).find('a').attr('href');
		const title = $(e).find('a img').attr('alt');
		const cover = $(e).find('a img').attr('src');
		cards.push({
			vod_id: href,
			vod_name: title,
			vod_pic: cover,
			vod_remarks: '',
			ext: {
				url: `${appConfig.site}${href}`,
			},
		});
	});

	// 5. 【🔢 分页计算与缓存更新】
	let pagecount = searchCache.pagecount; // 默认使用缓存中的值
    
    // 仅在首次计算时或需要更新时执行
    if (pagecount === 0) {
        $('span.page a').each((_, link) => {
            const p = parseInt($(link).text().trim());
            if (!isNaN(p)) {
                pagecount = Math.max(pagecount, p);
            }
        });
    }

	// 修正逻辑：如果列表为空，说明已经翻到头了
	if (cards.length === 0) {
        // 如果是第一页就没结果，那总页数就是0或1；否则总页数就是前一页
		pagecount = page > 1 ? page - 1 : (pagecount > 0 ? pagecount : 1);
	} else if (pagecount === 0) {
		// 如果列表不为空，但无法从页面链接中计算出总页数，说明可能只有一页
		pagecount = page;
	}

	// 6. 【💾 写入缓存】将新获取的数据和计算出的总页数存入缓存
	searchCache.pagecount = pagecount;
	searchCache.data[page] = cards;
    try { $log(`第 ${page} 页数据已缓存，计算总页数为: ${pagecount}`); } catch(e) { console.log(`第 ${page} 页数据已缓存，计算总页数为: ${pagecount}`); }

	// 7. 【📤 返回结果】
	return jsonify({
		list: cards,
		pagecount: pagecount,
	});
}
