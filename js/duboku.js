/**
 * Nullbr 影视库前端插件 - V34.0 (接口终极测试版)
 *
 * 目标:
 * - 测试 category 函数是否能被 App 最基本地调用并返回一个硬编码的列表。
 * - 这是验证插件接口规范的最后一步。
 *
 * 使用方法:
 * 1. 替换插件代码为此版本。
 * 2. 重新加载插件。
 * 3. 点击任意一个分类Tab。
 * 4. 如果能看到一个标题为 "Category函数被调用了！" 的列表项，说明接口是对的。
 * 5. 如果仍然是空列表或没反应，说明 category 这个函数名或整个接口规范是错误的。
 */

// 定义分类，确保 home() 能工作
const CATEGORIES = [
    { name: '测试分类1', ext: { id: 'test1' } },
    { name: '测试分类2', ext: { id: 'test2' } },
];

// home 函数，提供分类数据
async function home() {
    return JSON.stringify({
        class: CATEGORIES,
        filters: {}
    });
}

// category 函数，返回一个写死的、绝对简单的列表
async function category(tid, pg, filter, ext) {
    const successCard = {
        vod_name: 'Category函数被调用了！',
        vod_remarks: `接收到的tid是: ${JSON.stringify(tid)}`,
        vod_id: 'success_id',
        vod_pic: 'https://img.zcool.cn/community/01a3815ab95212a8012060c839df75.png@1280w_1l_2o_100sh.png'
    };
    
    return JSON.stringify({
        list: [successCard]
    });
}

// 其他所有函数都暂时移除，保持最简化
async function init(ext) { return "{}"; }
async function detail(id) { return "{}"; }
async function play(flag, id, flags) { return "{}"; }
async function search(wd, quick) { return "{}"; }

// 尝试使用 module.exports 导出函数，这是很多JS环境的要求
try {
    module.exports = {
        init,
        home,
        category,
        detail,
        play,
        search,
    };
} catch(e) {
    // 如果环境不支持 module.exports，会报错，但没关系
}
