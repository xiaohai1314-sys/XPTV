//昊
//2025-3-13
//
const cheerio = createCheerio()
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const CryptoJS = createCryptoJS()

const headers = {
  'User-Agent': UA,
}

const appConfig = {
  ver: 1,
  title: "趣盘搜",
  site: "https://pan.funletu.com",
  tabs: [{
    name: '只有搜索功能',
    ext: {
      url: '/'
    },
  }]
}






async function getConfig() {
  return jsonify(appConfig)
}

async function getCards(ext) {
  ext = argsify(ext)
  let cards = []
  return jsonify({
    list: cards,
  })
}

async function getTracks(ext) {
   ext = argsify(ext)
     let tracks = []
  let pan_list =ext.url.split('&')

pan_list.forEach(child=>{


tracks.push({
	name:'',
	pan: child,
	ext: {
	url: '',
	},
})

})




   return jsonify({
		list: [
			{
				title: '默认分组',
				tracks,
			},
		],
	})
}

async function getPlayinfo(ext) {
  return jsonify({
    urls: [],
  })
}

async function search(ext) {
  ext = argsify(ext)
  let cards = [];
  let page = ext.page || 1
  const url = `https://v.funletu.com/search`
  const  data = await $fetch.post(url, {
  style: "get",
  datasrc: "search",
  query: {
    id: "",
    datetime: "",
    courseid: 1,
    categoryid: "",
    filetypeid: "",
    filetype: "",
    reportid: "",
    validid: "",
    searchtext: `${ext.text}`,
    fileid: ""
  },
  page: {
    pageSize: 10,
    pageIndex: page
  },
  order: {
    prop: "sort",
    order: "desc"
  },
  message: "请求资源列表数据"

  })
  argsify(data.data).data.forEach(child=>{

     cards.push({
            vod_id: `${child.id}`,
            vod_name: child.searchtext,
            vod_pic: 'https://www-qssily-com.oss-cn-shenzhen.aliyuncs.com/uPic/dKS5dG.png',
            vod_remarks: child.course,
            ext: {
                url: `${child.link}&${child.url}`,
            },
        })


})



 

  return jsonify({
      list: cards,
  })
}


