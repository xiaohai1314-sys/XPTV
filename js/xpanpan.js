const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();
const appConfig = {
ver: 1,
title: '网盘资源社',
site: 'https://www.wpzysq.com',
cookie: cookie_test=Gh_2Bfke4QdQEdAGJsZYM5dpa4WBLjlNy8D1XkutgFus5h9alm;bbs_sid=u6q7rpi0p62aobtce1dn1jndml;bbs_token=BiSo9h9RKVLOm51cpkIk9q6YNOTk7TJT_2FH6o1sz7_2Fw_2FNavyFP09tKfBpr_2B3JUwZfIao0WFUCmo_2B6_2BTS2ijFupyL_2BXy8_3D;__mxaf__c1-WWwEoLo0=1752294573;__mxau__c1-WWwEoLo0=9835c974-ddfa-4d60-9411-e4d5652310b6;__mxav__c1-WWwEoLo0=10;__mxas__c1-WWwEoLo0=%7B%22sid%22%3A%222f99d9bf-4332-4d75-8560-f7c681d29fc8%22%2C%22vd%22%3A5%2C%22stt%22%3A1149%2C%22dr%22%3A17%2C%22expires%22%3A1752329521%2C%22ct%22%3A1752327721%7D;', // 替换为你的 cookie
tabs: [
{
name: '影视/剧集',
ext: {
id: 'forum-1.htm?page=',
},
},
{
name: '4K专区',
ext: {
id: 'forum-12.htm?page=',
},
},
{
name: '动漫区',
ext: {
id: 'forum-3.htm?page=',
},
},
],
};
// 调试日志
function log(msg) {
try {
$log([网盘资源社] ${msg});
} catch (_) {}
}
async function getConfig() {
return jsonify(appConfig);
}
async function getCards(ext) {
ext = argsify(ext);
const { page = 1, id } = ext;
const url = ${appConfig.site}/${id}${page};
log(抓取列表: ${url});
const { data, status } = await $fetch.get(url, {
headers: {
'User-Agent': UA,
'Cookie': appConfig.cookie, // 使用 cookie
},
timeout: 10000,
});
if (status !== 200) {
log(请求失败: HTTP ${status});
return jsonify({ list: [] });
}
const $ = cheerio.load(data);
let cards = [];
$('li[data-href^="thread-"]').each((i, el) => {
const href = $(el).attr('data-href');
const title = $(el).find('a').text().trim();
const postId = href.match(/thread-(\d+)/)?.[1] || '';
if (href && title) {
  cards.push({
    vod_id: href,
    vod_name: title,
    vod_pic: '', // 没有缩略图时可为空
    vod_remarks: '',
    ext: {
      url: `${appConfig.site}/${href}`,
      postId: postId,
    },
  });
}

});
log(解析到 ${cards.length} 条帖子);
return jsonify({ list: cards });
}
async function getTracks(ext) {
ext = argsify(ext);
const { url } = ext;
if (!url) return jsonify({ list: [] });
log(加载帖子详情: ${url});
const { data, status } = await $fetch.get(url, {
headers: {
'User-Agent': UA,
'Cookie': appConfig.cookie, // 使用 cookie
},
timeout: 10000,
});
if (status !== 200) {
log(帖子请求失败: HTTP ${status});
return jsonify({ list: [] });
}
// 检查是否需要回复
if (data.includes('您好，本贴含有特定内容，请回复后再查看')) {
log('检测到需要回复，自动回复中...');
const replySuccess = await autoReply(url, appConfig.cookie);
if (!replySuccess) {
log('自动回复失败');
return jsonify({ list: [] });
}
log('自动回复成功，等待页面刷新...');
await waitForPageRefresh(3000); // 等待3秒
log('重新加载帖子详情');
const { data: newData, status: newStatus } = await $fetch.get(url, {
headers: {
'User-Agent': UA,
'Cookie': appConfig.cookie, // 使用 cookie
},
timeout: 10000,
});
if (newStatus !== 200) {
log(帖子重新加载失败: HTTP ${newStatus});
return jsonify({ list: [] });
}
data = newData;
}
// 提取网盘链接
const links = extractPanLinks(data);
const tracks = links.map(link => ({
name: "网盘链接",
pan: link,
ext: {},
}));
return jsonify({
list: [
{
title: "资源列表",
tracks: tracks,
},
],
});
}
async function autoReply(postUrl, cookie) {
const replyUrl = new URL('forum.php?mod=post&action=reply&fid=&tid=', postUrl).toString();
const replyData = {
formhash: '', // 需要从页面中提取
message: '感谢楼主的分享！',
infloat: 'yes',
handlekey: 'fastpost',
};
const { status } = await $fetch.post(replyUrl, {
headers: {
'User-Agent': UA,
'Cookie': cookie,
'Content-Type': 'application/x-www-form-urlencoded',
},
body: new URLSearchParams(replyData).toString(),
timeout: 10000,
});
return status === 200;
}
function extractPanLinks(html) {
console.log('原始HTML:', html); // 打印原始HTML内容
const quarkRegex = /https?://(pan.quark.cn|quark.cn)//g;
const aliyunRegex = /https?://aliyundrive.com//g;
const quarkMatches = html.match(quarkRegex) || [];
const aliyunMatches = html.match(aliyunRegex) || [];
console.log('夸克网盘链接:', quarkMatches); // 打印夸克网盘链接
console.log('阿里云盘链接:', aliyunMatches); // 打印阿里云盘链接
return quarkMatches.concat(aliyunMatches);
}
async function getPlayinfo(ext) {
return jsonify({ urls: [] });
}
async function search(ext) {
ext = argsify(ext);
const text = ext.text || '';
const page = Math.max(1, parseInt(ext.page) || 1);
if (!text) {
log("无关键词");
return jsonify({ list: [] });
}
const url = ${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page};
log(搜索: ${url});
const { data, status } = await $fetch.get(url, {
headers: {
'User-Agent': UA,
'Cookie': appConfig.cookie, // 使用 cookie
},
timeout: 10000,
});
if (status !== 200) {
log(搜索失败: HTTP ${status});
return jsonify({ list: [] });
}
const $ = cheerio.load(data);
let cards = [];
$('li[data-href^="thread-"]').each((i, el) => {
const href = $(el).attr('data-href');
const title = $(el).find('a').text().trim();
if (href && title) {
cards.push({
vod_id: href,
vod_name: title,
vod_pic: '',
vod_remarks: '',
ext: {
url: ${appConfig.site}/${href},
},
});
}
});
return jsonify({ list: cards });
}
// 等待页面刷新
function waitForPageRefresh(timeout) {
return new Promise((resolve) => {
setTimeout(() => {
resolve();
}, timeout);
});
}
