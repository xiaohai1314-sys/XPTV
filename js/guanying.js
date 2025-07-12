// 观影网脚本 - 终极稳定版
const cheerio = createCheerio();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';

const appConfig = {
    ver: 300,
    title: '观影网',
    site: 'https://www.gying.org/',
    tabs: [
        {
            name: '电影',
            ext: {
                id: 'mv',
                path: '/mv'
            },
        },
        {
            name: '剧集',
            ext: {
                id: 'tv',
                path: '/tv'
            },
        },
        {
            name: '动漫',
            ext: {
                id: 'ac',
                path: '/ac'
            },
        }
    ],
}

async function getConfig() {
    return jsonify(appConfig);
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    
    // 查找匹配的标签配置
    const tabConfig = appConfig.tabs.find(tab => tab.name === id || tab.ext.id === id);
    
    if (!tabConfig) {
        return handleError(`无效的分类ID: ${id}`);
    }
    
    const url = `${appConfig.site}${tabConfig.ext.path}?page=${page}`;
    
    try {
        console.log(`正在请求: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            },
            timeout: 20000
        });
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        // 保存响应用于调试
        try {
            $utils.writeFile("debug.html", data);
        } catch (e) {
            console.log("无法保存调试文件");
        }
        
        // 方法1: 尝试从脚本数据提取
        const scriptCards = parseScriptData(data);
        if (scriptCards.length > 0) {
            console.log(`从脚本数据解析到 ${scriptCards.length} 个项目`);
            return jsonify({ list: scriptCards });
        }
        
        // 方法2: 使用cheerio解析
        const $ = cheerio.load(data);
        const cards = parseHtmlData($, tabConfig.ext.id);
        
        if (cards.length > 0) {
            console.log(`从HTML解析到 ${cards.length} 个项目`);
            return jsonify({ list: cards });
        }
        
        return handleError("无法解析页面数据");
    } catch (error) {
        return handleError(`网络请求失败: ${error.message}`);
    }
}

function parseScriptData(html) {
    const cards = [];
    
    try {
        // 尝试提取JSON数据
        const scriptRegex = /<script>\s*_obj\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/i;
        const match = html.match(scriptRegex);
        
        if (match && match[1]) {
            let jsonData;
            
            // 尝试直接解析
            try {
                jsonData = JSON.parse(match[1]);
            } catch (e) {
                // 尝试修复JSON
                try {
                    const fixedJson = match[1]
                        .replace(/'/g, '"')
                        .replace(/(\w+):/g, '"$1":')
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');
                    
                    jsonData = JSON.parse(fixedJson);
                } catch (e2) {
                    console.error("JSON修复失败:", e2);
                    return cards;
                }
            }
            
            // 检查数据格式
            if (jsonData.inlist && jsonData.inlist.i && Array.isArray(jsonData.inlist.i)) {
                const type = jsonData.ty || 'mv';
                
                jsonData.inlist.i.forEach((id, index) => {
                    cards.push({
                        vod_id: id,
                        vod_name: jsonData.inlist.t[index] || "未知标题",
                        vod_pic: `https://s.tutu.pm/img/${type}/${id}.webp`,
                        vod_remarks: jsonData.inlist.g[index] || "",
                        ext: {
                            url: `${appConfig.site}res/downurl/${type}/${id}`,
                        },
                    });
                });
            }
        }
    } catch (e) {
        console.error("脚本数据解析失败:", e);
    }
    
    return cards;
}

function parseHtmlData($, type) {
    const cards = [];
    
    // 方法1: 解析标准列表项
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
    
    // 方法2: 如果列表项为空，尝试解析其他结构
    if (cards.length === 0) {
        $('.v5d').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const path = $link.attr('href') || '';
                
                if (!path) return;
                
                const name = $el.find('b').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('img').attr('src') || 
                            $el.find('img').attr('data-src') || 
                            $el.find('source').attr('data-srcset') || '';
                
                // 提取信息
                const info = $el.find('p').text().trim() || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || `v5d-${index}`,
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析v5d项目失败:", e);
            }
        });
    }
    
    // 方法3: 最后尝试解析所有包含图片的链接
    if (cards.length === 0) {
        $('a').each((index, element) => {
            try {
                const $el = $(element);
                const $img = $el.find('img');
                
                // 只处理包含图片的链接
                if ($img.length === 0) return;
                
                const path = $el.attr('href') || '';
                const name = $el.text().trim() || $img.attr('alt') || '未知标题';
                
                // 提取图片URL
                let imgUrl = $img.attr('src') || 
                            $img.attr('data-src') || 
                            $img.attr('data-srcset') || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || `link-${index}`,
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: "",
                    ext: {
                        url: `${appConfig.site}res/downurl/${type}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析链接项目失败:", e);
            }
        });
    }
    
    return cards;
}

async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [];
    const url = ext.url;
    
    try {
        console.log(`正在获取资源: ${url}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Referer': appConfig.site
            }
        });
        
        // 尝试解析JSON
        try {
            const jsonData = JSON.parse(data);
            return handleTrackResponse(jsonData);
        } catch (e) {
            // 尝试修复JSON
            try {
                const fixedData = data
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                
                const jsonData = JSON.parse(fixedData);
                return handleTrackResponse(jsonData);
            } catch (e2) {
                return handleError("解析资源数据失败");
            }
        }
    } catch (error) {
        return handleError(`获取资源失败: ${error.message}`);
    }
}

function handleTrackResponse(jsonData) {
    const tracks = [];
    
    if (jsonData.panlist && jsonData.panlist.url) {
        jsonData.panlist.url.forEach((item, index) => {
            // 直接使用原始名称
            let name = jsonData.panlist.name[index] || "资源";
            
            // 简化名称（移除多余字符）
            name = name.replace(/【.*?】/g, '').trim();
            
            // 添加资源类型
            const resourceType = jsonData.panlist.tname[jsonData.panlist.type[index]] || "资源";
            
            tracks.push({
                name: `${resourceType}: ${name}`,
                pan: item,
                ext: { url: '' },
            });
        });
        
        return jsonify({
            list: [{ title: '资源列表', tracks }]
        });
    } else if (jsonData.file) {
        return handleError("需要验证，请前往主站完成验证");
    } else {
        return handleError("没有可用的网盘资源");
    }
}

async function getPlayinfo(ext) {
    return jsonify({ urls: [ext.url] });
}

async function search(ext) {
    ext = argsify(ext);
    const cards = [];
    const text = encodeURIComponent(ext.text);
    const page = ext.page || 1;
    const url = `${appConfig.site}/s/1---${page}/${text}`;
    
    try {
        console.log(`搜索: ${text}, 页码: ${page}`);
        
        const { data } = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Referer": appConfig.site
            }
        });
        
        const $ = cheerio.load(data);
        
        // 解析搜索结果
        $('.v5d, .pic-list li').each((index, element) => {
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
