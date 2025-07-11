// 修改为兼容tvOS和iOS的通用脚本
const cheerio = createCheerio()
// 使用通用User-Agent兼容tvOS和iOS
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const appConfig = {
	ver: 1,
	title: '观影网',
	site: 'https://www.gying.org',
	tabs: [
		{
			name: '电影',
			ext: {
				id: '/mv/------',
			},
		},
		{
			name: '剧集',
			ext: {
				id: '/tv/------',
			},
		},
		{
			name: '动漫',
			ext: {
				id: '/ac/------',
			},
		}
	],
}

// 检测是否为tvOS环境
function isTVOS() {
    return $info && $info.osName === 'tvOS'
}

async function getConfig() {
	return jsonify(appConfig)
}

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext
	const url = appConfig.site + id + page
	
	const { data } = await $fetch.get(url, {
        headers: {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
    });
	
	const $ = cheerio.load(data)
	
	// tvOS优化：使用更健壮的选择器
	if (isTVOS()) {
		// tvOS专用解析逻辑
		const scriptContent = $('script').filter((_, script) => {
			return $(script).html().includes('_obj.header');
		}).html();
		
		if (scriptContent) {
			const jsonStart = scriptContent.indexOf('{');
			const jsonEnd = scriptContent.lastIndexOf('}') + 1;
			const jsonString = scriptContent.slice(jsonStart, jsonEnd);
			
			const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
			if (inlistMatch) {
				try {
					const inlistData = JSON.parse(inlistMatch[1]);
					inlistData["i"].forEach((item, index) => {
						cards.push({
							vod_id: item,
							vod_name: inlistData["t"][index],
							vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
							vod_remarks: inlistData["g"][index], 
							ext: {
								url: `https://www.gyg.la/res/downurl/${inlistData["ty"]}/${item}`,
							},
						})
					});
				} catch (e) {
					$utils.toastError("解析数据失败: " + e.message);
				}
			} else {
				$utils.toastError("未找到 _obj.inlist 数据");
			}
		} else {
			$utils.toastError("未找到包含_obj.header的脚本");
		}
	} else {
		// iOS专用解析逻辑
		const t1 = $('p.error').text()
		if ($('p.error').length > 0) { 
			$utils.openSafari(appConfig.site, UA);
		} else {
			$('.v5d').each((index, element) => {
				const name = $(element).find('b').text().trim() || 'N/A';
				const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || $(element).find('img').attr('src') || 'N/A';
				const additionalInfo = $(element).find('p').text().trim() || 'N/A';
				const pathMatch = $(element).find('a').attr('href') || 'N/A'
				
				cards.push({
					vod_id: pathMatch,
					vod_name: name,
					vod_pic: imgUrl,
					vod_remarks: additionalInfo,
					ext: {
						url: `${appConfig.site}/res/downurl${pathMatch}`,
					},
				})
			});
		}
	}
	
	return jsonify({
		list: cards,
	})
}

async function getTracks(ext) {
	ext = argsify(ext)
    let tracks = []
	let url = ext.url
	
	const { data } = await $fetch.get(url, {
		headers: {
			'User-Agent': UA,
			'Accept': 'application/json'
		},
	})
	
	try {
		const respstr = JSON.parse(data)
		
		if(respstr.hasOwnProperty('panlist')){
			respstr.panlist.url.forEach((item, index) => {
				tracks.push({
					name:'网盘',
					pan: item,
					ext: {
						accessCode: respstr.panlist.code?.[index] || ''
					},
				})
			})
		} else if(respstr.hasOwnProperty('file')){
			$utils.toastError('网盘验证掉签')
		} else {
			$utils.toastError('没有网盘资源');
		}
	} catch (e) {
		$utils.toastError('解析网盘数据失败: ' + e.message)
	}
	
	return jsonify({
		list: [
			{
				title: '资源列表',
				tracks,
			},
		],
	})
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	const url = ext.url
   	  
	return jsonify({ urls: [ext.url] })
}

async function search(ext) {
	ext = argsify(ext)
	
	let text = encodeURIComponent(ext.text)
	let page = ext.page || 1
	let url = `${appConfig.site}/s/1---${page}/${text}`
	
	const { data } = await $fetch.get(url, {
	    headers: {
			"User-Agent": UA,
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    	},
	})
	
	const $ = cheerio.load(data)
	let cards = []
   
	// 统一选择器兼容tvOS和iOS
	$('.v5d, .video-item').each((index, element) => {
		const name = $(element).find('b, .title').text().trim() || 'N/A';
		const imgEl = $(element).find('picture source[data-srcset], img');
		let imgUrl = imgEl.attr('data-srcset') || imgEl.attr('src') || 'N/A';
		
		// 处理相对路径
		if (imgUrl.startsWith('//')) {
			imgUrl = 'https:' + imgUrl;
		} else if (imgUrl.startsWith('/')) {
			imgUrl = appConfig.site + imgUrl;
		}
		
		const additionalInfo = $(element).find('p, .info').text().trim() || 'N/A';
		const pathMatch = $(element).find('a').attr('href') || 'N/A'
		const fullUrl = pathMatch.startsWith('http') ? pathMatch : appConfig.site + pathMatch;
		
		cards.push({
			vod_id: pathMatch,
			vod_name: name,
			vod_pic: imgUrl,
			vod_remarks: additionalInfo,
			ext: {
				url: fullUrl,
			},
		})
	});
	
	return jsonify({
		list: cards,
	})
}

// tvOS专用函数：处理焦点和导航
if (isTVOS()) {
    $focus.onSelect((target) => {
        if (target && target.ext && target.ext.url) {
            $browser.open(target.ext.url);
        }
    });
}
