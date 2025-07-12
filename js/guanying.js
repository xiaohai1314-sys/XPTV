// 方佬改进
// 2025-7-12 优化iOS和Apple TV兼容性
const cheerio = createCheerio()
// 使用兼容iOS和Apple TV的User-Agent
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) Mobile/15E148'

const appConfig = {
    ver: 2, // 更新版本号
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
            headers: { "User-Agent": UA }
        });
        
        // 检测DNS劫持或错误页面
        if (data.includes('p.error') || data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持或错误页面");
        }
        
        const $ = cheerio.load(data)
        
        // 更健壮的JSON数据提取
        const scriptContent = $('script').map((i, el) => $(el).html()).get().join('');
        const jsonStart = scriptContent.indexOf('_obj.header');
        if (jsonStart === -1) return handleError("未找到数据对象");
        
        const jsonString = extractJson(scriptContent, jsonStart);
        if (!jsonString) return handleError("无法解析数据对象");
        
        try {
            const jsonData = JSON.parse(jsonString);
            if (!jsonData.inlist || !jsonData.inlist.i) return handleError("无效的数据格式");
            
            const inlistData = jsonData.inlist;
            
            inlistData.i.forEach((item, index) => {
                cards.push({
                    vod_id: item,
                    vod_name: inlistData.t[index] || "未知标题",
                    vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
                    vod_remarks: inlistData.g[index] || "未知信息",
                    ext: {
                        url: `${appConfig.site}res/downurl/${inlistData.ty}/${item}`,
                    },
                })
            });
        } catch (e) {
            return handleError("解析JSON数据失败: " + e.message);
        }
        
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
            headers: { 'User-Agent': UA }
        });
        
        let respstr;
        try {
            respstr = JSON.parse(data);
        } catch (e) {
            return handleError("解析资源数据失败");
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
                
                // 添加资源类型作为前缀
                const resourceType = respstr.panlist.tname[respstr.panlist.type[index]] || "资源";
                tracks.push({
                    name: `${resourceType}: ${name.trim() || "高质量资源"}`,
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
            headers: { "User-Agent": UA }
        });
        
        const $ = cheerio.load(data)
        
        $('.v5d').each((index, element) => {
            const name = $(element).find('b').text().trim() || '未知标题';
            
            // 更健壮的图片URL获取
            let imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 
                         $(element).find('img').attr('src') || 
                         'https://via.placeholder.com/150';
            
            // 确保URL完整
            if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
            } else if (!imgUrl.startsWith('http')) {
                imgUrl = appConfig.site + imgUrl.replace(/^\/+/, '');
            }
            
            const additionalInfo = $(element).find('p').text().trim() || '暂无信息';
            const pathMatch = $(element).find('a').attr('href') || '';
            
            cards.push({
                vod_id: pathMatch,
                vod_name: name,
                vod_pic: imgUrl,
                vod_remarks: additionalInfo,
                ext: {
                    url: `${appConfig.site}/res/downurl${pathMatch}`,
                },
            })
        });
        
        return jsonify({ list: cards });
    } catch (error) {
        return handleError("搜索失败: " + error.message);
    }
}

// ========== 辅助函数 ==========
function handleError(message) {
    // 在Apple TV上避免使用toastError
    try {
        $utils.toastError(message);
    } catch (e) {
        console.error(message);
    }
    return jsonify({ list: [], error: message });
}

function extractJson(scriptContent, startIndex) {
    // 更健壮的JSON提取方法
    let openBraces = 0;
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = startIndex; i < scriptContent.length; i++) {
        if (scriptContent[i] === '{') {
            if (openBraces === 0) jsonStart = i;
            openBraces++;
        } else if (scriptContent[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
                jsonEnd = i;
                break;
            }
        }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
        return scriptContent.substring(jsonStart, jsonEnd + 1);
    }
    
    return null;
}
