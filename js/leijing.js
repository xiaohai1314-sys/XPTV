// 观影网脚本 - 2025-07-12 TV端兼容版
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Apple; CPU OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)'

const appConfig = {
    ver: 20,
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
        
        // 检测DNS劫持
        if (data.includes('DNS劫持')) {
            return handleError("检测到DNS劫持，请设置DNS为223.5.5.5或119.29.29.29");
        }
        
        const $ = cheerio.load(data);
        
        // 方法1: 从轮播图提取数据
        $('#banner .swiper-slide').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a.pic');
                const path = $link.attr('href') || '';
                const name = $el.find('a.tit span').text().trim() || '未知标题';
                
                // 提取图片URL - 优先使用source标签
                let imgUrl = $link.find('source').attr('data-srcset') || 
                            $link.find('img').attr('src') || 
                            $link.find('img').attr('data-src') || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || Date.now().toString(),
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: "轮播推荐",
                    ext: {
                        url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                    },
                });
            } catch (e) {
                console.error("解析轮播图失败:", e);
            }
        });
        
        // 方法2: 从分类列表提取数据
        $('section').each((sectionIndex, section) => {
            const $section = $(section);
            $section.find('.pic-list li').each((index, element) => {
                try {
                    const $el = $(element);
                    const $link = $el.find('a').first();
                    const path = $link.attr('href') || '';
                    const name = $el.find('h3').text().trim() || '未知标题';
                    
                    // 提取图片URL - 优先使用source标签
                    let imgUrl = $el.find('source').attr('data-srcset') || 
                                $el.find('img').attr('src') || 
                                $el.find('img').attr('data-src') || '';
                    
                    // 提取详细信息
                    const info = $el.find('p').text().trim() || '';
                    
                    cards.push({
                        vod_id: path.split('/').pop() || Date.now().toString(),
                        vod_name: name,
                        vod_pic: normalizeImageUrl(imgUrl),
                        vod_remarks: info,
                        ext: {
                            url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
                        },
                    });
                } catch (e) {
                    console.error("解析列表项失败:", e);
                }
            });
        });
        
        // 方法3: 从脚本提取数据 (备用方法)
        if (cards.length === 0) {
            $('script').each((i, el) => {
                try {
                    const scriptContent = $(el).html();
                    if (!scriptContent || !scriptContent.includes('_obj')) return;
                    
                    // 尝试提取JSON数据
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
                                        vod_remarks: jsonData.inlist.g[index] || "",
                                        ext: {
                                            url: `${appConfig.site}res/downurl/${jsonData.ty}/${item}`,
                                        },
                                    });
                                });
                            }
                        } catch (e) {
                            console.error("解析JSON失败:", e);
                        }
                    }
                } catch (e) {
                    console.error("解析脚本失败:", e);
                }
            });
        }
        
        console.log(`找到 ${cards.length} 个卡片`);
        return jsonify({ list: cards });
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
                
                // 添加资源类型
                const resourceType = respstr.panlist.tname[respstr.panlist.type[index]] || "资源";
                
                tracks.push({
                    name: `${resourceType}: ${name}`,
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
        $('.pic-list li, .v5d').each((index, element) => {
            try {
                const $el = $(element);
                const $link = $el.find('a').first();
                const path = $link.attr('href') || '';
                const name = $el.find('h3, b').text().trim() || '未知标题';
                
                // 提取图片URL
                let imgUrl = $el.find('source').attr('data-srcset') || 
                            $el.find('img').attr('src') || 
                            $el.find('img').attr('data-src') || '';
                
                // 提取信息
                const info = $el.find('p').text().trim() || '';
                
                cards.push({
                    vod_id: path.split('/').pop() || Date.now().toString(),
                    vod_name: name,
                    vod_pic: normalizeImageUrl(imgUrl),
                    vod_remarks: info,
                    ext: {
                        url: `${appConfig.site}res/downurl/${getTypeFromPath(path)}/${path.split('/').pop()}`,
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
