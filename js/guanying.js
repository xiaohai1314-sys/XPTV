/**
 * Gying 前端插件 - 终极诊断版 v1.3
 * 
 * --- 版本说明 ---
 * v1.3: 这是一个用于终极诊断的特殊版本。它会捕获 App 调用 getTracks 时传递的所有参数，
 *       并将其完整地显示在界面上。这能帮助我们看清 App 到底传递了什么数据，
 *       从而找到无法解析出 ID 的根本原因。
 * 
 * 作者: 基于用户提供的脚本整合优化
 * 版本: v1.3 (诊断专用)
 */

// ==================== 配置区 ====================
const API_BASE_URL = 'http://192.168.1.6:3001/api';
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64 ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";

// ==================== 工具函数区 ====================
function log(msg) { if (typeof $log === 'function') { $log(`[Gying-Diag] ${msg}`); } else { console.log(`[Gying-Diag] ${msg}`); } }
function jsonify(obj) { return JSON.stringify(obj, null, 2); } // 使用带格式的序列化，方便阅读
function argsify(str) { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch { return {}; } }

// ==================== XPTV App 标准接口 ====================

// 其他函数保持最小化，只关注 getTracks
async function getConfig() { return jsonify({ ver: 1, title: 'Gying (诊断模式)', site: 'gying.org', tabs: [{ name: '剧集', ext: { id: 'tv' } }] }); }
async function getCards(ext) { return jsonify({ list: [] }); }
async function search(ext) { return jsonify({ list: [] }); }

/**
 * [诊断核心] 获取详情和资源
 * 这个函数现在只做一件事：显示 App 传给它的所有参数。
 */
async function getTracks(ext) {
    log('进入 getTracks 诊断模式...');
    
    let received_params_string;
    try {
        // 尝试将接收到的参数格式化为可读的 JSON 字符串
        received_params_string = jsonify(ext);
        log(`收到的原始参数 (格式化后): \n${received_params_string}`);
    } catch (e) {
        // 如果参数无法序列化，则直接转为字符串
        received_params_string = String(ext);
        log(`收到的原始参数 (无法JSON化): ${received_params_string}`);
    }

    // 在 App 界面上显示我们捕获到的参数
    return jsonify({
        list: [
            {
                title: '🔍 App 传入参数诊断结果',
                tracks: [
                    { 
                        name: '请截图以下所有内容',
                        pan: ''
                    }
                ]
            },
            {
                title: '收到的参数内容是:',
                // 将捕获到的参数字符串显示在这里
                tracks: [
                    {
                        name: received_params_string,
                        pan: ''
                    }
                ]
            }
        ]
    });
}

async function getPlayinfo(ext) { return jsonify({ urls: [] }); }

// ==================== 兼容性接口 ====================
async function init() { return await getConfig(); }
async function home(ext) { return await getCards(ext); }
async function category(ext) { return await getCards(ext); }
async function detail(id) { return await getTracks(id); }
async function play(ext) { return await getPlayinfo(ext); }

log('Gying 诊断插件加载完成 v1.3');
