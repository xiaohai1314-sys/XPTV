const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const cheerio = createCheerio();

// 用户配置区域 ================================================
const USER_COOKIE = ""; // 在此填入您的登录Cookie（如果需要）
const REPLY_PROMPT = "您好，本贴含有特定内容，请回复后再查看";
const QUICK_REPLIES = [
    "感谢楼主的分享！",
    "资源太棒了，感谢分享！",
    "非常需要这个资源，感谢！"
];
// ===========================================================

const appConfig = {
    ver: 2,
    title: '网盘资源社',
    site: 'https://www.wpzysq.com',
    tabs: [
        {
            name: '影视/剧集',
            ext: {
                id: 'forum-1.htm?page=',
            },
        },
        {
            name: '4K专区',
            ext: {
                id: 'forum-12.htm?page=',
            },
        },
        {
            name: '动漫区',
            ext: {
                id: 'forum-3.htm?page=',
            },
        },
    ],
};

// 调试日志
function log(msg) {
    try {
        $log(`[网盘资源社] ${msg}`);
    } catch (_) {}
}

async function getConfig() {
    return jsonify(appConfig);
}

async function getCards(ext) {
    ext = argsify(ext);
    const { page = 1, id } = ext;
    const url = `${appConfig.site}/${id}${page}`;
    log(`抓取列表: ${url}`);

    const headers = { 'User-Agent': UA };
    if (USER_COOKIE) headers.Cookie = USER_COOKIE;

    const { data, status } = await $fetch.get(url, {
        headers,
        timeout: 15000,
    });

    if (status !== 200) {
        log(`请求失败: HTTP ${status}`);
        return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    let cards = [];

    $('li[data-href^="thread-"]').each((i, el) => {
        const href = $(el).attr('data-href');
        const title = $(el).find('a').text().trim();
        const postId = href.match(/thread-(\d+)/)?.[1] || '';

        if (href && title) {
            cards.push({
                vod_id: href,
                vod_name: title,
                vod_pic: '',
                vod_remarks: '',
                ext: {
                    url: `${appConfig.site}/${href}`,
                    postId: postId,
                },
            });
        }
    });

    log(`解析到 ${cards.length} 条帖子`);
    return jsonify({ list: cards });
}

async function getTracks(ext) {
    ext = argsify(ext);
    const { url, postId } = ext;
    if (!url) return jsonify({ list: [] });

    log(`加载帖子详情: ${url}`);

    const headers = { 'User-Agent': UA };
    if (USER_COOKIE) headers.Cookie = USER_COOKIE;

    // 第一次获取帖子内容
    let { data, status } = await $fetch.get(url, {
        headers,
        timeout: 15000,
    });

    if (status !== 200) {
        log(`帖子请求失败: HTTP ${status}`);
        return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    let needReply = false;

    // 检查是否需要回复
    if ($('div.t_fsz').text().includes(REPLY_PROMPT)) {
        log(`检测到需要回复的帖子: ${postId}`);
        needReply = true;
        
        // 提取回复所需参数
        const formhash = $('input[name="formhash"]').val();
        const threadid = postId;
        
        if (!formhash || !threadid) {
            log("回复表单参数缺失，无法自动回复");
        } else {
            // 随机选择回复内容
            const randomReply = QUICK_REPLIES[Math.floor(Math.random() * QUICK_REPLIES.length)];
            log(`使用回复内容: ${randomReply}`);
            
            // 构造回复请求
            const replyData = new URLSearchParams({
                formhash: formhash,
                threadid: threadid,
                usesig: '1',
                subject: '',
                message: randomReply,
                posttime: Math.floor(Date.now() / 1000),
                wysiwyg: '1',
                replysubmit: 'true'
            }).toString();
            
            // 发送回复请求
            const replyUrl = `${appConfig.site}/forum.php?mod=post&action=reply&fid=2&tid=${threadid}&extra=&replysubmit=yes`;
            const { status: replyStatus } = await $fetch.post(replyUrl, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': url
                },
                body: replyData,
                timeout: 20000
            });
            
            if (replyStatus === 200 || replyStatus === 302) {
                log(`回复成功，重新加载页面`);
                
                // 重新获取帖子内容
                const { data: newData } = await $fetch.get(url, {
                    headers,
                    timeout: 15000,
                });
                data = newData;
            } else {
                log(`回复失败: HTTP ${replyStatus}`);
            }
        }
    }

    // 提取网盘链接
    const links = extractPanLinks(data);
    const tracks = links.map(link => ({
        name: "网盘链接",
        pan: link,
        ext: {},
    }));

    return jsonify({
        list: [
            {
                title: needReply ? "已回复获取资源" : "直接获取资源",
                tracks: tracks.length > 0 ? tracks : [{ name: "未找到有效网盘链接" }],
            },
        ],
    });
}

function extractPanLinks(html) {
    const $ = cheerio.load(html);
    let links = [];
    
    // 精确匹配网盘链接
    $('a[href*="quark."], a[href*="aliyundrive."], div.t_fsz a').each((i, el) => {
        const href = $(el).attr('href') || '';
        if ((href.includes('quark.cn') || href.includes('aliyundrive.com')) && 
            !href.includes('javascript') && 
            !href.includes('passport')) {
            links.push(href);
        }
    });
    
    // 从文本中提取链接
    const textLinks = html.match(/(https?:\/\/[^\s'"]+)/g) || [];
    textLinks.forEach(link => {
        if ((link.includes('quark.cn') || link.includes('aliyundrive.com')) && 
            !link.includes('security') &&
            !links.includes(link)) {
            links.push(link);
        }
    });
    
    // 去重和过滤
    return [...new Set(links)].filter(link => 
        link.startsWith('http') && 
        !link.includes('wpzysq.com') &&
        !link.includes('login')
    );
}

async function getPlayinfo(ext) {
    return jsonify({ urls: [] });
}

async function search(ext) {
    ext = argsify(ext);
    const text = ext.text || '';
    const page = Math.max(1, parseInt(ext.page) || 1);

    if (!text) {
        log("无关键词");
        return jsonify({ list: [] });
    }

    const url = `${appConfig.site}/search.htm?keyword=${encodeURIComponent(text)}&page=${page}`;
    log(`搜索: ${url}`);

    const headers = { 'User-Agent': UA };
    if (USER_COOKIE) headers.Cookie = USER_COOKIE;

    const { data, status } = await $fetch.get(url, {
        headers,
        timeout: 15000,
    });

    if (status !== 200) {
        log(`搜索失败: HTTP ${status}`);
        return jsonify({ list: [] });
    }

    const $ = cheerio.load(data);
    let cards = [];

    $('div.searchlist li').each((i, el) => {
        const link = $(el).find('a');
        const href = link.attr('href');
        const title = link.text().trim();
        
        if (href && title && href.includes('thread-')) {
            const postId = href.match(/thread-(\d+)/)?.[1] || '';
            cards.push({
                vod_id: href,
                vod_name: title,
                vod_pic: '',
                vod_remarks: $(el).find('font').text().trim(),
                ext: {
                    url: `${appConfig.site}/${href}`,
                    postId: postId,
                },
            });
        }
    });

    log(`搜索到 ${cards.length} 条结果`);
    return jsonify({ 
        list: cards,
        total: cards.length,
        page: page,
        pagesize: 20
    });
}
