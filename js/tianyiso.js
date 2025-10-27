const cheerio = createCheerio();
const CryptoJS = createCryptoJS();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
 
const headers = {
  'User-Agent': UA,
  'Referer': 'http://stp.ezyro.com/',
  'Origin': 'http://stp.ezyro.com',
};
 
const appConfig = {
  ver: 1,
  title: "阿里资源搜索",
  site: "http://stp.ezyro.com/al/",
  tabs: [{
    name: '搜索',
    ext: { url: '/' }
  }]
};
 
async function getConfig() {
  return jsonify(appConfig);
}
 
async function getCards(ext) {
  return jsonify({ list: [] }); // 暂不支持分类卡片
}
 
async function getTracks(ext) {
  const { url } = argsify(ext);
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
 
  let panLinks = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('https://www.aliyundrive.com/s/')) {
      panLinks.push(href);
    }
  });
 
  if (panLinks.length === 0) {
    return jsonify({ list: [] });
  }
 
  return jsonify({
    list: [{
      title: '阿里云盘',
      tracks: panLinks.map(link => ({
        name: '资源链接',
        pan: link
      }))
    }]
  });
}
 
async function getPlayinfo(ext) {
  return jsonify({ urls: [] }); // 不提供直链播放
}
 
async function search(ext) {
  ext = argsify(ext);
  const text = ext.text;
  const page = ext.page || 1;
 
  if (page > 1) return jsonify({ list: [] }); // 仅支持第一页
 
  const url = "http://stp.ezyro.com/al/";
  const { data } = await $fetch.get(url, { headers });
  const $ = cheerio.load(data);
 
  let cards = [];
  let found = false;
 
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const textContent = $(el).text().trim();
 
    if (href && href.startsWith('https://www.aliyundrive.com/s/') && textContent.includes(text)) {
      const vod_name = textContent;
      const vod_id = encodeURIComponent(href);
      cards.push({
        vod_id: vod_id,
        vod_name: vod_name,
        vod_pic: '',
        vod_remarks: '阿里云盘',
        ext: { url: url + `#search=${vod_id}` } // 虚拟详情页
      });
      found = true;
    }
  });
 
  // 如果没找到，尝试模糊匹配标题 
  if (!found) {
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const textContent = $(el).text().trim();
      if (href && href.startsWith('https://www.aliyundrive.com/s/') && textContent.toLowerCase().includes(text.toLowerCase())) {
        const vod_name = textContent;
        const vod_id = encodeURIComponent(href);
        cards.push({
          vod_id: vod_id,
          vod_name: vod_name,
          vod_pic: '',
          vod_remarks: '阿里云盘',
          ext: { url: url + `#search=${vod_id}` }
        });
      }
    });
  }
 
  return jsonify({ list: cards });
}
以上内容由AI搜集并生成，仅供参考
