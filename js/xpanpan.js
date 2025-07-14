<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>TVBox 解析器</title>
  <link rel="stylesheet" href="style.css"  />
</head>
<body>
  <h1>TVBox 资源解析器</h1>
 
  <section>
    <h2>分类浏览</h2>
    <select id="categorySelect">
      <option value="forum-1.htm?page="> 影视/剧集</option>
      <option value="forum-12.htm?page=">4K 专区</option>
      <option value="forum-3.htm?page="> 动漫区</option>
    </select>
    <button onclick="loadCards()">加载</button>
    <div id="cardsContainer"></div>
  </section>
 
  <section>
    <h2>搜索资源</h2>
    <input type="text" id="searchInput" placeholder="输入关键词" />
    <button onclick="searchResources()">搜索</button>
    <div id="searchResults"></div>
  </section>
 
  <section>
    <h2>获取资源链接</h2>
    <input type="text" id="postUrlInput" placeholder="输入帖子地址" />
    <button onclick="getTracks()">获取链接</button>
    <div id="tracksContainer"></div>
  </section>
 
  <script src="app.js"></script> 
</body>
</html>
