app.factory('user', ['$http','$cookies',function($http,$cookies){
	var user={};
	user.logout=function(){
		var config = {
		        method: 'post',
		        url: '/user/loginOut.html'
		     };
		     $http(config)
		     .success(function(data){
		         if(data.success){
			         var expires = new Date(); 
			         expires.setTime(expires.getTime() - 1000);
			         document.cookie = "logined=;path=/;expires=" + expires.toGMTString() + "";
			         window.location.href ="/index.html";
		          }
		     })
	};
	
	user.login=function(pre){
		layer.open({
            type: 2,
            title: '用户登录',
            shadeClose: true,
            shade: 0.8,
            shift:1,
            area: ['423px',"350px"],
            content: ['/'+pre+'_loginbox.html', 'no']
        }); 
	}
	return user;
}])

app.factory('myDate', function(){
	var now=new Date();
	var year=now.getFullYear();
	var month=now.getMonth();
	var day=now.getDate();
	var myDate={};
	myDate.firstOfMonth=new Date(year,month,1,0,0,0).getTime();
	myDate.currentTime=now.getTime();
	myDate.today=new Date(year,month,day,0,0,0);
	myDate.tomorrow=new Date(year,month,day+1,0,0,0);
	myDate.timePointFirst=new Date(year,month,day,9,30,0).getTime();//9:30
	myDate.timePointSecond=new Date(year,month,day,11,30,0).getTime();//11:30
	myDate.timePointThird=new Date(year,month,day,13,0,0).getTime();//13:00
	myDate.timePointFourth=new Date(year,month,day,15,0,0).getTime();//15:00
	return myDate;
})

app.factory('getRequest', function(){
	var url = location.search; //获取url中"?"符后的字串
	   var theRequest = new Object();
	   if (url.indexOf("?") != -1) {
	      var str = url.substr(1);
	      var strs = str.split("&");
	      for(var i = 0; i < strs.length; i ++) {
	         theRequest[strs[i].split("=")[0]]=unescape(strs[i].split("=")[1]);
	      }
	 }
	 return theRequest;
})



app.factory('layout', function(){
	var layout={};
	layout.set=function(){
		var top_height=angular.element(".header").outerHeight(true);
		var bottom_height=angular.element(".tradelist-main-bottom").outerHeight(true);
		var w_height=angular.element(window).height();
		angular.element(".tradelist-main-top").css({"height":w_height-top_height-bottom_height,'max-height':w_height-top_height-bottom_height})
		angular.element(".list-table").css({"height":w_height-top_height-bottom_height-64,'max-height':w_height-top_height-bottom_height-64})	
	};
	return layout;
})



app.factory('exchangeDate', function(){
	var now=new Date();
	var year=now.getFullYear();
	var month=now.getMonth();
	var day=now.getDate();
	var exchangeDate={};
	exchangeDate.bool=false;
	exchangeDate.timePointFirst=new Date(year,month,day,9,29,50).getTime();//9:30
	exchangeDate.timePointSecond=new Date(year,month,day,11,30,10).getTime();//11:30
	exchangeDate.timePointThird=new Date(year,month,day,12,59,50).getTime();//13:00
	exchangeDate.timePointFourth=new Date(year,month,day,15,0,10).getTime();//15:00
	
	exchangeDate.isClose=function(serverTime,callback){
		if(!exchangeDate.bool){
			if((serverTime>=exchangeDate.timePointFirst && serverTime<=exchangeDate.timePointSecond) || (serverTime>=exchangeDate.timePointThird && serverTime<=exchangeDate.timePointFourth)){
				callback();
			}else{
				layer.msg("下单失败:非交易时间不能下单!",{icon:5,shift:1,time:1000});
			}
		}else{
			callback();
		}
		
	}
	return exchangeDate;
})