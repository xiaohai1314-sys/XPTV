const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// 【🚀 缓存机制】 - 完全保留您设计的缓存
const searchCacheForGetCards = {} 
const searchCache = {};

// 【✅ 已修改】 - 更新站点和分类路径
const appConfig = {
	ver: 1,
	title: '极狐4K', // title 已更新
	site: 'https://4kfox.com', // site 已更新
	tabs: [

		{
			name: '电影',
			ext: {
				id: '/list/dianying.html', // id 已更新
			},
		},
		{
			name: '剧集',
			ext: {
				id: '/list/juji.html', // id 已更新
			},
		},
		{
			name: '动漫',
			ext: {
				id: '/list/dongman.html', // id 已更新
			},
		}
	],
}

async function getConfig() {
	return jsonify(appConfig)
}

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	
    // 【✅ 已修改】 - 适配新的分页URL格式
	let url;
	if (id === '/') {
        // 首页分页格式: /page/X.html
		url = `${appConfig.site}/page/${page}.html`;
	} else {
        // 分类页分页格式: /list/dianying-X.html
        // 使用正则表达式确保路径正确拼接
        url = `${appConfig.site}${id.replace(/\.html$/, '')}-${page}.html`;
	}

	const { data } = await $fetch.get(url, {
		headers: { "User-Agent": UA },
	});
	
	const $ = cheerio.load(data);

    // 【✅ 已修改】 - 适配新的列表项选择器
	$('.hl-vod-list .hl-list-item').each((_, e) => {
		const a = $(e).find('a.hl-item-thumb');
		const href = a.attr('href');
		const title = $(e).find('.hl-item-title a').attr('title');
		const cover = a.attr('data-original');
        const remarks = $(e).find('.hl-pic-text .remarks').text().trim(); // 新增备注提取

		cards.push({
			vod_id: href,
			vod_name: title,
			vod_pic: cover,
			vod_remarks: remarks, // 返回备注信息
			ext: {
				url: `${appConfig.site}${href}`,
			},
		});
	});

    // 【✅ 已修改】 - 适配新的分页总数提取逻辑，同时保留您的原有判断
    let pagecount = 0;
    const pageInfo = $('.hl-page-tips a').text().trim(); // 格式: "当前页 / 总页数"
    if (pageInfo) {
        const parts = pageInfo.split('/');
        if (parts.length === 2) {
            pagecount = parseInt(parts[1].trim()) || 0;
        }
    }

    // 保留您的健壮性判断
    if (cards.length === 0) {
        pagecount = page > 1 ? page - 1 : 1;
    } else if (pagecount === 0) {
        pagecount = page;
    }
    
    searchCacheForGetCards.pagecount = pagecount;
    
	return jsonify({
		list: cards,
        pagecount: pagecount,
        total: cards.length,
	});
}

async function getTracks(ext) {
    ext = argsify(ext);
    const detailUrl = ext.url;

    const { data: detailHtml } = await $fetch.get(detailUrl, {
        headers: { 'User-Agent': UA },
    });
    
    const $ = cheerio.load(detailHtml);
    
    const resourceGroups = [];
    const groupTabs = $('#downlist .hl-tabs-btn-down');

    if (groupTabs.length === 0) {
        $utils.toastError('没有找到资源分组');
        return jsonify({ list: [] });
    }

    const postTitle = $('.hl-dc-title').text().trim().split('(')[0].trim();

    groupTabs.each((index, tab) => {
        const groupTitle = $(tab).attr('alt').trim();
        const tracks = [];

        const contentBox = $(`.hl-downs-list-down`).eq(index);
        contentBox.find('.hl-downs-box').each((_, item) => {
            const linkElement = $(item).find('a.down-name');
            const finalPanUrl = linkElement.attr('href');
            const originalTitle = linkElement.find('em.filename').text().trim();
            
            if (finalPanUrl && originalTitle) {
                // --- 【⭐ 新增的链接清理逻辑】 ---
                let cleanedUrl = finalPanUrl;
                
                // 第一步：将 115cdn.com 转换成 115.com
                cleanedUrl = cleanedUrl.replace('115cdn.com', '115.com');
                
                // 第二步：移除尾部所有非字母和非数字的特殊符号
                // 正则表达式 /[^a-zA-Z0-9]+$/ 匹配链接末尾连续的非字母数字字符
                cleanedUrl = cleanedUrl.replace(/[^a-zA-Z0-9]+$/, '');
                // --- 【清理逻辑结束】 ---

                // --- 【✅ 完全保留】您强大的自定义命名逻辑 ---
                let newName = originalTitle;
                const specMatch = originalTitle.match(/(合集|次时代|\d+部|\d{4}p|4K|2160p|1080p|HDR|DV|杜比|高码|内封|特效|字幕|原盘|REMUX|[\d\.]+G[B]?)/ig);
                
                if (specMatch) {
                    const tags = specMatch.join(' ');
                    newName = `${postTitle} [${tags}]`;
                } else {
                    newName = `${postTitle} [${groupTitle}]`; // 如果匹配不到，使用分组名作为补充
                }
                // --- 自定义命名逻辑结束 ---

                tracks.push({
                    name: newName,
                    pan: cleanedUrl, // <-- 使用清理后的链接
                });
            }
        });

        if (tracks.length > 0) {
            resourceGroups.push({
                title: groupTitle,
                tracks: tracks,
            });
        }
    });

    if (resourceGroups.length === 0) {
        $utils.toastError('未提取到任何有效资源');
        return jsonify({ list: [] });
    }
    
    return jsonify({
        list: resourceGroups,
    });
}


async function getPlayinfo(ext) {
	ext = argsify(ext)
	return jsonify({ urls: [ext.url] })
}

async function search(ext) {
	ext = argsify(ext);
	const text = ext.text || '';
	const page = ext.page || 1;

	if (!text) {
		return jsonify({ list: [] });
	}

	// 【✅ 完全保留】您的缓存逻辑
	if (searchCache.keyword !== text) {
		try { $log(`新关键词 "${text}"，重置搜索缓存`); } catch(e) { console.log(`新关键词 "${text}"，重置搜索缓存`); }
		searchCache.keyword = text;
		searchCache.data = {};
		searchCache.pagecount = 0;
	}

	if (searchCache.pagecount > 0 && page > searchCache.pagecount) {
		try { $log(`页码越界 (请求第 ${page} 页, 总共 ${searchCache.pagecount} 页)，直接返回空`); } catch(e) { console.log(`页码越界 (请求第 ${page} 页, 总共 ${searchCache.pagecount} 页)，直接返回空`); }
		return jsonify({ list: [], pagecount: searchCache.pagecount });
	}

    if (searchCache.data && searchCache.data[page]) {
        try { $log(`命中第 ${page} 页的缓存`); } catch(e) { console.log(`命中第 ${page} 页的缓存`); }
        return jsonify({
            list: searchCache.data[page],
            pagecount: searchCache.pagecount
        });
    }

	try { $log(`缓存未命中，请求第 ${page} 页`); } catch(e) { console.log(`缓存未命中，请求第 ${page} 页`); }
    
    // 【✅ 已修改】 - 适配新的搜索URL格式
	const url = `${appConfig.site}/search/${encodeURIComponent(text)}----------${page}---.html`;
	
	const { data } = await $fetch.get(url, {
		headers: { 'User-Agent': UA },
	});

	const $ = cheerio.load(data);
	const cards = [];

    // 【✅ 已修改】 - 适配新的搜索结果列表选择器
	$('.hl-one-list .hl-list-item').each((_, e) => {
		const a = $(e).find('a.hl-item-thumb');
		const href = a.attr('href');
		const title = $(e).find('.hl-item-title a').attr('title');
		const cover = a.attr('data-original');
        const remarks = $(e).find('.hl-pic-text .remarks').text().trim();

		cards.push({
			vod_id: href,
			vod_name: title,
			vod_pic: cover,
			vod_remarks: remarks,
			ext: {
				url: `${appConfig.site}${href}`,
			},
		});
	});

	// 【✅ 已修改】 - 适配新的搜索分页总数提取逻辑
	let pagecount = searchCache.pagecount;
    if (pagecount === 0) {
        const pageInfo = $('.hl-page-total').text().trim(); // 格式: "当前页 / 总页数"
        if (pageInfo) {
            const parts = pageInfo.split('/');
            if (parts.length === 2) {
                pagecount = parseInt(parts[1].trim()) || 0;
            }
        }
    }

	// 【✅ 完全保留】您的分页健壮性判断
	if (cards.length === 0) {
		pagecount = page > 1 ? page - 1 : (pagecount > 0 ? pagecount : 1);
	} else if (pagecount === 0) {
		pagecount = page;
	}

	searchCache.pagecount = pagecount;
	searchCache.data[page] = cards;
    try { $log(`第 ${page} 页数据已缓存，计算总页数为: ${pagecount}`); } catch(e) { console.log(`第 ${page} 页数据已缓存，计算总页数为: ${pagecount}`); }

	return jsonify({
		list: cards,
		pagecount: pagecount,
	});
}
