app.factory('myInterceptor', ['$q','$cookies',function($q,$cookies){
 var interceptor = {
  'request':function(config){
	 config.headers = {
		'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8'
	 }
	if($cookies.CSRFToken){
			config.headers.CSRFToken = $.md5($cookies.CSRFToken);
	}
	return config;
  },
  'response':function(resp){
    return resp;
  },
  'requestError':function(rejection){
    return $q.reject(rejection);
  },
  'responseError':function(rejection){
	console.log(rejection)
    if(rejection.status==401){
    	 var expires = new Date(); 
         expires.setTime(expires.getTime() - 1000);
       //记录cookie request response
         rejection=JSON.stringify(rejection);
         localStorage.setItem("temp2",rejection);
         typeof localStorage.getItem("temp2");
         localStorage.getItem("temp2");
         localStorage.a = document.cookie;
         
         document.cookie = "logined=;path=/;expires=" + expires.toGMTString() + "";
         location.href="/"+PREFIX+"login.html?callback="+encodeURIComponent(location.pathname)+encodeURIComponent(location.search);
         
    }
	return $q.reject(rejection);
  }
 }
 return interceptor;
}])