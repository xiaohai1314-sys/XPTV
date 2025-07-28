// --- 可视化诊断 getTracks 函数 ---
async function getTracks(ext) {
    ext = argsify(ext);
    const url = ext.url;
    const tracks = []; // 用来存放诊断信息的“轨道”

    tracks.push({ name: "--- 诊断开始 ---", pan: "url_placeholder", ext: { accessCode: "START" } });
    tracks.push({ name: `1. 目标URL: ${url}`, pan: "url_placeholder", ext: { accessCode: "URL" } });

    try {
        // 步骤一：获取HTML
        const { data } = await $fetch.get(url, { headers: { 'Referer': appConfig.site, 'User-Agent': UA } });
        tracks.push({ name: "2. 成功获取到页面HTML", pan: "url_placeholder", ext: { accessCode: "FETCH_OK" } });

        // 步骤二：检查HTML内容
        const hasLinkInRaw = data.includes("cloud.189.cn");
        tracks.push({ name: `3. HTML中是否包含"cloud.189.cn"?`, pan: "url_placeholder", ext: { accessCode: hasLinkInRaw ? "是(TRUE)" : "否(FALSE)" } });

        if (!hasLinkInRaw) {
            tracks.push({ name: "!!! 关键问题：获取的HTML无链接", pan: "url_placeholder", ext: { accessCode: "HALT" } });
            tracks.push({ name: "原因：可能被反爬或需登录", pan: "url_placeholder", ext: { accessCode: "HALT" } });
            return jsonify({ list: [{ title: "诊断报告", tracks }] });
        }

        // 步骤三：Cheerio解析和查找
        const $ = cheerio.load(data);
        const links = $('a[href*="cloud.189.cn"]');
        tracks.push({ name: `4. Cheerio找到 ${links.length} 个链接`, pan: "url_placeholder", ext: { accessCode: `COUNT_${links.length}` } });

        if (links.length === 0) {
            tracks.push({ name: "!!! 关键问题：选择器找不到a标签", pan: "url_placeholder", ext: { accessCode: "SELECTOR_FAIL" } });
        } else {
            // 步骤四：遍历链接并测试正则
            links.each((i, el) => {
                const href = $(el).attr('href');
                tracks.push({ name: `--- 正在检查第 ${i + 1} 个链接 ---`, pan: "url_placeholder", ext: { accessCode: `ITEM_${i+1}` } });
                
                // 为了避免显示内容过长，我们只显示部分href
                const shortHref = href.length > 50 ? href.substring(0, 50) + "..." : href;
                tracks.push({ name: `5. Href内容: ${shortHref}`, pan: href, ext: { accessCode: "HREF_VAL" } });

                const hrefPattern = /(https?:\/\/cloud\.189\.cn\/[^\s（(]+ )[\s（(]+(?:访问码|密码|code)[:：\s]*([a-zA-Z0-9]{4,6})/;
                const hrefMatch = href.match(hrefPattern);

                if (hrefMatch) {
                    tracks.push({ name: "6. 正则匹配成功!", pan: hrefMatch[1], ext: { accessCode: hrefMatch[2] } });
                } else {
                    tracks.push({ name: "6. 正则匹配失败!", pan: "url_placeholder", ext: { accessCode: "REGEX_FAIL" } });
                }
            });
        }

    } catch (e) {
        tracks.push({ name: "!!! 脚本发生严重错误 !!!", pan: "url_placeholder", ext: { accessCode: "ERROR" } });
        tracks.push({ name: `错误信息: ${e.message}`, pan: "url_placeholder", ext: { accessCode: "ERROR_MSG" } });
    }
    
    tracks.push({ name: "--- 诊断结束 ---", pan: "url_placeholder", ext: { accessCode: "END" } });

    // 将诊断结果作为播放列表返回
    return jsonify({ list: [{ title: "诊断报告 (请截图)", tracks }] });
}
