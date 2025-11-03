const cheerio = createCheerio()
const CryptoJS = createCryptoJS() // 虽然本插件未使用，但保留你原版的变量
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

// 增加 Referer 和 Origin，减少被网站拦截的几率
const headers = {
  'Referer': 'https://www.tianyiso.com/',
  'Origin': 'https://www.tianyiso.com',
  'User-Agent': UA,
}

const appConfig = {
  ver: 2.0, // 版本号升级
  title: "天逸搜 (已修复)",
  site: "https://www.tianyiso.com",
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
}

function argsify(ext) { 
    return (typeof ext === 'string') ? JSON.parse(ext) : (ext || {});
}

function jsonify(data) { 
    return JSON.stringify(data);
}

// --- 插件兼容接口 ---

async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  // 此函数通常用于分类页面，本插件无分类，直接返回空
  return jsonify({
    list: [],
  })
}

/**
 * 修复后的 getTracks：分两步获取，确保拿到密码和最终链接
 */
async function getTracks(ext) {
  const { url } = argsify(ext)
  if (!url) {
      return jsonify({ list: [] });
  }

  // 1. 访问详情页获取密码
  const detailUrl = url;
  let resourceName = '未知资源';
  let password = '';
  
  try {
      const { data } = await $fetch.get(detailUrl, {
          headers,
          timeout: 5000 // 增加超时
      });
      const $ = cheerio.load(data);
      
      // 提取资源名称
      resourceName = $('h3[align="center"]').text().trim() || '未知资源';
      // 提取密码（如果有）
      const passwordCell = $('van-cell[title="密码"] b').text().trim();
      if (passwordCell) {
          password = passwordCell;
      }
  } catch (e) {
      // 详情页获取失败不影响后续跳转
      console.log(`[getTracks] 详情页获取失败: ${e.message}`);
  }
  
  // 2. 访问跳转链接获取最终网盘URL
  const resourceId = detailUrl.split('/').pop();
  const cvUrl = `${appConfig.site}/cv/${resourceId}`;

  try {
      // 追踪重定向获取最终URL
      const response = await $fetch.get(cvUrl, {
          headers,
          redirect: 'follow',
          timeout: 5000 // 增加超时
      });
      
      let finalUrl = response.url || cvUrl;
      
      // 判断网盘类型
      let panName = '天翼云盘';
      if (finalUrl.includes('quark')) {
          panName = '夸克网盘';
      } else if (finalUrl.includes('baidu')) {
          panName = '百度网盘';
      } else if (finalUrl.includes('aliyundrive')) {
          panName = '阿里云盘';
      } else if (finalUrl.includes('189.cn')) {
          panName = '天翼云盘';
      }

      // 构建播放信息
      const trackName = password ?
          `${panName} (密码: ${password})` : panName;

      return jsonify({ 
          list: [{
              title: resourceName,
              tracks: [{
                  name: trackName,
                  pan: finalUrl,
              }]
          }]
      });
  } catch (e) {
      // 最终链接获取失败，返回手动访问
      return jsonify({
          list: [{
              title: resourceName,
              tracks: [{
                  name: `获取失败，请手动访问 (Error: ${e.message})`,
                  pan: detailUrl,
              }]
          }]
      });
  }
}

async function getPlayinfo(ext) {
  // 播放信息接口通常返回空，本插件不涉及播放
  return jsonify({
    urls: [],
  })
}

/**
 * 修复后的 search：修正解析逻辑并增加超时
 */
async function search(ext) {
  ext = argsify(ext)
  let cards = [];

  let text = encodeURIComponent(ext.text)
  let page = ext.page || 1
  if (page > 1) {
    // 该网站搜索翻页不方便，默认只支持第一页
    return jsonify({
      list: cards,
    })
  }

  const url = appConfig.site + `/search?k=${text}`
  
  try {
      // 增加 5 秒超时设置，防止转圈圈
      const { data } = await $fetch.get(url, {
        headers,
        timeout: 5000 
      })
      
      const $ = cheerio.load(data)
      
      // 修正解析器：只查找 href 属性以 /s/ 开头的 <a> 标签
      $('a[href^="/s/"]').each((_, each) => {
        const link = $(each);
        const path = link.attr('href') ?? ''
        
        // 1. 标题：根据 HTML 结构，标题在 div[style*="font-size:medium"] 中
        const title = link.find('div[style*="font-size:medium"]').text().trim();
        
        // 2. 描述（备注）：根据 HTML 结构，描述在 div[style*="padding-bottom"] 中
        const remarks = link.find('div[style*="padding-bottom"]').text().trim();
        
        if (title) {
            cards.push({
              vod_id: path,
              vod_name: title,
              vod_pic: '', // 插件未解析图片，留空
              vod_remarks: remarks, // 使用正确的备注信息
              ext: {
                url: appConfig.site + path,
              },
            })
        }
      })

  } catch (e) {
      console.log(`[search] 搜索失败 (超时/网络错误): ${e.message}`)
  }

  return jsonify({
      list: cards,
  })
}
