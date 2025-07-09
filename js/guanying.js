const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (AppleTV; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
	ver: 1,
	title: '观影网',
	site: 'https://www.gying.org',
	tabs: [
		{ name: '电影', ext: { id: '/mv/------' } },
		{ name: '剧集', ext: { id: '/tv/------' } },
		{ name: '动漫', ext: { id: '/ac/------' } },
	],
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
		headers: { "User-Agent": UA },
	})

	const $ = cheerio.load(data)

	$('.vbox, .vlist').each((i, el) => {
		const a = $(el).find('a')
		const name = $(el).find('b').text().trim()
		const remarks = $(el).find('p').text().trim()
		const pic = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
		const href = a.attr('href')

		if (href) {
			cards.push({
				vod_id: href,
				vod_name: name,
				vod_pic: pic?.startsWith('http') ? pic : `${appConfig.site}${pic}`,
				vod_remarks: remarks,
				ext: {
					url: `${appConfig.site}/res/downurl${href}`,
				},
			})
		}
	})

	return jsonify({ list: cards })
}

async function getTracks(ext) {
	ext = argsify(ext)
	let url = ext.url
	const { data } = await $fetch.get(url, { headers: { "User-Agent": UA } })
	const respstr = JSON.parse(data)

	let tracks = []

	if (respstr.hasOwnProperty('panlist')) {
		respstr.panlist.url.forEach(item => {
			tracks.push({
				name: '网盘',
				pan: item,
				ext: { url: '' },
			})
		})
	} else if (respstr.hasOwnProperty('file')) {
		$utils.toastError('网盘验证掉签')
	} else {
		$utils.toastError('没有网盘资源')
	}

	return jsonify({
		list: [
			{
				title: '默认分组',
				tracks,
			},
		],
	})
}

async function getPlayinfo(ext) {
	ext = argsify(ext)
	return jsonify({ urls: [ext.url] })
}

async function search(ext) {
	ext = argsify(ext)
	let text = encodeURIComponent(ext.text)
	let page = ext.page || 1
	let url = `${appConfig.site}/s/1---${page}/${text}`
	const { data } = await $fetch.get(url, { headers: { "User-Agent": UA } })

	const $ = cheerio.load(data)
	let cards = []

	$('.v5d').each((_, element) => {
		const name = $(element).find('b').text().trim() || 'N/A'
		const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A'
		const additionalInfo = $(element).find('p').text().trim() || 'N/A'
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
	})

	return jsonify({ list: cards })
}
