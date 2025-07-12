// 观影网脚本 - TV端专用修复版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) TV Safari/604.1'

const appConfig = {
    ver: 60,
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
    let { page = 1, id } = ext
    const url = `${appConfig.site}${id}${page}`
    
    try {
        console.log(`[TV] 正在请求: ${url}`);
        
        // 添加详细的调试信息
        const startTime = Date.now();
        
        // 使用代理友好的配置
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "X-Requested-With": "XMLHttpRequest" // 模拟AJAX请求
            },
            timeout: 30000,
            followRedirects: true,
            retry: 2 // 失败重试2次
        });
        
        const endTime = Date.now();
        console.log(`[TV] 收到响应，耗时: ${endTime - startTime}ms`);
        
        // 检查响应状态
        if (response.status !== 200) {
            console.error(`[TV] 请求失败，状态码: ${response.status}`);
            return handleError(`网络请求失败，状态码: ${response.status}`);
        }
        
        const data = response.data;
        
        // 保存HTML用于调试
        try {
            $utils.writeFile("tv_debug.html", data);
            console.log("[TV] 已保存页面到 tv_debug.html");
        } catch (e) {
            console.warn("[TV] 无法保存调试文件");
        }
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            console.warn("[TV] 检测到DNS劫持警告");
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 尝试解析列表项
        const cards = parseListItems($);
        if (cards.length > 0) {
            console.log(`[TV] 成功解析 ${cards.length} 个项目`);
            return jsonify({ list: cards });
        }
        
        // 方法2: 尝试解析轮播图
        const bannerCards = parseBannerItems($);
        if (bannerCards.length > 0) {
            console.log(`[TV] 成功解析 ${bannerCards.length} 个轮播项目`);
            return jsonify({ list: bannerCards });
        }
        
        // 方法3: 尝试解析脚本数据
        const scriptCards = parseScriptData($);
        if (scriptCards.length > 0) {
            console.log(`[TV] 从脚本解析 ${scriptCards.length} 个项目`);
            return jsonify({ list: scriptCards });
        }
        
        // 方法4: 尝试使用简化选择器
        const simpleCards = parseSimpleItems($);
        if (simpleCards.length > 0) {
            console.log(`[TV] 使用简化选择器解析 ${simpleCards.length} 个项目`);
            return jsonify({ list: simpleCards });
        }
        
        return handleError("无法解析页面数据，请检查 tv_debug.html");
    } catch (error) {
        console.error("[TV] 请求失败:", error);
        return handleError(`网络请求失败: ${error.message}`);
    }
}

function parseListItems($) {
    const cards = [];
    const listItems = $('.pic-list li');
    console.log(`[TV] 找到 ${listItems.length} 个列表项目`);
    
    listItems.each((index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find('a').first();
            const path = $link.attr('href') || '';
            
            if (!path) {
                console.warn("[TV] 列表项目缺少路径");
                return;
            }
            
            const name = $el.find('h3').text().trim() || '未知标题';
            
            // 提取图片URL
            let imgUrl = $el.find('source').attr('data-srcset') || 
                        $el.find('img').attr('src') || 
                        $el.find('img').attr('data-src') || '';
            
            // 提取详细信息
            const info = $el.find('p').text().trim() || '';
            
            cards.push({
                vod_id: path.split('/').pop() || `item-${index}`,
                vod_name: name,
                vod_pic: normalizeImageUrl(imgUrl),
                vod_remarks: info,
                ext: {
                    url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                },
            });
        } catch (e) {
            console.error("[TV] 解析列表项失败:", e);
        }
    });
    
    return cards;
}

function parseBannerItems($) {
    const cards = [];
    const bannerItems = $('#banner .swiper-slide');
    console.log(`[TV] 找到 ${bannerItems.length} 个轮播项目`);
    
    bannerItems.each((index, element) => {
        try {
            const $el = $(element);
            const $link = $el.find('a.pic');
            const path = $link.attr('href') || '';
            
            if (!path) {
                console.warn("[TV] 轮播项目缺少路径");
                return;
            }
            
            const name = $el.find('a.tit span').text().trim() || '未知标题';
            
            // 提取图片URL
            let imgUrl = $link.find('source').attr('data-srcset') || 
                        $link.find('img').attr('src') || 
                        $link.find('img').attr('data-src') || '';
            
            cards.push({
                vod_id: path.split('/').pop() || `banner-${index}`,
                vod_name: name,
                vod_pic: normalizeImageUrl(imgUrl),
                vod_remarks: "轮播推荐",
                ext: {
                    url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                },
            });
        } catch (e) {
            console.error("[TV] 解析轮播图失败:", e);
        }
    });
    
    return cards;
}

function parseScriptData($) {
    const cards = [];
    const scripts = $('script');
    console.log(`[TV] 找到 ${scripts.length} 个脚本`);
    
    scripts.each((i, el) => {
        try {
            const scriptContent = $(el).html();
            if (!scriptContent || !scriptContent.includes('_obj')) return;
            
            console.log("[TV] 找到包含 _obj 的脚本");
            
            const jsonMatch = scriptContent.match(/_obj\s*=\s*({[\s\S]*?});/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    // 尝试修复JSON
                    const fixedJson = jsonMatch[1]
                        .replace(/'/g, '"')
                        .replace(/(\w+):/g, '"$1":')
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');
                    
                    const jsonData = JSON.parse(fixedJson);
                    if (jsonData.inlist && jsonData.inlist.i) {
                        console.log("[TV] 从脚本解析到数据");
                        
                        jsonData.inlist.i.forEach((item, index) => {
                            cards.push({
                                vod_id: item,
                                vod_name: jsonData.inlist.t[index] || "未知标题",
                                vod_pic: `https://s.tutu.pm/img/${jsonData.ty}/${item}.webp`,
                                vod_remarks: jsonData.inlist.g[index] || "",
                                ext: {
                                    url: `${appConfig.site}res/downurl/${jsonData.ty}/${item}`,
                                },
                            });
                        });
                    }
                } catch (e) {
                    console.error("[TV] 解析JSON失败:", e);
                }
            }
        } catch (e) {
            console.error("[TV] 解析脚本失败:", e);
        }
    });
    
    return cards;
}

function parseSimpleItems($) {
    const cards = [];
    // 使用最简单的选择器
    const items = $('a[href*="/mv/"], a[href*="/tv/"], a[href*="/ac/"]');
    console.log(`[TV] 找到 ${items.length} 个链接项目`);
    
    items.each((index, element) => {
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
            
            // 查找最接近的描述
            const info = $el.closest('li, div').find('p, .info').text().trim() || '';
            
            cards.push({
                vod_id: path.split('/').pop() || `simple-${index}`,
                vod_name: name.substring(0, 50), // 限制标题长度
                vod_pic: normalizeImageUrl(imgUrl),
                vod_remarks: info.substring(0, 100), // 限制信息长度
                ext: {
                    url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                },
            });
        } catch (e) {
            console.error("[TV] 解析简单项目失败:", e);
        }
    });
    
    return cards;
}

async function getTracks(ext) {
    ext = argsify(ext)
    let tracks = []
    let url = ext.url
    
    try {
        console.log(`[TV] 正在获取资源: ${url}`);
        
        const response = await $fetch.get(url, {
            headers: { 
                'User-Agent': UA,
                'Referer': appConfig.site,
                'Accept': 'application/json, text/plain, */*'
            }
        });
        
        let respstr;
        try {
            respstr = JSON.parse(response.data);
        } catch (e) {
            console.warn("[TV] JSON解析失败，尝试修复");
            
            // 尝试修复JSON
            try {
                const fixedData = response.data
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                    
                respstr = JSON.parse(fixedData);
            } catch (e2) {
                console.error("[TV] JSON修复失败:", e2);
                return handleError("解析资源数据失败");
            }
        }
        
        if (respstr.panlist && respstr.panlist.url) {
            console.log(`[TV] 找到 ${respstr.panlist.url.length} 个资源`);
            
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
            console.warn("[TV] 需要验证");
            return handleError("需要验证，请前往主站完成验证");
        } else {
            console.warn("[TV] 没有可用资源");
            return handleError("没有可用的网盘资源");
        }
        
        return jsonify({
            list: [{ title: '资源列表', tracks }]
        });
    } catch (error) {
        console.error("[TV] 获取资源失败:", error);
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
        console.log(`[TV] 搜索: ${text}, 页码: ${page}`);
        
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Referer": appConfig.site
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // 使用简化选择器
        const items = $('.pic-list li, .v5d');
        console.log(`[TV] 找到 ${items.length} 个搜索结果`);
        
        items.each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const path = $link.attr('href') || '';
                
                if (!path) {
                    console.warn("[TV] 搜索结果缺少路径");
                    return;
                }
                
                const name = $el.find('h3, b').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('source').attr('data-srcset') || 
                            $el.find('img').attr('src') || 
                            $el.find('img').attr('data-src') || '';
                
                // 提取信息
                const info = $el.find('p').text().trim() || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || `search-${index}`,
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("[TV] 解析搜索结果失败:", e);
            }
        });
        
        console.log(`[TV] 成功解析 ${cards.length} 个搜索结果`);
        return jsonify({ list: cards });
    } catch (error) {
        console.error("[TV] 搜索失败:", error);
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

function getTypeFromPath(path) {
    if (!path) return 'mv';
    if (path.includes('/tv/')) return 'tv';
    if (path.includes('/ac/')) return 'ac';
    if (path.includes('/mv/')) return 'mv';
    return 'mv';
}
