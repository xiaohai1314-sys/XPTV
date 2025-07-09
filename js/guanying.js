var cheerio = createCheerio();
var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
var appConfig = {
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
};
 
function getConfig() {
	return JSON.stringify(appConfig);
}
 
function getCards(ext) {
	var args = eval('(' + ext + ')');
	var page = args.page || 1;
	var id = args.id;
	var url = appConfig.site + id + page;
 
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, false); // 同步请求
	xhr.setRequestHeader("User-Agent", UA);
	xhr.send();
 
	if (xhr.status !== 200) {
		alert("加载失败");
		return JSON.stringify({ list: [] });
	}
 
	var data = xhr.responseText;
	var $ = cheerio.load(data);
 
	var scriptContent = $('script').filter(function() {
		return $(this).html().indexOf('_obj.header') > -1;
	}).html();
 
	var jsonStart = scriptContent.indexOf('{');
	var jsonEnd = scriptContent.lastIndexOf('}') + 1;
	var jsonString = scriptContent.slice(jsonStart, jsonEnd);
 
	var inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
	if (!inlistMatch) {
		alert("未找到 _obj.inlist 数据");
		return JSON.stringify({ list: [] });
	}
 
	var inlistData = JSON.parse(inlistMatch[1]);
	var cards = [];
 
	for (var index = 0; index < inlistData["i"].length; index++) {
		var item = inlistData["i"][index];
		cards.push({
			vod_id: item,
			vod_name: inlistData["t"][index],
			vod_pic: 'https://s.tutu.pm/img/' + inlistData["ty"] + '/' + item + '.webp',
			vod_remarks: inlistData["g"][index],
			ext: {
				url: 'https://www.gyg.la/res/downurl/' + inlistData["ty"] + '/' + item,
			},
		});
	}
 
	return JSON.stringify({ list: cards });
}
 
function getTracks(ext) {
	var args = eval('(' + ext + ')');
	var url = args.url;
 
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, false);
	xhr.setRequestHeader("User-Agent", UA);
	xhr.send();
 
	if (xhr.status !== 200) {
		alert("获取轨道失败");
		return JSON.stringify({ list: [] });
	}
 
	var respstr = JSON.parse(xhr.responseText);
	var tracks = [];
 
	if (respstr.hasOwnProperty('panlist')) {
		for (var i = 0; i < respstr.panlist.url.length; i++) {
			tracks.push({
				name: '网盘',
				pan: respstr.panlist.url[i],
				ext: { url: '' }
			});
		}
	} else if (respstr.hasOwnProperty('file')) {
		alert("网盘验证掉签");
	} else {
		alert("没有网盘资源");
	}
 
	return JSON.stringify({
		list: [{
			title: '默认分组',
			tracks: tracks
		}]
	});
}
