// 观影网脚本 - 终极稳定版 (同时解决TV端和手机端问题)
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

// 双模式配置：手机端和TV端使用不同的解析方式
const isTV = typeof $device !== 'undefined' && $device.isTV;
const appConfig = {
    ver: 40,
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
        console.log(`${isTV ? '[TV]' : '[Mobile]'} 正在请求: ${url}`);
        
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Connection": "keep-alive"
            },
            timeout: 30000
        });
        
        if (response.status !== 200) {
            return handleError(`请求失败，状态码: ${response.status}`);
        }
        
        const data = response.data;
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        const $ = cheerio.load(data);
        
        // TV端使用备用API获取数据
        if (isTV) {
            return await getCardsForTV(ext);
        }
        
        // 手机端使用HTML解析
        return parseItems($, {
            itemSelector: '.pic-list li, .v5d',
            titleSelector: 'h3, b',
            imgSelector: 'img',
            infoSelector: 'p',
            linkSelector: 'a'
        });
        
    } catch (error) {
        return handleError(`请求失败: ${error.message}`);
    }
}

// TV端专用卡片获取
async function getCardsForTV(ext) {
    let cards = []
    let { page = 1, id } = ext
    const type = id.replace('?page=', ''); // 提取类型: mv/tv/ac
    
    // 使用备用API获取数据
    const apiUrl = `${appConfig.site}api/list?type=${type}&page=${page}`;
    console.log(`[TV] 使用备用API: ${apiUrl}`);
    
    try {
        const response = await $fetch.get(apiUrl, {
            headers: { 
                "User-Agent": UA,
                "Accept": "application/json"
            }
        });
        
        if (response.status !== 200) {
            return handleError(`API请求失败，状态码: ${response.status}`);
        }
        
        const data = response.data;
        if (!data || !data.items) {
            return handleError("API返回数据格式错误");
        }
        
        // 解析API数据
        data.items.forEach(item => {
            cards.push({
                vod_id: item.id,
                vod_name: item.title,
                vod_pic: item.image,
                vod_remarks: item.info,
                ext: {
                    url: `${appConfig.site}res/downurl/${type}/${item.id}`,
                },
            });
        });
        
        return jsonify({ list: cards });
        
    } catch (error) {
        console.error(`[TV] API请求失败: ${error.message}`);
        return handleError("TV端数据获取失败，请尝试手机端");
    }
}

// 通用解析函数
async function parseItems($, options) {
    const {
        itemSelector,
        titleSelector,
        imgSelector,
        infoSelector,
        linkSelector
    } = options;
    
    const cards = [];
    
    $(itemSelector).each((index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find(linkSelector).first();
            const path = $link.attr('href') || '';
            
            if (!path) return;
            
            const name = $el.find(titleSelector).text().trim() || '未知标题';
            
            // 提取图片URL
            const $img = $el.find(imgSelector).first();
            let imgUrl = $img.attr('src') || 
                        $img.attr('data-src') || 
                        $img.attr('data-srcset') || '';
            
            // 提取信息
            const info = $el.find(infoSelector).text().trim() || '';
            
            // 提取类型
            const type = path.split('/')[1] || 'mv';
            const id = path.split('/').pop() || '';
            
            cards.push({
                vod_id: id,
                vod_name: name,
                vod_pic: normalizeImageUrl(imgUrl),
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}res/downurl/${type}/${id}`,
                },
            });
        } catch (e) {
            console.error("解析失败:", e);
        }
    });
    
    return jsonify({ list: cards });
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        console.log(`${isTV ? '[TV]' : '[Mobile]'} 正在获取资源: ${url}`);
        
        const response = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Referer': appConfig.site
            }
        });
        
        let respstr;
        try {
            respstr = JSON.parse(response.data);
        } catch (e) {
            // 尝试修复JSON
            try {
                const fixedData = response.data
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
                
                // 简化名称
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
    
    let text = encodeURIComponent(ext.text)
    let page = ext.page || 1
    let url = `${appConfig.site}/s/1---${page}/${text}`
    
    try {
        console.log(`${isTV ? '[TV]' : '[Mobile]'} 搜索: ${text}, 页码: ${page}`);
        
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Referer": appConfig.site
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // 使用通用解析函数
        return parseItems($, {
            itemSelector: '.pic-list li, .v5d',
            titleSelector: 'h3, b',
            imgSelector: 'img',
            infoSelector: 'p',
            linkSelector: 'a'
        });
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
        // TV端可能不支持toastError
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
