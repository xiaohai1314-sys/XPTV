// 观影网脚本 - 2025-07-12 最终稳定版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) Mobile/15E148'

const appConfig = {
    ver: 1,
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
            }
        });
        
        // 检测DNS劫持或错误页面
        if (data.includes('p.error') || data.includes('DNS劫持')) {
            try {
                // 尝试打开浏览器视图解决DNS劫持
                $utils.openSafari(appConfig.site, UA);
            } catch (e) {
                // Apple TV可能不支持openSafari
            }
            return handleError("检测到DNS劫持或错误页面");
        }
        
        const $ = cheerio.load(data);
        
        // 原始解析方法 - 从脚本中提取数据
        const scriptContent = $('script').filter((_, script) => {
            return $(script).html().includes('_obj.header');
        }).html();

        if (!scriptContent) {
            return handleError("未找到数据脚本");
        }
        
        const jsonStart = scriptContent.indexOf('{');
        const jsonEnd = scriptContent.lastIndexOf('}') + 1;
        const jsonString = scriptContent.slice(jsonStart, jsonEnd);

        const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
        if (!inlistMatch) {
            return handleError("未找到 _obj.inlist 数据");
        }
        
        let inlistData;
        try {
            inlistData = JSON.parse(inlistMatch[1]);
        } catch (e) {
            // 尝试修复JSON格式
            try {
                const fixedJson = inlistMatch[1]
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":');
                inlistData = JSON.parse(fixedJson);
            } catch (e2) {
                return handleError("解析JSON数据失败");
            }
        }
        
        if (!inlistData.i) {
            return handleError("无效的数据格式");
        }

        inlistData.i.forEach((item, index) => {
            cards.push({
                vod_id: item,
                vod_name: inlistData.t[index] || "未知标题",
                vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                vod_remarks: inlistData.g[index] || "未知信息",
                ext: {
                    url: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
                },
            });
        });

        return jsonify({ list: cards });
    } catch (error) {
        return handleError("网络请求失败: " + error.message);
    }
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
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
            const regex = {
                '中英': /中英/g,
                '1080P': /1080P/g,
                '杜比': /杜比/g,
                '原盘': /原盘/g,
                '1080p': /1080p/g,
                '双语字幕': /双语字幕/g,
            };
            
            respstr.panlist.url.forEach((item, index) => {
                let name = ''
                for (const keyword in regex) {
                    const matches = respstr.panlist.name[index].match(regex[keyword]);
                    if (matches) {
                        name = `${name}${matches[0]} `
                    }
                }
                
                tracks.push({
                    name: name.trim() || "资源",
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
            }
        });
        
        const $ = cheerio.load(data);
        $('.v5d').each((index, element) => {
            const name = $(element).find('b').text().trim() || '未知标题';
            const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 
                          $(element).find('img').attr('src') || 
                          '';
            const info = $(element).find('p').text().trim() || '暂无信息';
            const path = $(element).find('a').attr('href') || '';
            
            // 确保图片URL完整
            let fullImgUrl = imgUrl;
            if (imgUrl && !imgUrl.startsWith('http')) {
                fullImgUrl = appConfig.site + imgUrl.replace(/^\/+/, '');
            }
            
            cards.push({
                vod_id: path,
                vod_name: name,
                vod_pic: fullImgUrl,
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}/res/downurl${path}`,
                },
            });
        });
        
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
