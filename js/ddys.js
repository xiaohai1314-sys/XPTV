const cheerio = createCheerio()
const UA = “Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36”
const headers = {
‘Referer’: ‘https://ddys.la/’,
‘Origin’: ‘https://ddys.la’,
‘User-Agent’: UA,
}

const appConfig = {
ver: 14, // 详细URL显示版
title: “低端影视[URL调试]”,
site: “https://ddys.la”,
tabs: [{
name: ‘首页’,
ext: { url: ‘/’ },
}, {
name: ‘电影’,
ext: { url: ‘/category/dianying.html’ },
}, {
name: ‘剧集’,
ext: { url: ‘/category/juji.html’ },
}, {
name: ‘动漫’,
ext: { url: ‘/category/dongman.html’ },
}, {
name: ‘发现’,
ext: { url: ‘/search/———––.html’ },
}]
}

async function getConfig() {
return jsonify(appConfig)
}

async function getCards(ext) {
ext = argsify(ext);
let cards = [];
let urlPath = ext.url;
let page = ext.page || 1;

if (page > 1) {
if (urlPath === ‘/’) {
return jsonify({ list: [] });
}
if (urlPath.includes(’/search/’)) {
urlPath = urlPath.replace(/(-+\d*-*).html/, `----------${page}---.html`);
} else {
urlPath = urlPath.replace(’.html’, `-${page}.html`);
}
}

const fullUrl = appConfig.site + urlPath;
const { data } = await $fetch.get(fullUrl, { headers });
const $ = cheerio.load(data);

$(‘ul.stui-vodlist > li’).each((_, each) => {
const thumb = $(each).find(‘a.stui-vodlist__thumb’);
const titleLink = $(each).find(‘h4.title > a’);

```
cards.push({
  vod_id: thumb.attr('href'),
  vod_name: titleLink.attr('title'),
  vod_pic: thumb.attr('data-original'),
  vod_remarks: thumb.find('span.pic-text').text().trim(),
  ext: { url: thumb.attr('href') },
})
```

})

return jsonify({ list: cards });
}

async function search(ext) {
ext = argsify(ext);
let cards = [];
let text = encodeURIComponent(ext.text);
let page = ext.page || 1;

const searchUrl = `${appConfig.site}/search/${text}----------${page}---.html`;

const { data } = await $fetch.get(searchUrl, { headers });
const $ = cheerio.load(data);

$(‘ul.stui-vodlist > li’).each((_, each) => {
const thumb = $(each).find(‘a.stui-vodlist__thumb’);
const titleLink = $(each).find(‘h4.title > a’);

```
cards.push({
  vod_id: thumb.attr('href'),
  vod_name: titleLink.attr('title'),
  vod_pic: thumb.attr('data-original'),
  vod_remarks: thumb.find('span.pic-text').text().trim(),
  ext: { url: thumb.attr('href') },
})
```

})

return jsonify({ list: cards });
}

// 🔍 显示完整URL的 getTracks
async function getTracks(ext) {
ext = argsify(ext);
const url = appConfig.site + ext.url;
const { data } = await $fetch.get(url, { headers });
const $ = cheerio.load(data);
let groups = [];

```
// 先尝试提取一个播放页的视频URL作为示例
let sampleVideoUrl = '';
let urlInfo = '';
const firstPlayLink = $('.stui-content__playlist li a').first().attr('href');
if (firstPlayLink) {
    try {
        const playPageUrl = appConfig.site + firstPlayLink;
        const { data: playData } = await $fetch.get(playPageUrl, { headers });
        const match = playData.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
            sampleVideoUrl = match[1];
            
            // 生成详细的URL信息
            let protocol = '';
            if (sampleVideoUrl.startsWith('https://')) protocol = 'HTTPS';
            else if (sampleVideoUrl.startsWith('http://')) protocol = 'HTTP';
            else if (sampleVideoUrl.startsWith('//')) protocol = '//';
            else if (sampleVideoUrl.startsWith('/')) protocol = '相对';
            else protocol = '未知';
            
            let format = '';
            if (sampleVideoUrl.includes('.m3u8')) format = 'M3U8';
            else if (sampleVideoUrl.includes('.mp4')) format = 'MP4';
            else if (sampleVideoUrl.includes('.flv')) format = 'FLV';
            else format = '未知格式';
            
            // 截取URL前50个字符
            let shortUrl = sampleVideoUrl.length > 50 
                ? sampleVideoUrl.substring(0, 50) + '...' 
                : sampleVideoUrl;
            
            urlInfo = `\n[${protocol}][${format}]\n${shortUrl}`;
        }
    } catch (e) {
        urlInfo = '\n[获取失败]';
    }
}

$('.stui-vodlist__head').each((index, head) => {
    const sourceTitle = $(head).find('h3').text().trim();
    const playlist = $(head).next('ul.stui-content__playlist');

    if (playlist.length > 0 && !sourceTitle.includes('猜你喜欢')) {
        // 在线路标题中显示完整URL信息
        let debugTitle = sourceTitle + urlInfo;
        
        let group = { title: debugTitle, tracks: [] };
        
        playlist.find('li a').each((_, trackLink) => {
            group.tracks.push({
                name: $(trackLink).text().trim(),
                pan: '',
                ext: { play_url: $(trackLink).attr('href') }
            });
        });

        if (group.tracks.length > 0) {
            groups.push(group);
        }
    }
});

return jsonify({ list: groups });
```

}

// 最简化的 getPlayinfo - 用于测试
async function getPlayinfo(ext) {
ext = argsify(ext);
const url = appConfig.site + ext.play_url;

```
try {
    const { data } = await $fetch.get(url, { headers });
    const match = data.match(/var player_aaaa.*?url['"]\s*:\s*['"]([^'"]+)['"]/);
    
    if (match && match[1]) {
        let videoUrl = match[1];
        
        // 如果是相对路径，转为绝对路径
        if (videoUrl.startsWith('/') && !videoUrl.startsWith('//')) {
            videoUrl = appConfig.site + videoUrl;
        } else if (videoUrl.startsWith('//')) {
            videoUrl = 'https:' + videoUrl;
        }
        
        // 最简单的返回，不带任何额外参数
        return jsonify({ 
            urls: [videoUrl]
        });
    }
    
    return jsonify({ urls: [] });
    
} catch (error) {
    return jsonify({ urls: [] });
}
```

}
