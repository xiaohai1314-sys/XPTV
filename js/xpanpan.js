/**
 * wpzysq-backend.js (最终整合版 - 2025-07-16)
 *
 * 整合所有功能:
 * - 作为 XPTV App 插件的前置代理，爬取 "网盘资源社" 网站内容。
 * - 启动时自动登录并维持Cookie。
 * - [已优化] 分类页并行抓取海报，提升加载速度。
 * - [已强化] 智能处理"回复可见"的帖子，通过增加“智能等待”确保能提取隐藏的网盘链接。
 * - [已强化] 兼容多种网盘链接格式（夸克、百度、阿里等）及其提取码。
 * - [已强化] 自动修正源网站HTML中的常见链接拼写错误。
 */

const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const bodyParser = require("body-parser");

puppeteer.use(StealthPlugin());

const app = express();

// --- 1. 全局变量与配置 ---
const SITE_URL = "https://www.wpzysq.com";
const LOGIN_CONFIG = {
  email: "1083328569@qq.com",      // 替换成你的登录邮箱
  password: "xiaohai1314"          // 替换成你的登录密码
};

let browserInstance = null;
let siteCookies = [];

// --- 中间件设置 ---
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// --- 2. 核心函数 ---
async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log("🚀 正在启动新的浏览器实例...");
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor"
      ]
    });
    console.log("✅ 浏览器实例启动成功。");
  }
  return browserInstance;
}

async function performLogin(page) {
  console.log("🔐 正在访问登录页...");
  await page.goto(`${SITE_URL}/user-login.htm`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#form", { timeout: 20000 });
  console.log("✍️ 正在输入账号密码...");
  await page.type("#email", LOGIN_CONFIG.email, { delay: 50 });
  await page.type("#password", LOGIN_CONFIG.password, { delay: 50 });
  console.log("🖱️ 正在点击登录按钮...");
  await Promise.all([
    page.click("#submit"),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
  ]);
  const isLoggedIn = await page.evaluate(() => document.body.innerText.includes("退出") || document.querySelector("a[href*=\"logout\"]"));
  if (!isLoggedIn) throw new Error("登录失败，请检查账号密码或网站是否需要验证！");
  console.log("🎉 登录成功！");
  return await page.cookies();
}

async function ensureLogin() {
  if (siteCookies.length > 0) {
    console.log("🍪 Cookie有效，跳过登录。");
    return;
  }
  console.log("⏳ Cookie为空，执行登录流程...");
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    siteCookies = await performLogin(page);
  } finally {
    await page.close();
  }
}

// --- 3. API 路由 ---

app.get("/api/vod", async (req, res) => {
  const { type_id, page: pg = 1 } = req.query;
  console.log(`[分类] 收到请求: type_id=${type_id}, page=${pg}`);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await ensureLogin();
    await page.setCookie(...siteCookies);

    const url = `${SITE_URL}/${type_id.replace(/\?page=$/, "")}?page=${pg}`;
    console.log(`[分类] 正在访问列表页: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const list = await page.evaluate(() => 
      Array.from(document.querySelectorAll(".style3_subject a")).map(a => ({
        vod_id: a.getAttribute("href"),
        vod_name: a.innerText.trim(),
        vod_pic: ""
      }))
    );
    
    await page.close();
    console.log(`[分类] 成功抓取 ${list.length} 条基础数据，开始并行获取海报...`);

    const CONCURRENT_LIMIT = 5;
    const chunks = [];
    for (let i = 0; i < list.length; i += CONCURRENT_LIMIT) {
      chunks.push(list.slice(i, i + CONCURRENT_LIMIT));
    }

    const detailedList = [];
    for (const chunk of chunks) {
      const tasks = chunk.map(async (item) => {
        if (!item.vod_id) return item;
        
        const detailPage = await browser.newPage();
        await detailPage.setRequestInterception(true);
        detailPage.on("request", (req) => {
          if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        try {
          await detailPage.setCookie(...siteCookies);
          await detailPage.goto(`${SITE_URL}/${item.vod_id}`, { waitUntil: "domcontentloaded", timeout: 15000 });
          
          const pic = await detailPage.evaluate(() => {
            const img = document.querySelector(".message[isfirst=\"1\"] img");
            return img ? img.src : "";
          });
          
          return { ...item, vod_pic: pic };
        } catch (e) {
          console.error(`[海报抓取] 抓取 ${item.vod_id} 失败: ${e.message}`);
          return item;
        } finally {
          await detailPage.close();
        }
      });

      const chunkResults = await Promise.all(tasks);
      detailedList.push(...chunkResults);
    }
    
    console.log("[分类] 海报抓取完成，返回数据。");
    res.json({ list: detailedList, total: detailedList.length, page: parseInt(pg), pagecount: 99 });
  } catch (error) {
    console.error(`[分类] 接口错误: ${error.message}`);
    res.status(500).json({ error: error.message, list: [], total: 0 });
  }
});

app.get("/api/search", async (req, res) => {
    const { keyword, wd } = req.query;
    const searchKeyword = keyword || wd;
    console.log(`[搜索] 收到请求: keyword=${searchKeyword}`);
    if (!searchKeyword) return res.status(400).json({ error: "缺少关键词" });

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await ensureLogin();
        await page.setCookie(...siteCookies);
        const searchUrl = `${SITE_URL}/search.htm?keyword=${encodeURIComponent(searchKeyword)}`;
        console.log(`[搜索] 正在访问: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

        const list = await page.evaluate(() => 
            Array.from(document.querySelectorAll(".style3_subject a")).map(a => ({
                vod_id: a.getAttribute("href"),
                vod_name: a.innerText.trim(),
                vod_pic: ""
            }))
        );
        await page.close();
        console.log(`[搜索] 成功抓取 ${list.length} 条数据。`);
        res.json({ list: list, total: list.length });
    } catch (error) {
        console.error(`[搜索] 接口错误: ${error.message}`);
        res.status(500).json({ error: error.message, list: [], total: 0 });
    }
});

app.get("/api/detail", async (req, res) => {
  const { id } = req.query;
  console.log(`[详情] 收到请求: id=${id}`);
  if (!id) return res.status(400).json({ error: "缺少ID" });

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await ensureLogin();
    await page.setCookie(...siteCookies);
    const detailUrl = `${SITE_URL}/${id}`;
    console.log(`[详情] 正在访问: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 60000 });

    const needReply = await page.evaluate(() => {
      const replyAlert = document.querySelector("div.alert.alert-warning, p.alert.alert-warning");
      return replyAlert && replyAlert.innerText.includes("回复");
    });

    if (needReply) {
      console.log("[详情] ⚠️ 检测到需要回复，正在执行自动回帖...");
      await page.waitForSelector("#message", { visible: true, timeout: 10000 });
      await page.type("#message", "感谢楼主的分享！资源太棒了！", { delay: 30 });
      await Promise.all([
        page.click("#submit"),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
      ]);
      console.log("[详情] ✅ 回帖成功，页面已刷新。");
      
      try {
        console.log("[详情] 正在等待回复后可见的链接区域加载...");
        await page.waitForSelector(".message[isfirst=\"1\"] div.alert a[href*=\"pan.\"]", { timeout: 15000 });
        console.log("[详情] ✅ 链接区域已加载，准备提取。");
      } catch (e) {
        console.error("[详情] ❌ 等待链接区域超时，可能回复未成功或页面结构有变。");
      }
    } else {
      console.log("[详情] ℹ️ 无需回复，直接解析。");
    }

    const detail = await page.evaluate(() => {
      const title = document.querySelector("h4.break-all")?.innerText.trim() || "";
      const playUrlParts = new Set();

      const alertDivs = document.querySelectorAll(".message[isfirst=\"1\"] div.alert");

      alertDivs.forEach(div => {
        const linkElement = div.querySelector("a");
        if (!linkElement) return;

        let linkHref = linkElement.href.replace("pan.quaik.cn", "pan.quark.cn").replace("httqs://", "https://");
        const isPanLink = /pan\.quark\.cn|pan\.baidu\.com|aliyundrive\.com|alipan\.com/i.test(linkHref);

        if (isPanLink) {
          let finalUrl = linkHref;
          const divText = div.innerText;

          const textMatch = divText.match(/(?:提取码|访问码|密码|pwd|code)[:：\s]*([a-zA-Z0-9]+)/i);
          if (textMatch && textMatch[1]) {
            finalUrl = `${linkHref} (提取码: ${textMatch[1]})`;
          } else {
            try {
              const urlParams = new URLSearchParams(new URL(linkHref).search);
              const pwd = urlParams.get("pwd");
              if (pwd) {
                finalUrl = `${linkHref.split("?")[0]}?pwd=${pwd} (提取码: ${pwd})`;
              }
            } catch (e) { /* 忽略无效URL的错误 */ }
          }
          playUrlParts.add(finalUrl.trim());
        }
      });

      return { 
        title, 
        playUrl: Array.from(playUrlParts).join("$$$")
      };
    });

    await page.close();
    
    const result = {
      list: [{
        vod_id: id,
        vod_name: detail.title,
        vod_play_from: "网盘",
        vod_play_url: detail.playUrl || "暂无有效网盘链接"
      }]
    };
    
    const linkCount = detail.playUrl ? detail.playUrl.split("$$$").length : 0;
    console.log(`[详情] 数据处理完成，共找到 ${linkCount} 个有效网盘链接。`);
    res.json(result);
  } catch (error) {
    console.error(`[详情] 接口错误: ${error.message}`);
    res.status(500).json({ error: error.message, list: [] });
  }
});

// --- 4. 服务器启动 ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`===================================================`);
  console.log(`  网盘资源社后端代理服务已启动 (最终整合版) `);
  console.log(`===================================================`);
  console.log(`监听地址: http://0.0.0.0:${PORT}`);
  try {
    await ensureLogin();
  } catch (err) {
    console.error("❌ 首次自动登录失败，请检查配置或网络。服务将继续运行，但访问受限内容会失败。");
  }
});


