/**
 * reboys.cn 前端插件 - V16 (终极诊断版)
 * 
 * 诊断目的:
 * 彻底解剖 $fetch.get 的返回结果，找出数据到底藏在哪里，以及它是什么类型。
 * 将会生成多个结果，每个结果标题代表一步诊断。
 */

// --- 配置区 (保持不变) ---
const BACKEND_URL = "http://192.168.10.106:3000";
const FALLBACK_PIC = "https://reboys.cn/uploads/image/20250924/cd8b1274c64e589c3ce1c94a5e2873f2.png";
const DEBUG = true;

// --- 辅助函数 ---
function log(msg ) { if (DEBUG) console.log(`[reboys诊断V16] ${msg}`); }
function jsonify(data) { return JSON.stringify(data); }

// --- 插件入口 (简化) ---
async function getConfig() { return jsonify({ ver: 1, title: 'reboys搜(V16-Diag)' }); }
async function init() { return getConfig(); }
async function home() { return jsonify({ class: [] }); }
async function category() { return jsonify({ list: [] }); }
async function detail() { return jsonify({ list: [] }); }
async function play() { return jsonify({ url: '' }); }

// ★★★★★【核心诊断代码】★★★★★
async function search(ext) {
    const text = typeof ext === 'string' ? ext : (ext.text || '');
    if (!text) return jsonify({ list: [] });
    log(`[search] 开始终极诊断，关键词: "${text}"`);
    
    let diagnosticResults = [];
    let step = 1;

    try {
        const url = `${BACKEND_URL}/search?keyword=${encodeURIComponent(text)}&page=1`;
        log(`[search] 准备请求后端URL: ${url}`);
        
        const response = await $fetch.get(url);
        log(`[search] ✓ 成功从后端获取到响应!`);

        // Step 1: 检查 response 本身是什么类型
        const responseType = typeof response;
        diagnosticResults.push({
            vod_name: `[${step++}] 响应类型: ${responseType}`,
            vod_remarks: '检查 $fetch 返回值的类型'
        });

        // Step 2: 尝试将 response 序列化为JSON字符串
        let responseAsString = '[序列化失败]';
        try {
            responseAsString = JSON.stringify(response);
            diagnosticResults.push({
                vod_name: `[${step++}] 响应内容 (序列化后): ${responseAsString.substring(0, 200)}`,
                vod_remarks: '查看完整的响应结构'
            });
        } catch (e) {
            diagnosticResults.push({
                vod_name: `[${step++}] 响应内容: [序列化失败: ${e.message}]`,
                vod_remarks: '响应对象无法被JSON.stringify'
            });
        }

        // Step 3: 检查 response.data 是否存在
        if (typeof response.data !== 'undefined') {
            const dataType = typeof response.data;
            diagnosticResults.push({
                vod_name: `[${step++}] response.data 类型: ${dataType}`,
                vod_remarks: '检查是否存在 .data 字段'
            });

            // Step 4: 尝试序列化 response.data
            let dataAsString = '[序列化失败]';
            try {
                dataAsString = JSON.stringify(response.data);
                diagnosticResults.push({
                    vod_name: `[${step++}] response.data 内容: ${dataAsString.substring(0, 200)}`,
                    vod_remarks: '查看 .data 字段的内容'
                });
            } catch (e) {
                diagnosticResults.push({
                    vod_name: `[${step++}] response.data 内容: [序列化失败: ${e.message}]`,
                    vod_remarks: '.data 字段无法被序列化'
                });
            }

        } else {
            diagnosticResults.push({
                vod_name: `[${step++}] response.data: 不存在`,
                vod_remarks: '响应对象没有 .data 字段'
            });
        }

    } catch (e) {
        log(`❌ [search] 诊断过程中发生严重错误: ${e.message}`);
        diagnosticResults.push({
            vod_name: `[!] 诊断失败: ${e.message}`,
            vod_remarks: '请求后端时发生异常'
        });
    }

    // 为每个结果添加通用字段
    const finalList = diagnosticResults.map(item => ({
        ...item,
        vod_id: Math.random().toString(),
        vod_pic: FALLBACK_PIC
    }));

    log(`[search] 诊断结束，返回 ${finalList.length} 条诊断信息。`);
    return jsonify({ list: finalList });
}
