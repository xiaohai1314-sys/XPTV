// 观影网脚本 - 2025-07-12 终极修复版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) Mobile/15E148'

const appConfig = {
    ver: 10,
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
        console.log(`正在请求: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            },
            timeout: 15000
        });
        
        console.log(`收到响应，长度: ${data.length} 字符`);
        
        // 检测DNS劫持或错误页面
        if (data.includes('p.error') || data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持或错误页面");
        }
        
        const $ = cheerio.load(data);
        
        // 新解析方法：直接从HTML元素提取
        $('.v5d').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a');
                const path = $link.attr('href') || '';
                
                if (!path) return;
                
                // 提取标题
                const name = $el.find('b').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('img').attr('src') || '';
                if (imgUrl && !imgUrl.startsWith('http')) {
                    imgUrl = appConfig.site + imgUrl.replace(/^\/+/, '');
                }
                
                // 提取信息（类别/年份/地区等）
                const info = $el.find('p').text().trim() || '';
                
                // 提取类型（电影/剧集等）
                const type = path.split('/')[1] || 'mv';
                
                cards.push({
                    vod_id: path,
                    vod_name: name,
                    vod_pic: imgUrl,
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析卡片失败:", e);
            }
        });
        
        // 如果找到卡片则返回
        if (cards.length > 0) {
            console.log(`找到 ${cards.length} 个卡片`);
            return jsonify({ list: cards });
        }
        
        // 旧解析方法（备用）
        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (scriptContent) {
            console.log("使用旧版数据提取方法");
            const jsonStart = scriptContent.indexOf('{');
            const jsonEnd = scriptContent.lastIndexOf('}') + 1;
            const jsonString = scriptContent.slice(jsonStart, jsonEnd);

            const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
            if (inlistMatch) {
                let inlistData;
                try {
                    inlistData = JSON.parse(inlistMatch[1]);
                } catch (e) {
                    try {
                        const fixedJson = inlistMatch[1]
                            .replace(/'/g, '"')
                            .replace(/(\w+):/g, '"$1":');
                        inlistData = JSON.parse(fixedJson);
                    } catch (e2) {
                        return handleError("解析JSON失败");
                    }
                }
                
                if (inlistData.i) {
                    inlistData.i.forEach((item, index) => {
                        cards.push({
                            vod_id: item,
                            vod_name: inlistData.t[index] || "未知标题",
                            vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                            vod_remarks: inlistData.g[index] || "",
                            ext: {
                                url: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
                            },
                        });
                    });
                    return jsonify({ list: cards });
                }
            }
        }
        
        return handleError("无法解析页面数据");
    } catch (error) {
        return handleError("请求失败: " + error.message);
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
            // 尝试处理非标准JSON
            try {
                respstr = JSON.parse(data.replace(/'/g, '"'));
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
                
                tracks.push({
                    name: name,
                    pan: item,
                    ext: { url: '' },
                })
            });
            
            console.log(`找到 ${tracks.length} 个资源`);
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
        console.log(`搜索: ${text}, 页码: ${page}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
            }
        });
        
        const $ = cheerio.load(data);
        
        // 使用与getCards相同的解析逻辑
        $('.v5d').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a');
                const path = $link.attr('href') || '';
                
                if (!path) return;
                
                const name = $el.find('b').text().trim() || '未知标题';
                let imgUrl = $el.find('img').attr('src') || '';
                const info = $el.find('p').text().trim() || '';
                const type = path.split('/')[1] || 'mv';
                
                if (imgUrl && !imgUrl.startsWith('http')) {
                    imgUrl = appConfig.site + imgUrl.replace(/^\/+/, '');
                }
                
                cards.push({
                    vod_id: path,
                    vod_name: name,
                    vod_pic: imgUrl,
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析搜索结果失败:", e);
            }
        });
        
        console.log(`找到 ${cards.length} 个搜索结果`);
        return jsonify({ list: cards });
    } catch (error) {
        return handleError("搜索失败: " + error.message);
    }
}

// 错误处理函数
function handleError(message) {
    console.error(message);
    try {
        $utils.toastError(message);
    } catch (e) {
        // Apple TV可能不支持toastError
    }
    return jsonify({ list: [], error: message });
}
