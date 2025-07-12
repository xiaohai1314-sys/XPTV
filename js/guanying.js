// 观影网脚本 - 2025-07-12 修复版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) Mobile/15E148'

const appConfig = {
    ver: 3, // 更新版本号
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
    
    try {
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            timeout: 10000 // 10秒超时
        });
        
        // 检测DNS劫持或错误页面
        if (data.includes('p.error') || data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持或错误页面");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 尝试从HTML元素中提取数据
        const cardsFromHTML = parseCardsFromHTML($);
        if (cardsFromHTML.length > 0) {
            return jsonify({ list: cardsFromHTML });
        }
        
        // 方法2: 尝试从脚本中提取JSON数据
        const cardsFromScript = parseCardsFromScript($);
        if (cardsFromScript.length > 0) {
            return jsonify({ list: cardsFromScript });
        }
        
        // 方法3: 尝试从内联数据中提取
        const cardsFromInline = parseCardsFromInlineData($);
        if (cardsFromInline.length > 0) {
            return jsonify({ list: cardsFromInline });
        }
        
        return handleError("无法解析页面数据");
    } catch (error) {
        return handleError("网络请求失败: " + error.message);
    }
}

// 解析方法1: 从HTML元素中提取数据
function parseCardsFromHTML($) {
    const cards = [];
    
    // 尝试从.v5d类中提取
    $('.v5d').each((index, element) => {
        const $el = $(element);
        const name = $el.find('b').text().trim() || '未知标题';
        const imgUrl = normalizeImageUrl($el.find('img').attr('src') || '');
        const info = $el.find('p').text().trim() || '暂无信息';
        const path = $el.find('a').attr('href') || '';
        
        if (path) {
            cards.push({
                vod_id: path,
                vod_name: name,
                vod_pic: imgUrl,
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}/res/downurl${path}`,
                },
            });
        }
    });
    
    // 如果找到卡片则返回
    if (cards.length > 0) return cards;
    
    // 尝试其他可能的容器
    $('.item, .card, .movie-item').each((index, element) => {
        const $el = $(element);
        const name = $el.find('.title, .name, h2, h3').text().trim() || '未知标题';
        const imgUrl = normalizeImageUrl($el.find('img').attr('src') || '');
        const info = $el.find('.info, .meta, .desc').text().trim() || '暂无信息';
        const path = $el.find('a').attr('href') || '';
        
        if (path) {
            cards.push({
                vod_id: path,
                vod_name: name,
                vod_pic: imgUrl,
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}/res/downurl${path}`,
                },
            });
        }
    });
    
    return cards;
}

// 解析方法2: 从脚本中提取JSON数据
function parseCardsFromScript($) {
    const cards = [];
    
    // 尝试找到包含数据的script标签
    $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (!scriptContent) return;
        
        // 尝试匹配JSON数据
        const jsonMatch = scriptContent.match(/_obj\s*=\s*({[\s\S]*?});/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (jsonData.inlist && jsonData.inlist.i) {
                    jsonData.inlist.i.forEach((item, index) => {
                        cards.push({
                            vod_id: item,
                            vod_name: jsonData.inlist.t[index] || "未知标题",
                            vod_pic: `https://s.tutu.pm/img/${jsonData.ty}/${item}.webp`,
                            vod_remarks: jsonData.inlist.g[index] || "未知信息",
                            ext: {
                                url: `${appConfig.site}res/downurl/${jsonData.ty}/${item}`,
                            },
                        });
                    });
                }
            } catch (e) {
                // 如果解析失败，尝试修复JSON
                try {
                    const fixedJson = jsonMatch[1]
                        .replace(/'/g, '"')
                        .replace(/(\w+):/g, '"$1":')
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');
                    
                    const jsonData = JSON.parse(fixedJson);
                    if (jsonData.inlist && jsonData.inlist.i) {
                        jsonData.inlist.i.forEach((item, index) => {
                            cards.push({
                                vod_id: item,
                                vod_name: jsonData.inlist.t[index] || "未知标题",
                                vod_pic: `https://s.tutu.pm/img/${jsonData.ty}/${item}.webp`,
                                vod_remarks: jsonData.inlist.g[index] || "未知信息",
                                ext: {
                                    url: `${appConfig.site}res/downurl/${jsonData.ty}/${item}`,
                                },
                            });
                        });
                    }
                } catch (e2) {
                    console.error("JSON修复失败:", e2);
                }
            }
        }
    });
    
    return cards;
}

// 解析方法3: 从内联数据属性中提取
function parseCardsFromInlineData($) {
    const cards = [];
    
    // 尝试从带有data-属性的元素中提取
    $('[data-id]').each((index, element) => {
        const $el = $(element);
        const id = $el.attr('data-id') || '';
        const title = $el.attr('data-title') || $el.find('.title').text() || '未知标题';
        const image = $el.attr('data-image') || $el.find('img').attr('src') || '';
        const info = $el.attr('data-info') || $el.find('.info').text() || '暂无信息';
        
        if (id) {
            cards.push({
                vod_id: id,
                vod_name: title,
                vod_pic: normalizeImageUrl(image),
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}res/downurl/${id}`,
                },
            });
        }
    });
    
    return cards;
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        let respstr;
        try {
            respstr = JSON.parse(data);
        } catch (e) {
            // 尝试处理非标准JSON
            try {
                respstr = JSON.parse(data.replace(/[\r\n]/g, '').replace(/'/g, '"'));
            } catch (e2) {
                return handleError("解析资源数据失败");
            }
        }
        
        if (respstr.panlist && respstr.panlist.url) {
            respstr.panlist.url.forEach((item, index) => {
                // 尝试从名称中提取有用信息
                let name = respstr.panlist.name[index] || "资源";
                
                // 简化名称
                name = name
                    .replace(/【.*?】/g, '') // 移除括号内容
                    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ') // 保留中文、字母、数字
                    .replace(/\s+/g, ' ') // 合并空格
                    .trim();
                
                // 如果名称太长，截取前20个字符
                if (name.length > 20) {
                    name = name.substring(0, 20) + '...';
                }
                
                tracks.push({
                    name: name,
                    pan: item,
                    ext: { url: '' },
                })
            });
        } else if (respstr.file) {
            return handleError("需要验证，请前往主站完成验证");
        } else {
            return handleError("没有可用的网盘资源");
        }
        
        return jsonify({
            list: [{ title: '资源列表', tracks }]
        });
    } catch (error) {
        return handleError("获取资源失败: " + error.message);
    }
}

async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] })
}

async function search(ext) {
    ext = argsify(ext)
    let cards = []
    
    let text = encodeURIComponent(ext.text)
    let page = ext.page || 1
    let url = `${appConfig.site}/s/1---${page}/${text}`
    
    try {
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });
        
        const $ = cheerio.load(data)
        return jsonify({ list: parseCardsFromHTML($) });
    } catch (error) {
        return handleError("搜索失败: " + error.message);
    }
}

// ========== 辅助函数 ==========
function handleError(message) {
    console.error(message);
    try {
        $utils.toastError(message);
    } catch (e) {
        // Apple TV可能不支持toastError
    }
    return jsonify({ list: [], error: message });
}

function normalizeImageUrl(url) {
    if (!url) return '';
    
    // 处理协议相对URL
    if (url.startsWith('//')) {
        url = 'https:' + url;
    }
    // 处理相对URL
    else if (!url.startsWith('http')) {
        url = appConfig.site + url.replace(/^\/+/, '');
    }
    
    // 确保使用安全的图片协议
    return url.replace(/^http:/, 'https:');
}
