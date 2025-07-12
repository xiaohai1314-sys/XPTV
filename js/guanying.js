// 观影网脚本 - TV端直接数据提取版
const appConfig = {
    ver: 100,
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
    const tabConfig = appConfig.tabs.find(tab => tab.ext.id === id)
    
    if (!tabConfig) {
        return handleError("无效的分类ID")
    }
    
    const url = `${appConfig.site}${id}${tabConfig.ext.pageParam}${page}`
    
    try {
        console.log(`[TV] 正在请求: ${url}`);
        
        // 使用更可靠的网络请求方法
        const response = await fetchData(url);
        
        if (!response.success) {
            return handleError(response.message);
        }
        
        const data = response.data;
        
        // 方法1: 尝试提取JSON数据
        const jsonData = extractJsonData(data);
        if (jsonData) {
            cards = parseJsonData(jsonData, id);
            if (cards.length > 0) {
                console.log(`[TV] 从JSON解析到 ${cards.length} 个项目`);
                return jsonify({ list: cards });
            }
        }
        
        // 方法2: 尝试提取HTML数据
        cards = parseHtmlData(data, id);
        if (cards.length > 0) {
            console.log(`[TV] 从HTML解析到 ${cards.length} 个项目`);
            return jsonify({ list: cards });
        }
        
        // 方法3: 尝试直接API调用
        const apiCards = await tryApiCall(id, page);
        if (apiCards.length > 0) {
            console.log(`[TV] 从API解析到 ${apiCards.length} 个项目`);
            return jsonify({ list: apiCards });
        }
        
        return handleError("无法解析页面数据");
    } catch (error) {
        return handleError(`网络请求失败: ${error.message}`);
    }
}

async function fetchData(url) {
    try {
        const startTime = Date.now();
        const response = await $fetch.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (AppleTV; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache"
            },
            timeout: 30000,
            retry: 2
        });
        
        const endTime = Date.now();
        console.log(`[TV] 请求耗时: ${endTime - startTime}ms, 状态码: ${response.status}`);
        
        if (response.status !== 200) {
            return {
                success: false,
                message: `HTTP错误: ${response.status}`
            };
        }
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        return {
            success: false,
            message: `请求失败: ${error.message}`
        };
    }
}

function extractJsonData(html) {
    try {
        const jsonStart = html.indexOf('_obj = {');
        if (jsonStart === -1) return null;
        
        const jsonEnd = html.indexOf('};', jsonStart);
        if (jsonEnd === -1) return null;
        
        const jsonStr = html.substring(jsonStart + 7, jsonEnd + 1);
        
        // 修复常见的JSON格式问题
        const fixedJson = jsonStr
            .replace(/'/g, '"')
            .replace(/(\w+)\s*:/g, '"$1":')
            .replace(/,(\s*[}\]])/g, '$1');
        
        return JSON.parse(fixedJson);
    } catch (e) {
        console.error("[TV] JSON提取失败:", e);
        return null;
    }
}

function parseJsonData(jsonData, type) {
    const cards = [];
    
    if (!jsonData.inlist || !jsonData.inlist.i) {
        return cards;
    }
    
    try {
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
    } catch (e) {
        console.error("[TV] JSON解析失败:", e);
    }
    
    return cards;
}

function parseHtmlData(html, type) {
    const cards = [];
    
    try {
        // 使用正则表达式直接提取数据，避免DOM解析问题
        const itemRegex = /<a\s+href="\/(mv|tv|ac)\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        
        while ((match = itemRegex.exec(html)) !== null) {
            const itemType = match[1];
            const id = match[2];
            const content = match[3];
            
            // 提取标题
            const nameMatch = content.match(/<h3[^>]*>([^<]+)<\/h3>/i) || 
                             content.match(/<b[^>]*>([^<]+)<\/b>/i) || 
                             content.match(/class="tit"[^>]*>([^<]+)<\/a>/i);
            
            const name = nameMatch ? nameMatch[1].trim() : "未知标题";
            
            // 提取图片
            const imgMatch = content.match(/<img[^>]+src="([^"]+)"[^>]*>/i) || 
                            content.match(/<source[^>]+data-srcset="([^"]+)"[^>]*>/i);
            
            let imgUrl = imgMatch ? imgMatch[1] : "";
            
            // 提取描述
            const descMatch = content.match(/<p[^>]*>([^<]+)<\/p>/i);
            const desc = descMatch ? descMatch[1].trim() : "";
            
            cards.push({
                vod_id: id,
                vod_name: name,
                vod_pic: normalizeImageUrl(imgUrl),
                vod_remarks: desc,
                ext: {
                    url: `${appConfig.site}res/downurl/${itemType}/${id}`,
                },
            });
        }
    } catch (e) {
        console.error("[TV] HTML解析失败:", e);
    }
    
    return cards;
}

async function tryApiCall(type, page) {
    const apiUrls = [
        `${appConfig.site}api/${type}?page=${page}`,
        `${appConfig.site}data/${type}.json?page=${page}`,
        `${appConfig.site}ajax/list?type=${type}&page=${page}`
    ];
    
    for (const apiUrl of apiUrls) {
        try {
            console.log(`[TV] 尝试API: ${apiUrl}`);
            
            const response = await $fetch.get(apiUrl, {
                headers: {
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                timeout: 15000
            });
            
            if (response.status === 200 && response.data) {
                // 尝试解析API响应
                try {
                    let data = response.data;
                    
                    // 如果返回的是字符串，尝试解析为JSON
                    if (typeof data === 'string') {
                        data = JSON.parse(data);
                    }
                    
                    if (data.items && Array.isArray(data.items)) {
                        return data.items.map(item => ({
                            vod_id: item.id || item.vod_id,
                            vod_name: item.title || item.name,
                            vod_pic: item.image || item.pic,
                            vod_remarks: item.info || item.remarks,
                            ext: {
                                url: `${appConfig.site}res/downurl/${type}/${item.id || item.vod_id}`,
                            },
                        }));
                    }
                } catch (e) {
                    console.warn(`[TV] API解析失败: ${apiUrl}`, e);
                }
            }
        } catch (error) {
            console.warn(`[TV] API请求失败: ${apiUrl}`, error);
        }
    }
    
    return [];
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    const url = ext.url
    
    try {
        console.log(`[TV] 正在获取资源: ${url}`);
        
        const response = await fetchData(url);
        
        if (!response.success) {
            return handleError(response.message);
        }
        
        const data = response.data;
        let jsonData;
        
        try {
            jsonData = JSON.parse(data);
        } catch (e) {
            // 尝试修复JSON
            try {
                const fixedData = data
                    .replace(/'/g, '"')
                    .replace(/(\w+)\s*:/g, '"$1":')
                    .replace(/,(\s*[}\]])/g, '$1');
                
                jsonData = JSON.parse(fixedData);
            } catch (e2) {
                return handleError("解析资源数据失败");
            }
        }
        
        if (jsonData.panlist && jsonData.panlist.url) {
            jsonData.panlist.url.forEach((item, index) => {
                let name = jsonData.panlist.name[index] || "资源";
                
                // 简化名称
                name = name.replace(/【.*?】/g, '').trim();
                
                // 添加资源类型
                const resourceType = jsonData.panlist.tname[jsonData.panlist.type[index]] || "资源";
                
                tracks.push({
                    name: `${resourceType}: ${name}`,
                    pan: item,
                    ext: { url: '' },
                })
            });
            
            console.log(`[TV] 找到 ${tracks.length} 个资源`);
        } else if (jsonData.file) {
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
    
    const text = encodeURIComponent(ext.text)
    const page = ext.page || 1
    const url = `${appConfig.site}/s/1---${page}/${text}`
    
    try {
        console.log(`[TV] 搜索: ${text}, 页码: ${page}`);
        
        const response = await fetchData(url);
        
        if (!response.success) {
            return handleError(response.message);
        }
        
        // 使用HTML解析
        return jsonify({ list: parseHtmlData(response.data) });
    } catch (error) {
        return handleError(`搜索失败: ${error.message}`);
    }
}

// ========== 辅助函数 ==========
function handleError(message) {
    console.error("[TV] 错误:", message);
    try {
        $utils.toastError(message);
    } catch (e) {
        // TV端可能不支持toastError
    }
    return jsonify({ list: [], error: message });
}

function normalizeImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return appConfig.site + url;
    if (!url.startsWith('http')) return 'https://' + url;
    return url.replace(/^http:/, 'https:');
}
