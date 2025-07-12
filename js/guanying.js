// 观影网脚本 - 全兼容修复版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
    ver: 200,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        {
            name: '电影',
            ext: {
                id: 'mv',
                pageParam: '?page='
            },
        },
        {
            name: '剧集',
            ext: {
                id: 'tv',
                pageParam: '?page='
            },
        },
        {
            name: '动漫',
            ext: {
                id: 'ac',
                pageParam: '?page='
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
    const { page = 1, id } = ext
    
    // 修复分类ID问题
    const tabConfig = appConfig.tabs.find(tab => tab.name === id || tab.ext.id === id)
    
    if (!tabConfig) {
        return handleError(`无效的分类ID: ${id}`);
    }
    
    const type = tabConfig.ext.id;
    const url = `${appConfig.site}${type}${tabConfig.ext.pageParam}${page}`
    
    try {
        console.log(`正在请求: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            },
            timeout: 15000
        });
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 从列表项提取数据
        $('.pic-list li').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const path = $link.attr('href') || '';
                
                if (!path) return;
                
                const name = $el.find('h3').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('img').attr('src') || 
                            $el.find('img').attr('data-src') || 
                            $el.find('source').attr('data-srcset') || '';
                
                // 提取信息
                const info = $el.find('p').text().trim() || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || `item-${index}`,
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析列表项失败:", e);
            }
        });
        
        // 方法2: 如果列表项为空，尝试从轮播图提取
        if (cards.length === 0) {
            $('#banner .swiper-slide').each((index, element) => {
                try {
                    const $el = $(element);
                    const $link = $el.find('a.pic');
                    const path = $link.attr('href') || '';
                    
                    if (!path) return;
                    
                    const name = $el.find('a.tit span').text().trim() || '未知标题';
                    
                    // 提取图片URL
                    let imgUrl = $link.find('img').attr('src') || 
                                $link.find('img').attr('data-src') || 
                                $link.find('source').attr('data-srcset') || '';
                    
                    cards.push({
                        vod_id: path.split('/').pop() || `banner-${index}`,
                        vod_name: name,
                        vod_pic: normalizeImageUrl(imgUrl),
                        vod_remarks: "轮播推荐",
                        ext: {
                            url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                        },
                    });
                } catch (e) {
                    console.error("解析轮播图失败:", e);
                }
            });
        }
        
        // 方法3: 如果仍然为空，使用简化选择器
        if (cards.length === 0) {
            $('a[href^="/mv/"], a[href^="/tv/"], a[href^="/ac/"]').each((index, element) => {
                try {
                    const $el = $(element);
                    const path = $el.attr('href') || '';
                    
                    if (!path) return;
                    
                    // 查找最接近的标题元素
                    const name = $el.find('h3, h2, .title, b, strong').text().trim() || 
                                $el.text().trim() || '未知标题';
                    
                    // 查找最接近的图片
                    const $img = $el.find('img').first();
                    let imgUrl = $img.attr('src') || 
                                $img.attr('data-src') || 
                                $img.attr('data-srcset') || '';
                    
                    cards.push({
                        vod_id: path.split('/').pop() || `simple-${index}`,
                        vod_name: name.substring(0, 50), // 限制标题长度
                        vod_pic: normalizeImageUrl(imgUrl),
                        vod_remarks: "",
                        ext: {
                            url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                        },
                    });
                } catch (e) {
                    console.error("解析简单项目失败:", e);
                }
            });
        }
        
        if (cards.length > 0) {
            return jsonify({ list: cards });
        } else {
            return handleError("无法解析页面数据");
        }
    } catch (error) {
        return handleError(`网络请求失败: ${error.message}`);
    }
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        console.log(`正在获取资源: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Referer': appConfig.site
            }
        });
        
        let respstr;
        try {
            respstr = JSON.parse(data);
        } catch (e) {
            // 尝试修复JSON
            try {
                const fixedData = data
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                    
                respstr = JSON.parse(fixedData);
            } catch (e2) {
                return handleError("解析资源数据失败");
            }
        }
        
        if (respstr.panlist && respstr.panlist.url) {
            respstr.panlist.url.forEach((item, index) => {
                // 直接使用原始名称
                let name = respstr.panlist.name[index] || "资源";
                
                // 简化名称（移除多余字符）
                name = name.replace(/【.*?】/g, '').trim();
                
                // 添加资源类型
                const resourceType = respstr.panlist.tname[respstr.panlist.type[index]] || "资源";
                
                tracks.push({
                    name: `${resourceType}: ${name}`,
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
        return handleError(`获取资源失败: ${error.message}`);
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
        console.log(`搜索: ${text}, 页码: ${page}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Referer": appConfig.site
            }
        });
        
        const $ = cheerio.load(data);
        
        // 使用与getCards相同的解析逻辑
        $('.pic-list li, .v5d').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const path = $link.attr('href') || '';
                
                if (!path) return;
                
                const name = $el.find('h3, b').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('img').attr('src') || 
                            $el.find('img').attr('data-src') || 
                            $el.find('source').attr('data-srcset') || '';
                
                // 提取信息
                const info = $el.find('p').text().trim() || '';
                
                // 提取类型
                const type = path.split('/')[1] || 'mv';
                
                cards.push({
                    vod_id: path.split('/').pop() || `search-${index}`,
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析搜索结果失败:", e);
            }
        });
        
        return jsonify({ list: cards });
    } catch (error) {
        return handleError(`搜索失败: ${error.message}`);
    }
}

// ========== 辅助函数 ==========
function handleError(message) {
    console.error(message);
    try {
        $utils.toastError(message);
    } catch (e) {
        // 某些环境可能不支持toastError
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
    else if (url.startsWith('/')) {
        url = appConfig.site + url;
    }
    // 处理无协议URL
    else if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    
    // 确保使用安全的图片协议
    return url.replace(/^http:/, 'https:');
}
