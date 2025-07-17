const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'
const COOKIE = 'BT_auth=2c8fPECC1SI3ZwBxM4x5tAT_o_DUiRHAQnuN3L5H19o6c92YXWfgU7F2cx8v4Mjz4KNpjbmamhfMyg1tLQLR1LcJTD6ygN9NwAZWgSWIZ8EIU9fseUg0Xn-VThtIMdeXTi9wwE_hLjr_myCwNMoaJEwEekaCZVPr-x3MRqV91IbZxEUF9PPXRw;BT_cookietime=bb42AxkxuuufNMDq9B2C9EYsYRCSfb4vWkxzVNsexGTryT4vPnGs;browser_verified=b142dc23ed95f767248f452739a94198;'

const appConfig = {
	ver: 1,
	title: '观影网',
	site: 'https://www.gying.org/',
	tabs: [
		{
			name: '电影',
			ext: {
				id: 'mv?page=',
			},
		},
		{
			name: '剧集',
			ext: {
				id: 'tv?page=',
			},
		},
		{
			name: '动漫',
			ext: {
				id: 'ac?page=',
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
	const url = `${appConfig.site}${id}${page}`
	
	const { data } = await $fetch.get(url, {
		headers: { "User-Agent": UA, "Cookie": COOKIE },
	});
	const $ = cheerio.load(data)
	
	/*
	  const t1 = $('p.error').text()
	  if ($('p.error').length > 0) { 
		// $utils.openSafari(appConfig.site, UA); 
	  }
	*/
	  
	const scriptContent = $('script').filter((_, script) => {
		return $(script).html().includes('_obj.header');
	}).html();

	if (!scriptContent) {
		console.log("错误：未能从页面中定位到关键的<script>数据。");
		return jsonify({ list: [] });
	}

	const jsonStart = scriptContent.indexOf('{');
	const jsonEnd = scriptContent.lastIndexOf('}') + 1;
	const jsonString = scriptContent.slice(jsonStart, jsonEnd);

	const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
	if (!inlistMatch) {
		console.log("错误：解析失败，未找到 _obj.inlist 数据。");
	} else {
		const inlistData = JSON.parse(inlistMatch[1]);
		inlistData["i"].forEach((item, index) => {
			cards.push({
				vod_id: item,
				vod_name: inlistData["t"][index],
				vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
				vod_remarks: inlistData["g"][index], 
				ext: {
					url: `${appConfig.site}res/downurl/${inlistData["ty"]}/${item}`,
				},
			})
		})	
	}
	return jsonify({ list: cards })
}

async function getTracks(ext) {
	ext = argsify(ext)
    let tracks = []
	let url = ext.url

	const { data } = await $fetch.get(url, {
		headers: { 'User-Agent': UA, "Cookie": COOKIE },
	})
	const respstr = JSON.parse(data)

	if (respstr.hasOwnProperty('panlist')) {
		const regex = {
			'中英': /中英/g, '1080P': /1080P/g, '杜比': /杜比/g,
			'原盘': /原盘/g, '1080p': /1080p/g, '双语字幕': /双语字幕/g,
		};
		respstr.panlist.url.forEach((item, index) => {
			let name = ''
			for (const keyword in regex) {
				const matches = respstr.panlist.name[index].match(regex[keyword]);
				if (matches) {
					name = `${name}${matches[0]} `
				}
			}
			tracks.push({
				name: name.trim() || respstr.panlist.name[index],
				pan: item,
				ext: { url: '' },
			})
		})
	} else if (respstr.hasOwnProperty('file')) {
		console.log('提示：此资源可能需要网页验证，TV端无法处理。');
	} else {
		console.log('提示：没有找到可用的网盘资源。');
	}
	return jsonify({
		list: [ { title: '播放列表', tracks } ],
	})
}

async function search(ext) {
	ext = argsify(ext)
	let text = encodeURIComponent(ext.text)
	let page = ext.page || 1
	let url = `${appConfig.site}/s/1---${page}/${text}`

	const { data } = await $fetch.get(url, {
	   headers: { "User-Agent": UA, "Cookie": COOKIE },
	})

	const $ = cheerio.load(data)
	let cards = []
	$('.v5d').each((index, element) => {
		const name = $(element).find('b').text().trim() || 'N/A';
		const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A';
		const additionalInfo = $(element).find('p').text().trim() || 'N/A';
		const pathMatch =  $(element).find('a').attr('href') || 'N/A'
		cards.push({
			vod_id: pathMatch,
			vod_name: name,
				vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
			vod_remarks: additionalInfo,
			ext: {
				url: `${appConfig.site}/res/downurl${pathMatch}`,
			},
		})
	});
	return jsonify({ list: cards })
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	return jsonify({ urls: [ext.url] })
}


