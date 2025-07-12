// 观影网脚本 - 2025-07-12 TV端专用版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko) TV Safari/604.1'

const appConfig = {
    ver: 30,
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
        console.log(`[TV] 正在请求: ${url}`);
        
        // 添加详细的调试信息
        const startTime = Date.now();
        
        const response = await $fetch.get(url, {
            headers: { 
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Connection": "keep-alive",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            },
            timeout: 20000 // 20秒超时
        });
        
        const endTime = Date.now();
        console.log(`[TV] 收到响应，耗时: ${endTime - startTime}ms`);
        
        // 检查响应状态
        if (response.status !== 200) {
            console.error(`[TV] 请求失败，状态码: ${response.status}`);
            return handleError(`网络请求失败，状态码: ${response.status}`);
        }
        
        const data = response.data;
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            console.warn("[TV] 检测到DNS劫持警告");
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        // 保存HTML用于调试
        try {
            $utils.writeFile("debug.html", data);
            console.log("[TV] 已保存页面到 debug.html");
        } catch (e) {
            console.warn("[TV] 无法保存调试文件");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 从轮播图提取数据
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
        
        // 方法2: 从分类列表提取数据
        const sections = $('section');
        console.log(`[TV] 找到 ${sections.length} 个内容区域`);
        
        sections.each((sectionIndex, section) => {
            const $section = $(section);
            const listItems = $section.find('.pic-list li');
            console.log(`[TV] 区域 ${sectionIndex} 有 ${listItems.length} 个项目`);
            
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
                        vod_id: path.split('/').pop() || `item-${sectionIndex}-${index}`,
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
        });
        
        // 如果两种方法都没找到，尝试备用方法
        if (cards.length === 0) {
            console.warn("[TV] 常规解析失败，尝试备用方法");
            
            // 备用方法1: 尝试解析脚本数据
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
                            const jsonData = JSON.parse(jsonMatch[1]);
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
        }
        
        console.log(`[TV] 总共解析到 ${cards.length} 个卡片`);
        
        if (cards.length > 0) {
            return jsonify({ list: cards });
        } else {
            return handleError("无法解析页面数据，请检查网站结构");
        }
    } catch (error) {
        console.error("[TV] 请求失败:", error);
        return handleError(`网络请求失败: ${error.message}`);
    }
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
            
            // 尝试处理非标准JSON
            try {
                const fixedData = response.data
                    .replace(/'/g, '"')
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
        
        // 使用与getCards相同的解析逻辑
        const listItems = $('.pic-list li, .v5d');
        console.log(`[TV] 找到 ${listItems.length} 个搜索结果`);
        
        listItems.each((index, element) => {
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
