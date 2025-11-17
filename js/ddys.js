/**
 * Nullbr 影视库前端插件 - V45.0 (硬编码终极测试版)
 *
 * 变更日志:
 * - V45.0 (2025-11-17):
 *   - [最终诊断] 承认所有尝试均失败，问题的根源在于JS变量无法传递给$fetch函数。
 *   - [硬编码URL] 放弃所有变量和逻辑，直接在 home() 函数中硬编码一个绝对URL进行请求。
 *   - [废弃category] category() 函数被完全废弃，不再使用。
 *   - 此版本的唯一目的，是测试 $fetch.get() 在这个环境中到底能否工作。
 *
 * 作者: Manus
 * 日期: 2025-11-17
 */

const API_BASE_URL = 'http://192.168.1.7:3003';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function jsonify(data ) { return JSON.stringify(data); }
function log(msg) { console.log(`[Nullbr V45.0] ${msg}`); }

const CATEGORIES = [
    { name: '热门电影', ext: { id: 2142788 } },
    { name: '热门剧集', ext: { id: 2143362 } },
    { name: '高分电影', ext: { id: 2142753 } },
    { name: '高分剧集', ext: { id: 2143363 } },
];

// --- 入口函数 ---
async function init(ext) { return jsonify({}); }
async function getConfig() { return jsonify({ ver: 45.0, title: 'Nullbr影视库 (V45)', site: API_BASE_URL, tabs: CATEGORIES }); }

// ★★★★★【这是本次的唯一核心：在 home() 中直接硬编码请求】★★★★★
async function home() {
    log("home() 调用，准备发起硬编码请求...");

    // ★★★ 直接写死一个绝对有效的URL ★★★
    const hardcoded_url = "http://192.168.1.7:3003/api/list?id=2142788&page=1";
    log(`硬编码URL: ${hardcoded_url}` );

    try {
        const response = await $fetch.get(hardcoded_url);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (!data || !Array.isArray(data.items)) {
            log("硬编码请求成功，但后端未返回有效items");
            return jsonify({ list: [] });
        }

        log(`硬编码请求成功，获取到 ${data.items.length} 个项目`);
        const cards = data.items.map(item => ({
            vod_id: `${item.media_type}_${item.tmdbid}`,
            vod_name: item.title || '未命名',
            vod_pic: item.poster ? `${TMDB_IMAGE_BASE_URL}${item.poster}` : "",
            vod_remarks: item.vote_average > 0 ? `⭐ ${item.vote_average.toFixed(1)}` : (item.release_date ? item.release_date.substring(0, 4) : '')
        }));
        
        // ★★★ 直接在首页返回列表数据 ★★★
        return jsonify({ list: cards });

    } catch (err) {
        log(`硬编码请求失败: ${err.message}`);
        // 如果失败，返回一个错误信息卡片
        return jsonify({
            list: [{
                vod_name: '硬编码请求失败',
                vod_remarks: err.message,
                vod_id: 'error'
            }]
        });
    }
}

// ★★★★★【废弃所有分类和列表函数，避免任何变量传递】★★★★★
async function category(tid, pg, filter, ext) {
    log("category() 已被废弃，不执行任何操作");
    return jsonify({ list: [] });
}

async function getCards(ext) {
    log("getCards() 已被废弃，不执行任何操作");
    return jsonify({ list: [] });
}

// --- 占位函数 ---
async function detail(id) { return jsonify({}); }
async function play(flag, id, flags) { return jsonify({ url: "" }); }
async function search(wd, quick) { return jsonify({ list: [] }); }
