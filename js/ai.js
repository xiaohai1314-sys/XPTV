// Netflix视频网站解析器1
// 原始网站: https://www.netflixgc.com

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

const UA = ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36’;
const headers = {
‘Referer’: ‘https://www.netflixgc.com/’,
‘Origin’: ‘https://www.netflixgc.com’,
‘User-Agent’: UA
};

// 获取配置 - 返回分类标签
async function getConfig() {
const config = {
ver: 1,
title: ‘Netflix影视’,
site: ‘https://www.netflixgc.com’,
tabs: [
{ name: ‘电影’, ext: { dmtype: ‘1’ } },
{ name: ‘电视剧’, ext: { dmtype: ‘2’ } },
{ name: ‘漫剧’, ext: { dmtype: ‘3’ } },
{ name: ‘综艺’, ext: { dmtype: ‘23’ } },
{ name: ‘纪录片’, ext: { dmtype: ‘24’ } },
{ name: ‘伦理’, ext: { dmtype: ‘30’ } }
]
};

return jsonify(config);
}

// 获取视频列表
async function getCards(args) {
args = argsify(args);

let results = [];
const apiUrl = ‘https://www.netflixgc.com/api.php/provide/vod/’;
const page = args.page || 1;
const dmtype = args.dmtype;

// 生成加密签名
const timestamp = Math.floor(new Date().getTime() / 1000);
const signStr = ‘DS’ + timestamp + ‘DCC147D11943AF75’;
const sign = CryptoJS.MD5(signStr).toString(CryptoJS.enc.Hex);

// 构建请求参数
const params = `type=${dmtype}&page=${page}&time=${timestamp}&key=${sign}`;

const { data } = await $fetch.get(apiUrl, params, { headers });
const videoList = argsify(data).list;

// 处理每个视频项
videoList.forEach((item) => {
results.push({
vod_id: item.vod_id.toString(),
vod_name: item.vod_name,
vod_pic: item.vod_pic,
vod_remarks: item.vod_remarks,
ext: {
url: ‘https://www.netflixgc.com/voddetail/’ + item.vod_id.toString() + ‘.html’
}
});
});

return jsonify({ list: results });
}

// 获取视频播放列表
async function getTracks(args) {
args = argsify(args);

let trackList = [];
const detailUrl = args.url;

const { data } = await $fetch.get(detailUrl, { headers });
const $ = cheerio.load(data);

// 获取播放源标题
let sourceTitles = [];
$(‘a.swiper-slide’).each((i, elem) => {
const title = $(elem).children().children().children().end().text().trim();
sourceTitles.push(title);
});

// 获取每个播放源的剧集列表
$(‘div.anthology-list-box’).each((i, elem) => {
let trackGroup = {
title: sourceTitles[i] || ‘播放列表’ + (i + 1),
tracks: []
};

```
$(elem).find('a').each((j, episode) => {
  const episodeName = $(episode).text().trim();
  const episodeUrl = $(episode).children(':first').attr('href');
  
  if (episodeName && episodeUrl) {
    trackGroup.tracks.push({
      name: episodeName,
      pan: '',
      ext: {
        url: 'https://www.netflixgc.com' + episodeUrl
      }
    });
  }
});

if (trackGroup.tracks.length > 0) {
  trackList.push(trackGroup);
}
```

});

return jsonify({ list: trackList });
}

// 获取播放地址
async function getPlayinfo(args) {
args = argsify(args);

let playUrl = args.url;

// 第一步：获取播放页面
const { data } = await $fetch.get(playUrl, { headers });

// 提取播放器配置
const match = data.match(/player_aaaa=(.+?)</script>/);
if (!match) {
return jsonify({ urls: [] });
}

const playerConfig = JSON.parse(match[1]);
let finalUrl;

// 根据加密类型解密
if (playerConfig.encrypt === ‘1’) {
// 类型1：直接unescape
finalUrl = unescape(playerConfig.url);
} else if (playerConfig.encrypt === ‘2’) {
// 类型2：base64解码后再获取真实地址
finalUrl = unescape(base64decode(playerConfig.url));
playUrl = ‘https://www.netflixgc.com’ + finalUrl;

```
// 第二步：获取加密的播放地址
const response = await $fetch.get(playUrl, { headers });

// 提取加密的URL和UID
const urlMatch = response.data.match(/"url"\s*:\s*"([^"]+)"/);
const uidMatch = response.data.match(/"uid"\s*:\s*"([^"]+)"/);

if (!urlMatch || !uidMatch) {
  return jsonify({ urls: [] });
}

let encryptedUrl = urlMatch[1].replace(/\\/g, '');
const uid = uidMatch[1];

// AES解密
const key = CryptoJS.enc.Utf8.parse('DS' + uid + 'DCC147D11943AF75');
const iv = CryptoJS.enc.Utf8.parse('2F131BE91247866E');

const decrypted = CryptoJS.AES.decrypt(
  { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) },
  key,
  {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }
);

finalUrl = CryptoJS.enc.Utf8.stringify(decrypted);
```

}

return jsonify({ urls: [finalUrl] });
}

// 搜索功能
async function search(args) {
args = argsify(args);

let results = [];
const keyword = encodeURIComponent(args.text);
const page = args.page || 1;

const searchUrl = ‘https://www.netflixgc.com/vodsearch/’ + keyword + ‘–––––’ + page + ‘—.html’;

const { data } = await $fetch.get(searchUrl, { headers });
const $ = cheerio.load(data);

$(‘li.search-list’).each((i, elem) => {
const link = $(elem).find(‘a.public-list-exp’).children(’:first’).attr(‘href’);
const name = $(elem).find(‘a.thumb-txt’).text().trim();
const pic = $(elem).find(‘a.public-list-exp’).children(’:first’)
.find(‘img’).children(’:first’).attr(‘data-src’);
const remarks = $(elem).find(‘span.public-list-prb’).text().trim();

```
if (link && name) {
  results.push({
    vod_id: link,
    vod_name: name,
    vod_pic: pic || '',
    vod_remarks: remarks || '',
    ext: {
      url: 'https://www.netflixgc.com' + link
    }
  });
}
```

});

return jsonify({ list: results });
}

// Base64解码辅助函数
function base64decode(input) {
const base64Chars = ‘ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=’;
const lookup = {};

for (let i = 0; i < 64; i++) {
lookup[base64Chars.charAt(i)] = i;
}

let output = ‘’;
let chr1, chr2, chr3;
let enc1, enc2, enc3, enc4;
let i = 0;

// 移除非base64字符
input = input.replace(/[^A-Za-z0-9+/=]/g, ‘’);

while (i < input.length) {
enc1 = lookup[input.charAt(i++)];
enc2 = lookup[input.charAt(i++)];
enc3 = lookup[input.charAt(i++)];
enc4 = lookup[input.charAt(i++)];

```
chr1 = (enc1 << 2) | (enc2 >> 4);
chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
chr3 = ((enc3 & 3) << 6) | enc4;

output += String.fromCharCode(chr1);

if (enc3 !== 64) {
  output += String.fromCharCode(chr2);
}
if (enc4 !== 64) {
  output += String.fromCharCode(chr3);
}
```

}

return output;
}
