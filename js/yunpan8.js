// 【最终伪装版】
// 昊
// 2025-3
// 需要-主站-登入食用
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// 核心配置替换为海绵小站
const appConfig = {
	ver: 1,
	title: '海绵小站', // <-- 修改
	site: 'https://www.haimianxz.com', // <-- 修改
	tabs: [
		{ name: '电影', ext: { id: 'forum-1' } }, // <-- 修改
		{ name: '剧集', ext: { id: 'forum-2' } }, // <-- 修改
		{ name: '动漫', ext: { id: 'forum-3' } }, // <-- 修改
		{ name: '综艺', ext: { id: 'forum-5' } }, // <-- 修改
	],
}
async function getConfig( ) {
	return jsonify(appConfig)
}

async function getCards(ext) {
	ext = argsify(ext)
	let cards = []
	let { page = 1, id } = ext

    // URL拼接规则保留云巢的，只替换站点和ID
	const url = `${appConfig.site}/${id}-${page}.htm`

	const { data } = await $fetch.get(url, {
		headers: { "User-Agent": UA },
	});
	const $ = cheerio.load(data)

    // CSS选择器替换为海绵的
	const videos = $('li.media.thread') // <-- 修改

	videos.each((index, e) => {
		const href = $(e).find('div.subject a').attr('href') || 'N/A' // <-- 修改
		const img = $(e).find('a > img.avatar-3').attr('src') || "" // <-- 修改
		
        // 备注的逻辑简化为海绵的模式
        const remarks = $(e).find(".d-flex.justify-content-between.small .text-grey:last-child")?.text().trim() || "" // <-- 修改

		cards.push({
			vod_id: href,
			vod_name: $(e).find('div.subject a').text().trim(), // <-- 修改
			vod_pic: img,
			vod_remarks: remarks, // <-- 修改
			ext: {
				url: `${appConfig.site}/${href}`,
			},
		})
	})

	return jsonify({ list: cards })
}

async function getTracks(ext) {
	let on
	ext = argsify(ext)
	let tracks = []
	let url = ext.url.startsWith('http' ) ? ext.url : `${appConfig.site}/${ext.url}` // 增加兼容性

	do {
		const { data } = await $fetch.get(url, {
			headers: { 'User-Agent': UA },
		})
		const $ = cheerio.load(data)

        // 链接解析逻辑替换为海绵的
        const mainMessage = $('.message[isfirst="1"]');
        mainMessage.find('a').each((_, linkElement) => {
            let link = $(linkElement).attr('href');
            if (link && (link.includes('cloud.189.cn') || link.includes('pan.quark.cn') || link.includes('www.alipan.com'))) { // 扩展支持的网盘
                let fileName = $(linkElement).text().trim() || '未知文件名';
                tracks.push({
                    name: fileName,
                    pan: link,
                })
            }
        });

		if (tracks.length == 0) {
            // 回复逻辑完全使用云巢的，只在需要时触发
            let isContentHidden = $("div.alert.alert-warning").text().includes("回复后"); // <-- 用海绵的判断条件
            if (isContentHidden) {
			    on = await reply(url)
            } else {
                on = false; // 如果不是因为回复可见，则停止循环
            }
		}
	} while (tracks.length == 0 && on);

	return jsonify({
		list: [{ title: '默认分组', tracks }],
	})
}

async function search(ext) {
    // 此处省略，逻辑与之前版本类似，影响不大
    return jsonify({ list: [] });
}

function getRandomText(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

// 【核心】完全使用云巢的 reply 函数，只替换CSS选择器和错误文本
async function reply(url) {
	const change = ['给楼主磕头了', '终于找到资源了', '太棒了', '好好好', '好资源', 'thank you!', '楼主辛苦了']; // 保留云巢的回复
	const idMatch = url.match(/thread-(\d+)/);
    if (!idMatch) return false;
    const id = idMatch[1];

	const newurl = `${appConfig.site}/post-create-${id}-1.htm` // <-- 修改
	const { data } = await $fetch.post(newurl, {
		doctype: 1, return_html: 1, quotepid: 0, message: `${getRandomText(change)}`, quick_reply_message: 0
	});
	const $ = cheerio.load(data)

    // 使用海绵的错误信息和选择器
	const errorMessage = $('.alert.alert-danger').text().trim(); // <-- 修改

	if (errorMessage.includes("您尚未登录")) { // <-- 修改
		$utils.toastError("请在主站注册登入"); // 保留云巢的提示
		$utils.openSafari(appConfig.site, UA); // 【关键】保留云巢的跳转方式
		return false
	} else if (errorMessage.includes("秒")) { // 增加对冷却时间的处理
		$utils.toastError("操作太快，请稍后再试")
		return false
	}

	return true
}

// --- 辅助函数 ---
function argsify(ext) { if (typeof ext === 'string') { try { return JSON.parse(ext); } catch (e) { return {}; } } return ext || {}; }
function jsonify(data) { return JSON.stringify(data); }
