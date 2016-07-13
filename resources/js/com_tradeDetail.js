'use strict';

// Declare app level module
var app=angular.module('tradeApp',['pascalprecht.translate','ngMessages','ngCookies'])
.config(['$translateProvider','$httpProvider',function($translateProvider,$httpProvider){
    $translateProvider.translations("en",{
        "BUY": "买入",
        "SELL": "卖出",
        "CANCELED": "已撤销",
        "PARTIALLY_FILLED":"部分成交",
        "NEW":"未成交",
        "FILLED":"全部成交",
        "REJECTED":"已拒绝",
        "EXPIRED":"已过期"
    })
    $httpProvider.interceptors.push('myInterceptor');
    $translateProvider.preferredLanguage('en');
}])
.controller('tradeController',['$scope','$rootScope','$http','$interval','$cookies','$timeout','$document','$window','$q','streamer','user','$translate','userStreamer','exchangeDate','getRequest','myDate','klineStreamer',
    function($scope,$rootScope,$http,$interval,$cookies,$timeout,$document,$window,$q,streamer,user,$translate,userStreamer,exchangeDate,getRequest,myDate,klineStreamer){
	
    var theRequest =getRequest;

	var root_url = location.host.match('localhost') || location.host.match('192.168.0') ? '/exchange/public' : '/api/v1';
   
    $scope.product={};
    $scope.product.symbol=theRequest.symbol || localStorage.product;
    $scope.curIndex=localStorage.curIndex||0
    $scope.buy_order={};
    $scope.sell_order={};
    $scope.market_buy_order={};
    $scope.market_sell_order={};
    $scope.userMoney={};
    $scope.userAsset={};
    var starttime=myDate.today.getTime();
	var endtime=myDate.tomorrow.getTime();
    var periord=[60, 60, 300, 900, 1800, 3600, 86400, 604800]
    //收盘时间 停止 深度推送时间
    var closeTime=new Date(myDate.timePointFourth);
    //停止推送 标准
    $scope.stopDepthStream=false;

    //服务器时间
    var start=new Date().getTime();
    
    $http.get('/exchange/public/serverTime').success(function(data){
	   var end=new Date().getTime();
	   var diff=new Date().getTime()-data+(end-start)/2;
	   $scope.today = new Date(new Date().getTime()-diff);
	   $interval(function(){
		   $scope.today = new Date(new Date().getTime()-diff+1000);
	   },1000)
	   // 等到 收盘时间 深度 推送
	 
	   var leftTime=closeTime.getTime()-$scope.today.getTime()
	   if(leftTime>0){
		   $timeout(function(){
			   $scope.stopDepthStream=true
		   },leftTime)
	   }
	   //9:01刷新页面
	   var reTime=new Date();
	   reTime.setHours(9, 1, 0, 0)
	   var left=reTime.getTime()-$scope.today.getTime()
	   if(left>0){
		   $timeout(function(){
			   $scope.refresh()
		   },left)
	   }
   })
   //登出登入
   $scope.showLoginBox=user.login;
   $scope.logout=user.logout;
   //关于我们
   $scope.showInfo=function(){
	   angular.element(".wrap").addClass('blur');
	   angular.element(".overlayer,#guide-box").show();
   }
   $scope.hideInfo=function(){
	   angular.element(".wrap").removeClass('blur');
	   angular.element(".overlayer,#guide-box").hide();
   }
   
  //获取用户资金余额
    $scope.getUserMoney=function(){
        $http.post('private/userMoney').success(function(data){
            $scope.userMoney=data;
            $scope.freeze=Number(data.freeze)//后台人工冻结
            $scope.withdrawFreeze=Number(data.withdrawFreeze)//后台提现冻结
            $scope.withdrawing=Number(data.withdrawing)//提现中
            $scope.withdrawable=Math.min(data.withdrawable,data.free)//可提现
            $scope.locked=Number(data.locked)//
            $scope.free=Number(data.free)//可用余额
 
        })
    };
    
  //获取用户基本信息
    $scope.getUserBaseDetail=function(){
    	$http.post('/user/basedetail.html').success(function(data){
    		 $scope.userBaseInfo=data;
    	})
    };
    
  //获取用户持仓列表
    $scope.currentUserAsset=null;
    $scope.getUserAsset=function(symbol){
        $http.post('/exchange/private/userAsset').success(function(data){
            $scope.userAssets=data
            $scope.userAssetsNum=data.length;
            $scope.totalMarketValue=0;
            $scope.totalProfit=0
            $scope.cost=0
            $scope.totalAsset=0
            $scope.freezeAsset=0
            angular.forEach(data,function(value,index){
            	if(value.price){
            		 $scope.totalMarketValue+=Number(value.price)*(Number(value.free)+Number(value.freeze)+Number(value.locked)+Number(value.withdrawing));
    			}
            	$scope.cost+=Number(value.cost);
                $scope.totalAsset+=Number(value.free);
                $scope.freezeAsset+=Number(value.freeze);
                if(value.productSymbol==symbol){
                    $scope.currentUserAsset=value.free;
                    $scope.currentMarketValue=Number(value.price)*(Number(value.free)+Number(value.freeze)+Number(value.locked));
                }
            })
            $scope.totalProfit=$scope.totalMarketValue-$scope.cost
        });
    }
    $scope.refresh=function(){
    	window.location.href=window.location.href
    }
    //当前委托
    $scope.getOrders=function(){
        $http.post('private/openOrders').success(function(data){
        	depthcallback(data)
            $scope.openOrders=data;
            $scope.openOrdersLen=data.length;
            if($scope.openOrdersLen==0){
                $scope.IsopenOrdersNull=true;
            }else{
                $scope.IsopenOrdersNull=false;
            }
        })
    };
 
    //历史委托
    $scope.getAllOrders=function(pagenum,rows,starttime,endtime){
        var params=$.param({'page':pagenum,'start':starttime,'rows':rows,'end':endtime})
        $http.post('private/allOrders',params).success(function(data){
            if(data.data){
                $scope.allOrders=data.data;
             }else{
            	 $scope.allOrders=[];
             }
            if(data.total==0){
                $scope.IsallOrdersNull=true;
            }else{
                $scope.IsallOrdersNull=false;
            }
            
           
        })
    };  
    
    //根据时间段筛选记录
    $scope.setTimequantum=function(timeQuantum,fn){
    		var now=new Date();
    	    var y=now.getFullYear();
    	    var m=now.getMonth();
    	    var d=now.getDate();
    	    var nowDate=new Date(y,m,d,0,0,0)
    	    var starttime=nowDate.getTime();
    	    var endtime=new Date(y,m,d,0,0,0).setDate(new Date(y,m,d,0,0,0).getDate()+1);
    	switch(timeQuantum){
    		case 0:
    			starttime=nowDate.getTime();
    			break;
    		case 1:
    			starttime=Math.abs(nowDate.setDate(nowDate.getDate()-7));
    			break;
    		case 2:
    			starttime=Math.abs(nowDate.setMonth(nowDate.getMonth()-1));
    			break;
    		case 3:
    			starttime=Math.abs(nowDate.setMonth(nowDate.getMonth()-3));
    			break;
    	}
    	fn(1,1000,starttime,endtime);
    }
    
    //起止日期搜索记录
  
    $scope.search_submit=function(fn){
    	var starttime=new Date($("#start").val()).getTime();
    	var endtime=new Date($("#end").val());
    	endtime=endtime.setDate(endtime.getDate()+1);
    	if(starttime&&endtime){
    		fn(1,1000,starttime,endtime);
    	}
    }
    
    //历史成交
    $scope.dealOrders=[];
    $scope.getDealOrders=function(pagenum,rows,starttime,endtime){
        var params=$.param({'page':pagenum,'start':starttime,'rows':rows,'end':endtime})
        $http.post('/exchange/private/userTrades',params).success(function(data){
            if(data.data){
                $scope.dealOrders=data.data;
               }else{
            	   $scope.dealOrders=[]; 
               }
            $scope.dealBigTotalItems = data.total;
            
        })
    };

    //判断是否登录
    $scope.isLogin=function(){
        if($cookies.logined=='y'){
            $scope.Islogin=true;
            $scope.getUserMoney();
            $scope.getUserBaseDetail();
            $scope.getOrders();//获取当前委托
	   	 	$scope.getUserAsset($scope.product.symbol);
	   	 	$scope.getAllOrders(1,1000,starttime,endtime);
	   	 	$scope.getDealOrders(1,1000,starttime,endtime);

        }else{
            $scope.Islogin=false;
        }
    }
    $scope.isLogin();
    
    
    //获取当前产品
    $scope.getCurrentProduct=function(symbol){
        $http.get('public/product?symbol='+symbol).success(function(data){
            if(data.data.length > 0) {
                $scope.currentProduct=data.data[0];
                //设置chart 的总额
                chart.setData({circulation:$scope.currentProduct.circulation})
                
                $scope.newest=$scope.currentProduct.close;
                $rootScope.pageTitle=$scope.currentProduct.name;
                angular.element("#trade-desc-con").html($scope.currentProduct.desc);
                $scope.searchKeyword=$scope.currentProduct.name+" "+$scope.currentProduct.symbol;
                var time = myDate.currentTime;
                var fourtime=myDate.timePointFourth;
               
                if(time>=fourtime){
            		var sminutes=240;
            		var avgVolumeTMinus5 = $scope.currentProduct.avgQty / 240;
                	var avgVolumeT = $scope.currentProduct.volume / sminutes;
                	
                	if(avgVolumeTMinus5==0){
                		$scope.volumeRatio = "";
                	}else{
                		$scope.volumeRatio = avgVolumeT/avgVolumeTMinus5;
                	}
            	}

                
            }
         })
   };
   $scope.getCurrentProduct($scope.product.symbol);

     //获取交易产品列表
    $scope.products=[];
    $scope.getTradeLists=function(){
         $http.get('public/product').success(function(data){
        	var time=new Date();
		    	
	    	time.setHours(8, 0, 0, 0)
	    	if(time.getTime()<new Date().getTime()){
	    		time.setDate(time.getDate()+1)
	    	}
	    	localStorage.expireTime=time.getTime();
	    	localStorage.products=JSON.stringify(data.data)
        	productCallback(data.data)

          })
    };
    if(localStorage.products&&localStorage.expireTime&&Number(localStorage.expireTime)>new Date().getTime()){
    	$timeout(function(){
    		productCallback(JSON.parse(localStorage.products))
    	},0)
    	
    }else{
    	$scope.getTradeLists();
    }
    function productCallback(data){
    	if(data.length){
   		 $scope.products=data;
            localStorage.product=$scope.products[0].symbol;
            
            var ps=data;
            //切换产品
            for(var p=0;p<ps.length;p++){
	    		if(ps[p].symbol==$scope.product.symbol){
	                 var preProduct=ps[(p-1)<0?p-1+ps.length:p-1].symbol
		    		 var nextProduct=ps[(p+1)%ps.length].symbol
		    		 
		    		 $scope.pre=function(){
		    		    	
	                	 window.location.replace("/exchange/"+PREFIX+"tradeDetail.html?symbol="+preProduct);
		    		    	
		    		    }
		    		    $scope.next=function(){
		    		    	window.location.replace("/exchange/"+PREFIX+"tradeDetail.html?symbol="+nextProduct);
		    		    	
		    		    }
		    		 $(window).keyup(function(e){
		    			 //pre
		    			if(e.keyCode==33){
		    				window.location.replace("/exchange/"+PREFIX+"tradeDetail.html?symbol="+preProduct);
						}
		    			//next
						if(e.keyCode==34){
							window.location.replace("/exchange/"+PREFIX+"tradeDetail.html?symbol="+nextProduct);
						}
		    		 })	
	    		}
            }
            
	   	}else{
	   		$scope.products=[];
	   	}
	   	if($scope.Islogin){
	   		$scope.getUserInfo(data)
	   	}
    }
   
   
    
    //选择产品
    $scope.selectProduct=function(productName,symbol,newPrice,index){
    	window.location.replace("/exchange/"+PREFIX+"tradeDetail.html?symbol="+symbol);
    }; 
  //智能获取交易代码列表
    $scope.Ischange=false;
    var keyWordLen;
    $scope.keyWords=[];
    $scope.getSymbols=function(){
        $scope.Ischange=true;
        var partten=/[\u4e00-\u9fa5]/g;
        var str=$scope.searchKeyword;
        $scope.keyWords=[];
        $scope.index=0;
        if(str){
            if(partten.test(str)){
                keyWordLen=0;
                $scope.keyWords=[];
                angular.forEach($scope.products,function(value){
                    if(value.name.match(str)){
                        var obj={};
                        obj.name=value.name;
                        obj.symbol=value.symbol;
                        obj.price=value.close;
                        $scope.keyWords.push(obj); 
                        keyWordLen++;
                    }
                });
            }else{
                keyWordLen=0;
                $scope.keyWords=[];
                angular.forEach($scope.products,function(value){
                    if(value.symbol.substring(0,str.length).toLowerCase()==str.toLowerCase()){
                        var obj={};
                        obj.name=value.name;
                        obj.symbol=value.symbol;
                        obj.price=value.close;
                        $scope.keyWords.push(obj);
                        keyWordLen++;
                    }
                });
            }
             
        }    
    }
    
    //键盘操作
    $scope.index=0;
    $scope.selectList=function(event){
        var e = event || window.event || arguments.callee.caller.arguments[0];
        if(e && keyWordLen && e.keyCode=='38'){
            if($scope.index==0){
                $scope.index=keyWordLen-1;
            }else{
                $scope.index=$scope.index-1;
            }
        }
        if(e && keyWordLen && e.keyCode=='40'){
            if($scope.index==(keyWordLen-1)){
                $scope.index=0;
            }else{
                $scope.index=$scope.index+1;
            }
        }
        if(e && e.keyCode=='13'){
            if ( e && e.preventDefault ){
                e.preventDefault(); 
            }else{
                window.event.returnValue = false; 
            }
            var keyWord=$scope.keyWords[$scope.index];
            if($scope.Ischange){
                $scope.selectProduct(keyWord.name,keyWord.symbol,keyWord.price);
                $scope.Ischange=false;
            }
        }
    }
    
    //键盘监听
    $document.bind("keydown", function(event) {
        $scope.$apply(function (){
               if(event.keyCode == 90 && $scope.sign=='dqwt'){
                   $scope.deleteAllOrderAsk();
               }
               else if(event.keyCode == 114){
            	   event.preventDefault();
                   $scope.sign="dqwt";
               } 
               
               else if(event.keyCode == 121){ 
                   $scope.tabName="cpxx";
               } 
               else if(event.keyCode == 27){ 
                   window.location.href="/exchange/"+PREFIX+"index.html"
               }else if(event.ctrlKey && event.shiftKey && event.keyCode==75){
   	        	exchangeDate.bool=true;
   	           }  
              
        })
    })
    
    //监听tab变化
    $scope.tab=function(str){
   	 $scope.sign=str;
   	 if($scope.Islogin){
   		 switch(str){
	   	 	case 'lswt':
	   	 	$scope.timeQuantum=0
	   	 	$scope.getAllOrders(1,1000,starttime,endtime);
		   	break;
	   	 	case 'lscj':
	   	 	$scope.timeQuantum=0
	   	 	$scope.getDealOrders(1,1000,starttime,endtime);
			break;
	   	 }
   	 }
    }
   
    
    $scope.trade=function(price){
        $scope.buy_order.price=Number(price).toFixed(2);
        $scope.sell_order.sell_price=Number(price).toFixed(2);
    }
    
    
  
    //限价买入
    $scope.buy_submit=function(){
    	if(!chackRate()){
      		layer.msg("按钮点击频率太快",{icon:5,shift:1,time:700});
      		return
      	}
    	
        var curPrice=Number($scope.buy_order.price)
        var totalPrice=curPrice*$scope.buy_order.quantity;
        var patten=/^\+?[1-9][0-9]*$/;
        var pricepatten=/^\d+(\.\d{0,2})?$/;
        if(!$scope.Islogin){
            $scope.showLoginBox(EXCHANGE);
            return false;
        }else{
        	var maxNum=Math.floor($scope.free/($scope.buy_order.price*(1+1*$scope.userBaseInfo.buyerCommission)));//最大购买量
        	if(!$scope.currentProduct){
            	layer.msg("请选择交易产品",{icon:5,shift:1,time:500});
            	angular.element("#searchKeyword").focus();
            }else if($scope.buy_order.price=="" || $scope.buy_order.price==null ){
            	layer.msg("请输入买入价",{icon:5,shift:1,time:500});
            	return false;
            }else if(!pricepatten.test($scope.buy_order.price)){
            	layer.msg("请输入正确的买入价",{icon:5,shift:1,time:500});
            	return false;
            }
            else if($scope.buy_order.quantity=="" || $scope.buy_order.quantity==null ){
                layer.msg("请输入买入量",{icon:5,shift:1,time:500});
                angular.element('#buy_order').focus();
                return false;
            }else if(!patten.test($scope.buy_order.quantity)){
            	 layer.msg("买入量必须为整数",{icon:5,shift:1,time:500});
                 angular.element('#buy_order').val("").focus();
            }
            else if(Number($scope.buy_order.quantity)>maxNum){
            	angular.element('#buy_order').focus();
            	return false;
            }
            else if(curPrice<Number($scope.currentProduct.minPrice)){
                layer.msg("价格不能低于"+$scope.currentProduct.minPrice,{icon:5,shift:1,time:500})
                return false;
            }else if(curPrice>Number($scope.currentProduct.maxPrice)){
                layer.msg("价格不能高于"+$scope.currentProduct.maxPrice,{icon:5,shift:1,time:500})
                return false;
            }else{
                var params=$.param({price:$scope.buy_order.price,quantity:$scope.buy_order.quantity,symbol:$scope.currentProduct.symbol,side:'BUY',type:'LIMIT'})
                $scope.buy_order.quantity="";
                $http.post('private/order',params).then(
                        //success
                           function(response){
                            layer.msg("下单成功",{icon:1,shift:1,time:500})
                            
                        },
                        //error
                        function(response){
                            if(response.data.msg.toUpperCase().match("MARKET.*CLOSED")){
                                layer.msg("下单失败:非交易时间不能下单!",{icon:5,shift:1,time:1000})
                            } else if(response.data.msg.toUpperCase().match("INSUFFICIENT BALANCE")){
                                layer.msg("下单失败:余额不足",{icon:5,shift:1,time:1000})
                            }
                            else if(response.data.msg.toUpperCase().match("Too MANY NEW ORDERS")){
                                layer.msg("下单失败:下单过于频繁",{icon:5,shift:1,time:1000})
                            }
                            else{
                                layer.msg("下单失败: " + response.data.msg,{icon:5,shift:1,time:1000})
                            }
                           
                        }
                 )
            }
        }
        
    };
    
    $scope.limitBuyOrder=function(){
    	
    	exchangeDate.isClose($scope.today,$scope.buy_submit);
    }
    
  //限价卖出
    $scope.sell_submit=function(){
    	if(!chackRate()){
      		layer.msg("按钮点击频率太快",{icon:5,shift:1,time:700});
      		return
      	}
        var curPrice=Number($scope.sell_order.sell_price)
        var totalQuantity=Number($scope.sell_order.sell_quantity);
        var patten=/^\+?[1-9][0-9]*$/;
        var pricepatten=/^\d+(\.\d{0,2})?$/;
        if(!$scope.Islogin){
               $scope.showLoginBox(EXCHANGE);
               return false;
       }
        else if(!$scope.currentProduct){
        	layer.msg("请选择交易产品",{icon:5,shift:1,time:500});
        	angular.element("#searchKeyword").focus();
        }else if($scope.sell_order.sell_price=="" || $scope.sell_order.sell_price==null ){
        	layer.msg("请输入卖出价",{icon:5,shift:1,time:500});
        	return false;
        }else if(!pricepatten.test($scope.sell_order.sell_price)){
        	layer.msg("请输入正确的卖出价",{icon:5,shift:1,time:500});
        	return false;
        }
        
        else if($scope.sell_order.sell_quantity=="" || $scope.sell_order.sell_quantity==null ){
               layer.msg("请输入卖出量",{icon:5,shift:1,time:500});
               angular.element('#sell_order').focus();
               return false;
        }else if(!patten.test($scope.sell_order.sell_quantity)){
        	 layer.msg("卖出量必须为整数",{icon:5,shift:1,time:500});
             angular.element('#sell_order').val('').focus();
             return false;
        }
        else if(totalQuantity>Number($scope.currentUserAsset)){
        	angular.element('#sell_order').focus();
            return false;
        }
        
        else if(curPrice<Number($scope.currentProduct.minPrice)){
            layer.msg("价格不能低于"+$scope.currentProduct.minPrice,{icon:5,shift:1,time:500})
            return false;
        }else if(curPrice>Number($scope.currentProduct.maxPrice)){
            layer.msg("价格不能高于"+$scope.currentProduct.maxPrice,{icon:5,shift:1,time:500})
            return false;
        }else{
            var params=$.param({price:$scope.sell_order.sell_price,quantity:$scope.sell_order.sell_quantity,symbol:$scope.currentProduct.symbol,side:'SELL',type:'LIMIT'})
            $scope.sell_order.sell_quantity="";
            $http.post('private/order',params).then(
                    //success
                    function(response){
                        layer.msg("下单成功",{icon:1,shift:1,time:500})
                       
                    },
                    //error
                    function(response){
                        if(response.data.msg.toUpperCase().match("MARKET.*CLOSED")){
                            layer.msg("下单失败:非交易时间不能下单!",{icon:5,shift:1,time:500})
                        } else if(response.data.msg.toUpperCase().match("INSUFFICIENT BALANCE")){
                            layer.msg("下单失败:余额不足",{icon:5,shift:1,time:500})
                        } 
                        else if(response.data.msg.toUpperCase().match("Too MANY NEW ORDERS")){
                            layer.msg("下单失败:下单过于频繁",{icon:5,shift:1,time:1000})
                        }else {
                            layer.msg("下单失败: " + response.data.msg,{icon:5,shift:1,time:500})
                        }
                        
                    })
        }
    };
    
    $scope.limitSellOrder=function(){
    	exchangeDate.isClose($scope.today,$scope.sell_submit);
    }
    
  //市价买入
    $scope.market_buy_submit=function(){
    	if(!chackRate()){
      		layer.msg("按钮点击频率太快",{icon:5,shift:1,time:700});
      		return
      	} 
    	
    	var patten=/^\+?[1-9][0-9]*$/;
        if(!$scope.Islogin){
                $scope.showLoginBox(EXCHANGE);
                return false;
        }
        else if(!$scope.currentProduct){
        	layer.msg("请选择交易产品",{icon:5,shift:1,time:500});
        	angular.element("#searchKeyword").focus();
        }
        else if($scope.market_buy_order.market_buy_quantity=="" || $scope.market_buy_order.market_buy_quantity==null ){
            layer.msg("请输入买入量",{icon:5,shift:1,time:500});
            angular.element("#marketbuyqun").focus();
            return false;
        }else if(!patten.test($scope.market_buy_order.market_buy_quantity)){
        	 layer.msg("买入量必须为整数",{icon:5,shift:1,time:500});
        	 angular.element("#marketbuyqun").val('').focus();
             return false;
        }
       else{
            var params=$.param({quantity:$scope.market_buy_order.market_buy_quantity,symbol:$scope.currentProduct.symbol,side:'BUY',type:'MARKET'})
            $scope.market_buy_order.market_buy_quantity="";
            $http.post('private/order',params).then(
                //success
                function(response){
                    layer.msg("下单成功",{icon:1,shift:1,time:500})
                   
                },
                //error
                function(response){
                    if(response.data.msg.toUpperCase().match("MARKET.*CLOSED")){
                        layer.msg("下单失败:非交易时间不能下单!",{icon:5,shift:1,time:1000})
                    } else if(response.data.msg.toUpperCase().match("INSUFFICIENT BALANCE")){
                        layer.msg("下单失败:余额不足",{icon:5,shift:1,time:1000})
                    }
                    else if(response.data.msg.toUpperCase().match("Too MANY NEW ORDERS")){
                        layer.msg("下单失败:下单过于频繁",{icon:5,shift:1,time:1000})
                    }
                    else{
                        layer.msg("下单失败: " + response.data.msg,{icon:5,shift:1,time:1000})
                    }
                   
                })
        }
         
     };
     
     $scope.marketBuyOrder=function(){
    	
       	exchangeDate.isClose($scope.today,$scope.market_buy_submit);
     }
     
     //市价卖出
     $scope.market_sell_submit=function(){
    	 if(!chackRate()){
       		layer.msg("按钮点击频率太快",{icon:5,shift:1,time:700});
       		return
       	}
    	 var patten=/^\+?[1-9][0-9]*$/;
         if(!$scope.Islogin){
                $scope.showLoginBox(EXCHANGE);
                return false;
        }
         
         else if(!$scope.currentProduct){
         	layer.msg("请选择交易产品",{icon:5,shift:1,time:500});
         	angular.element("#searchKeyword").focus();
         }
         
          else if($scope.market_sell_order.market_sell_quantity=="" || $scope.market_sell_order.market_sell_quantity==null ){
                 layer.msg("请输入卖出量",{icon:5,shift:1,time:500});
                 angular.element('#market_sell').focus();
                 return false;
           }else if(!patten.test($scope.market_sell_order.market_sell_quantity)){
        	   layer.msg("卖出量必须为整数",{icon:5,shift:1,time:500});
               angular.element('#market_sell').val('').focus();
               return false;
           }
         
          else if(Number($scope.market_sell_order.market_sell_quantity)>Number($scope.currentUserAsset)){
        	  angular.element('#market_sell').focus();
              return false;
          }
         
         else{
            var params=$.param({quantity:$scope.market_sell_order.market_sell_quantity,symbol:$scope.currentProduct.symbol,side:'SELL',type:'MARKET'})
            $scope.market_sell_order.market_sell_quantity="";
            $http.post('private/order',params).then(
                    //success
                    function(response){
                        layer.msg("下单成功",{icon:1,shift:1,time:500})
                       
                    },
                    //error
                    function(response){
                        if(response.data.code==-2010){
                            layer.msg("持仓不足",{icon:5,shift:1,time:1000})
                            return false;
                        }
                        layer.msg("下单失败: " + response.data.msg,{icon:5,shift:1,time:1000})
                    }) 
        }
         
     };
     
     $scope.marketSellOrder=function(){
	    	
        	exchangeDate.isClose($scope.today,$scope.market_sell_submit);
      }


    $scope.getNewest=function(){
        $http.get(root_url + '/trades?limit=1&symbol='+$scope.product.symbol).success(function(data){
        	if(data.length!=0){
                $scope.newest=Number(data[0].price);
                $scope.buy_order.price=Number(data[0].price);
                $scope.buy_order.price=Number(data[0].price).toFixed(2);
                $scope.sell_order.sell_price=Number(data[0].price).toFixed(2)
            }
        })
    };
    
    $scope.getNewest();

  

     
    //撤销委托
    $scope.deleteOrder=function(id,symbol){
        var params=$.param({'orderId':id,'symbol':symbol})
        $http.post('private/deleteOrder',params).then(
                //success
                function(response){
                    layer.msg("撤销成功！",{icon:1,shift:1,time:500})   
                },
                //error
                function(response){
                    layer.msg("撤单失败: " + response.data.msg,{icon:5,shift:1,time:500})
                })
    };
    
    //全撤
    $scope.deleteAllOrder=function(){
        if($scope.sign=='dqwt'){
            angular.forEach($scope.openOrders,function(value){
                $scope.deleteOrder(value.orderId,value.symbol);
            })
        } 
    }
    $scope.deleteAllOrderAsk=function(){
    	if($scope.openOrders.length!=0){
    	var index=layer.confirm('<p style="font-size:16px;color:#c3c3c3;font-family:NSimSun;text-align: center;margin-top: 18px;height:60px">您确定要撤销全部委托吗？</p>',
    			{shade:0.8,skin: 'confirm-class',closeBtn:false,area:['325px' , '170px'],title:false,btn:['确定','取消']},
    			function(){$scope.deleteAllOrder($scope.openOrders)},
    			function(){
    				layer.close(index);
    	 })
   
    	 }
    	
    }
    
    /*k线图*/
    var translateResolution = function(res) {
        switch (res+"") {
            case "0":
                return "1m";
            case "60":
                return "1m";
            case "180":
                return "3m";
            case "300":
                return "5m";
            case "900":
                return "15m";
            case "1800":
                return "30m";
            case "3600":
                return "1h";
            case "7200":
                return "2h";
            case "14400":
                return "4h";
            case "21600":
                return "6h";
            case "43200":
                return "12h";
            case "86400":
                return "1d";
            case "259200":
                return "3d";
            case "604800":
                return "1w";
        };

        console.log("Error parsing resolution: " + res);
    };
    //default interval
    var interval = "60";
    var exchangeInterval = translateResolution(interval);
    RTBTC.instrument('BIJIE', $scope.product.symbol, 'CNY');
    var settings = {
            t: Number(interval),
            icontrols: true,
            i: [
                {
                    // This is where the price is drawn. Only one slot with 'main'
                    'm': true,
                    // The pixel y-value of the top of the slot, inside the border
                    'p': 0,
                    // The height of the slot
                    'h': 50,
                    // These are the indicators drawn under the price
                    'u': [
                      /* {
                            // Indicator type
                            't': 'ema',
                            // Indicator object
                            'i': null,
                            // Settings vector
                            's': [5]
                        },
                        {
                            // Indicator type
                            't': 'ema',
                            // Indicator object
                            'i': null,
                            // Settings vector
                            's': [10]
                        },
                        {
                            // Indicator type
                            't': 'avl',
                            // Indicator object
                            'i': null,
                            // Settings vector
                            's': [10]
                        }*/
                    ],
                    // These are the indicators on top of price
                    'o': [ ]
                },
                // Our first lower indicator is the volume bars
                {
                    'm': false,
                    't': 'vol',
                    // The indicator object
                    'i': null,
                    // The pixel y-value of the top of the slot, inside the border
                    'p': 5,
                    // The height of the slot
                    'h': 10,
                    // Input settings for the indicator
                    'r': []
                },
                // Our first lower indicator is the volume bars
                {
                    'm': false,
                    't': 'macd',
                    // The indicator object
                    'i': null,
                    // The pixel y-value of the top of the slot, inside the border
                    'p': 5,
                    // The height of the slot
                    'h': 10,
                    // Input settings for the indicator
                    'r': []
                }
            ]
    };

    window.chart = (new Chart).build('#chart', null, settings);
    chart.showDetail();
    //深度图
    var w_height1=angular.element(window).height();
	var top_height1=angular.element(".header").outerHeight(true);
	var lb_height1=angular.element(".detail-lb").outerHeight(true);
    angular.element(".box-inner").css({'height':w_height1-top_height1-lb_height1,'max-height':w_height1-top_height1-75});
    
    window.UserAccount = UserAccount_Class.Build();
    //RTBTC.instrument("BIJIE", $scope.product.symbol, "CNY");
    var c=(new VisualDepth).build('#depth',$("#p"));
    //c.resizeStop()
    function depthcallback(data){
    	if(data&&data instanceof Array){
    		var obj={}
    		obj.exch='BIJIE';
    		obj.orders=[];
    		data.forEach(function(d){
    			if(d.symbol==$scope.product.symbol){
    				obj.orders.push({
        				id:d.id,
        				action:d.side.toLowerCase(),
        				amount:d.origQty,
        				price:d.price,
        				'base':d.symbol ,
        	              'quote':"CNY",
        	              'status':"Open"
        			})
    			}
    			
    		})
    		UserAccount.ordersAdd(obj);
    	}
    	
    	/* UserAccount.ordersAdd({
             exch:'BIJIE',
             orders:[{
              'id': "18911",
              'action':'sell',
              'amount':10,
              'price':8.16,
              'base':"CNY" ,
              'quote':"CNY",
              'status':"Open"
          }]})*/
    }
   
        
        
    $scope.trades = [];
    $scope.todayTrades=[]
    $scope.streamBids = {};
    $scope.streamBidsKeys = [];
    $scope.streamAsks = {};
    $scope.streamAsksKeys = [];
    var callback = function(data) {

        if (data.eventType == "depthUpdate") {
        	
        	console.log(data.bids)
             data.bids.forEach(function(bid) {
            	var price = Number(bid[0]);
            	var qty = Number(bid[1]);
                if (qty != 0) {
                    $scope.streamBids[price] = qty;
                } else {
                    delete $scope.streamBids[price];
                }
            });

            data.asks.forEach(function(ask) {
            	var price = Number(ask[0]);
            	var qty = Number(ask[1]);
                if (qty != 0) {
                    $scope.streamAsks[price] = qty;
                } else {
                    delete $scope.streamAsks[price];
                }
            });
            //深度图数据
        	
            OBD.loadBook($scope.streamAsks,$scope.streamBids)
            //c.resize()
            $scope.streamBidsKeys = Object.keys($scope.streamBids).sort(function(a, b) {
                return a - b;
            }).reverse();
            $scope.streamAsksKeys = Object.keys($scope.streamAsks).sort(function(a, b) {
                return a - b;
            });
           
            //委比委差计算
            var tmpBidsVolume=0;//委买手数
            var tmpAsksVolume=0;//委卖手数
            angular.forEach($scope.streamBidsKeys,function(key){
            	tmpBidsVolume+=Number($scope.streamBids[key])
            })
            angular.forEach($scope.streamAsksKeys,function(key){
            	tmpAsksVolume+=Number($scope.streamAsks[key])
            })
            $scope.committeeDifference=tmpBidsVolume-tmpAsksVolume//委差
            $scope.commissionRatio=(tmpBidsVolume-tmpAsksVolume)*100/(tmpBidsVolume+tmpAsksVolume)
            
            var tmpBidsTwenty=[];
            var tmpAsksTwenty=[];
            angular.forEach($scope.streamBidsKeys.slice(0,20),function(key){
            	tmpBidsTwenty.push([Number(key).toFixed(2),Number($scope.streamBids[key]).toFixed(0)]);
            })
            //不足五档，补齐五档，否则位置会跳动
            if(tmpBidsTwenty.length < 20) {
                var i = tmpBidsTwenty.length;
                while(i < 20) {
                	tmpBidsTwenty.push(["--", "--"]);
                    ++i;
                }
            }
            angular.forEach($scope.streamAsksKeys.slice(0,20),function(key){
            	tmpAsksTwenty.push([Number(key).toFixed(2),Number($scope.streamAsks[key]).toFixed(0)]);
            })
            //不足五档，补齐五档，否则位置会跳动
            if(tmpAsksTwenty.length < 20) {
                var i = tmpAsksTwenty.length;
                while(i < 20) {
                	tmpAsksTwenty.push(["--", "--"]);
                    ++i;
                }
            }
          //如果委买委买交叉 提示网络不稳定
            if(!isNaN(Number(tmpBidsTwenty[0][0]))&&!isNaN(Number(tmpAsksTwenty[0][0]))&&Number(tmpBidsTwenty[0][0])>=Number(tmpAsksTwenty[0][0])){
            	$("#netbad1").show();
            }
            $scope.bidsTwenty=tmpBidsTwenty;
            $scope.asksTwenty=tmpAsksTwenty.reverse();
        } else if (data.eventType == "trade") {
            data.price = Number(data.price).toFixed(2);
            data.qty = Number(data.qty).toFixed(0);

            if($scope.trades.length == 0 || $scope.trades[0].tradeId < data.tradeId) {
            	$scope.trades.unshift(data);
            	var rows=Math.ceil($scope.trades.length/3);
            	$scope.todayTrades=[$scope.trades.slice(0,rows),$scope.trades.slice(rows,2*rows),$scope.trades.slice(2*rows)];
            }
            $scope.newestQty=data.qty;
			if($scope.currentProduct.lastTradeId >= data.tradeId) return;
			if(data.isBuyerMaker) {
				$scope.currentProduct.activeSell +=Number(data.qty);
			} else {
				$scope.currentProduct.activeBuy +=Number(data.qty);
			}
			$scope.currentProduct.tradedMoney += data.price * data.qty;
			$scope.currentProduct.lastTradeId = data.tradeId; 

            $scope.newest=data.price;
            if($scope.currentProduct != undefined) {
                if($scope.newest>=$scope.currentProduct.prevClose){
                    $scope.isIncrease=true;
                    $scope.Dvalue="+"+($scope.newest-$scope.currentProduct.prevClose)
                    $scope.Dpercent="+"+($scope.Dvalue/$scope.currentProduct.prevClose*100).toFixed(2)
                }else{
                    $scope.isIncrease=false;
                    $scope.Dvalue=($scope.newest-$scope.prevClose)
                    $scope.Dpercent=($scope.Dvalue/$scope.prevClose*100).toFixed(2)
                }
                
            }
        } else if (data.eventType == "kline") {
            if(data.kline.interval == "1d") {
                $scope.streamKline = data.kline;
                if($scope.currentProduct != undefined) {
                    $scope.currentProduct.open=data.kline.open;
                    $scope.currentProduct.high=data.kline.high;
                    $scope.currentProduct.low=data.kline.low;
                    $scope.currentProduct.volume=data.kline.volume;
                }
                console.log($scope.streamKline);
            }
           else if(data.kline.interval == "1m") {
            	var time =data.kline.time;
            	var newTime = new Date(time); //得到普通的时间了
                var ty=newTime.getFullYear();
                var tm=newTime.getMonth();
                var td=newTime.getDate();
            	var hourxs=newTime.getHours();//得到当前时间小时数
            	var mfz=newTime.getMinutes();//得到当前时间分钟数
            	
            	var firstDate=new Date(ty,tm,td,9,30,0)
                var firsttime=firstDate.getTime();
            	
            	var secDate=new Date(ty,tm,td,11,30,0)
                var sectime=secDate.getTime();
            	
            	var thrDate=new Date(ty,tm,td,13,0,0)
                var thrtime=thrDate.getTime();
            	
            	var fourDate=new Date(ty,tm,td,15,0,0)
                var fourtime=fourDate.getTime();
            	//根据时间判断
            	if(time<firsttime){
            		var sminutes=0;
            		$scope.volumeRatio = "";
            	}
            	
            	else if(time>=firsttime&&time<=sectime)
            	{
            		var sminutes=(hourxs-9)*60+mfz-30;
            		var avgVolumeTMinus5 = $scope.currentProduct.avgQty / 240;
                	var avgVolumeT = $scope.currentProduct.volume / sminutes;
                	
                	if(avgVolumeTMinus5==0){
                		$scope.volumeRatio = "";
                	}else{
                		$scope.volumeRatio = avgVolumeT/avgVolumeTMinus5;
                	}
            		
            	}else if(time>sectime&&time<=thrtime){
            		var sminutes=120;
            		var avgVolumeTMinus5 = $scope.currentProduct.avgQty / 240;
                	var avgVolumeT = $scope.currentProduct.volume / sminutes;
                	
                	if(avgVolumeTMinus5==0){
                		$scope.volumeRatio = "";
                	}else{
                		$scope.volumeRatio = avgVolumeT/avgVolumeTMinus5;
                	}
            		
            	}
            	else if(time>=thrtime&&time<=fourtime){
            		var sminutes=(hourxs-13+2)*60+mfz;
            		var avgVolumeTMinus5 = $scope.currentProduct.avgQty / 240;
                	var avgVolumeT = $scope.currentProduct.volume / sminutes;
                	
                	if(avgVolumeTMinus5==0){
                		$scope.volumeRatio = "";
                	}else{
                		$scope.volumeRatio = avgVolumeT/avgVolumeTMinus5;
                	}
            	}
            	else if(time>=fourtime){
            		var sminutes=240;
            		var avgVolumeTMinus5 = $scope.currentProduct.avgQty / 240;
                	var avgVolumeT = $scope.currentProduct.volume / sminutes;
                	
                	if(avgVolumeTMinus5==0){
                		$scope.volumeRatio = "";
                	}else{
                		$scope.volumeRatio = avgVolumeT/avgVolumeTMinus5;
                	}
            	}

            
            }
            if(data.kline.interval == exchangeInterval) {
                Data.onBar([data.kline.time,Number(data.kline.open),Number(data.kline.high),Number(data.kline.low),Number(data.kline.close),Number(data.kline.volume)],Number(interval))
            }
        } else {
            console.log("Error! Bad data received:");
            console.log(data);
        }
        var phase = $scope.$root.$$phase;
        if (phase != '$apply' && phase != '$digest') {
            $scope.$apply();
        }
    };
    var isPreKLine=true;
    //根据时间间隔展示k线图
    var setResolution = function(setinterval,isKLine) {
        if(!isKLine) {
        	if(isPreKLine){
	        	chart.fixTime(true)
	        	chart.clearData()
	        	chart.setLastColorIndex(0)
	        	chart.removeIndicatorByname(['ema','ema'])
	        	
	        	chart.addOverlay("avl")
	            chart.setMode("Line");
	        	isPreKLine=false;
        	}
        	interval = "60";
            exchangeInterval = translateResolution(interval);
        	chart.setResolution(60);
        } else{
        	if(!isPreKLine){
        		chart.fixTime(false)
        		chart.setBarwidth(9)
        		chart.clearData()
	        	chart.removeIndicatorByname(["avl"])
	        	chart.addOverlay('ema',5)
	        	chart.addOverlay('ema',10)
	       	    chart.setMode("Candle");
	       	    
	       	    
	            isPreKLine=true
        	}
        	interval = setinterval;
            exchangeInterval = translateResolution(interval);
        	chart.setResolution(Number(setinterval));
        }
        
        
    }
    $scope.chartLoaded=function() {
    	if(!$scope.wssUrl){
    		$timeout(function(){
    			$scope.chartLoaded()
    		},0)
    		return
    	}
    	$scope.loaded=true;
    	$scope.connectToKlineStreamer($scope.wssUrl);
	}
    var firstLoad="-1"
    var lastLoad
   
    Data.onLoaded(function(){
    	if(firstLoad!=lastLoad){
    		$scope.chartLoaded();
    		lastLoad=firstLoad;
    	}
    	
    })
    
    $scope.getByInterval=function(interval,num){
    	if(firstLoad==num)return
        setResolution(interval,true);
        $scope.curIndex=num;
        firstLoad=num
        localStorage.curIndex=num
    }
    //点击涨停涨跌 价格带入 
    $scope.clickmax=function(){
    	$scope.buy_order.price=$scope.currentProduct.maxPrice;
    	$scope.sell_order.sell_price=$scope.currentProduct.maxPrice;
    	
    }
    
    $scope.clickmin=function(){
    	$scope.buy_order.price=$scope.currentProduct.minPrice;
    	$scope.sell_order.sell_price=$scope.currentProduct.minPrice;
    	
    }
    
    
    //设置分时
    $scope.setTimeLine=function(num){
    	if(firstLoad==num)return
        setResolution('0',false)
        $scope.curIndex=num;
    	localStorage.curIndex=num
        firstLoad=num
    }
   
    if(parseInt($scope.curIndex)){
    	isPreKLine=false;
    	$scope.getByInterval(periord[parseInt($scope.curIndex)],parseInt($scope.curIndex))
    		
    }else{
    	isPreKLine=true
    	$scope.curIndex=0
    	$scope.setTimeLine($scope.curIndex);
    }
    

    //技术指标
    $scope.curzb='MACD'
    $scope.jszbLists=false;
    $scope.toggleJszbLists=function(){
         $scope.jszbLists=!$scope.jszbLists;
    }
    $scope.setIndicator=function(indicatorName){
    	$scope.removeIndicator()
        $scope.curzb=indicatorName;
        if('MACD' == indicatorName) {
            chart.addOrUpdateIndicator('macd');
        } else if('TRIX' == indicatorName) {
            chart.addOrUpdateIndicator('trix');
        } else if('KDJ' == indicatorName) {
            chart.addOrUpdateIndicator('kdj');
        } else if('BRAR' == indicatorName) {
            //BRAR
        } else if('StochRSI' == indicatorName) {
            chart.addOrUpdateIndicator('storsi');
        } else if('VR' == indicatorName) {
            //VR
        } else if('RSI' == indicatorName) {
            chart.addOrUpdateIndicator('rsi');
        } else if('EMV' == indicatorName) {
            chart.addOrUpdateIndicator('emv');
        } else if('DMI' == indicatorName) {
            chart.addOrUpdateIndicator('dmi');
        } else if('WR' == indicatorName) {
            chart.addOrUpdateIndicator('wpr');
        } else if('OBV' == indicatorName) {
            chart.addOrUpdateIndicator('obv');
        } else if('ROC' == indicatorName) {
            //ROC
        } else if('BOLL' == indicatorName) {
            chart.addOrUpdateIndicator('bnd');
        } else if('MTM' == indicatorName) {
            chart.addOrUpdateIndicator('mtm');
        } else if('SAR' == indicatorName) {
            chart.addOrUpdateIndicator('psar');
        } else if('EMA' == indicatorName) {
            chart.addOrUpdateIndicator('ema');
        } else if('PSY' == indicatorName) {
            //PSY
        } else if('CCI' == indicatorName) {
            chart.addOrUpdateIndicator('cci');
        } else if('VWAP' == indicatorName) {
            chart.addOrUpdateIndicator('vwap');
        }
        $scope.jszbLists=false;
    }
    //删除指标
    $scope.removeIndicator=function(){
    	var indicatorName= $scope.curzb;
    	if('MACD' == indicatorName) {
            chart.removeIndicatorByname(['macd']);
        } else if('TRIX' == indicatorName) {
            chart.removeIndicatorByname(['trix']);
        } else if('KDJ' == indicatorName) {
            chart.removeIndicatorByname(['kdj']);
        } else if('BRAR' == indicatorName) {
            //BRAR
        } else if('StochRSI' == indicatorName) {
            chart.removeIndicatorByname(['storsi']);
        } else if('VR' == indicatorName) {
            //VR
        } else if('RSI' == indicatorName) {
            chart.removeIndicatorByname(['rsi']);
        } else if('EMV' == indicatorName) {
            chart.removeIndicatorByname(['emv']);
        } else if('DMI' == indicatorName) {
            chart.removeIndicatorByname(['dmi']);
        } else if('WR' == indicatorName) {
            chart.removeIndicatorByname(['wpr']);
        } else if('OBV' == indicatorName) {
            chart.removeIndicatorByname(['obv']);
        } else if('ROC' == indicatorName) {
            //ROC
        } else if('BOLL' == indicatorName) {
            chart.removeIndicatorByname(['bnd']);
        } else if('MTM' == indicatorName) {
            chart.removeIndicatorByname(['mtm']);
        } else if('SAR' == indicatorName) {
            chart.removeIndicatorByname(['psar']);
        } else if('EMA' == indicatorName) {
            chart.removeIndicatorByname(['ema']);
        } else if('PSY' == indicatorName) {
            //PSY
        } else if('CCI' == indicatorName) {
            chart.removeIndicatorByname(['cci']);
        } else if('VWAP' == indicatorName) {
            chart.removeIndicatorByname(['vwap']);
        }
        //chart.removeIndicatorByname([$scope.curzb]);
        $scope.curzb='';
    }

    /*深度行情*/
    $scope.getBestTwenty=function(){
        $http.get('public/bestN?limit=20&symbol='+$scope.product.symbol).success(function(data){
            var tmpBids=[];
            var tmpAsks=[];
            var bidSum=0;
            angular.forEach(data.bids,function(bid){
                bidSum+=parseFloat(bid[1]);
                tmpBids.push([Number(bid[0]).toFixed(2),Number(bid[1]).toFixed(0),Number(bidSum).toFixed(0)]);
            });
            var askSum=0;
            angular.forEach(data.asks,function(ask){
                askSum+=parseFloat(ask[1]);
                tmpAsks.push([Number(ask[0]).toFixed(2),Number(ask[1]).toFixed(0),Number(askSum).toFixed(0)]);
            });
            $scope.bids=tmpBids;
            $scope.asks=tmpAsks;
        })
    };
    $scope.getTodayTrades=function(){
        $http.get('public/todayTrades?symbol='+$scope.product.symbol).success(function(data){
        	$scope.trades=[];
        	angular.forEach(data,(function(trade) {
                trade.price = Number(trade.price).toFixed(2);
                trade.qty = Number(trade.qty).toFixed(0);
                $scope.trades.unshift(trade);
            }));
            if(data.length > 0) $scope.newest=data[0].price;
            var rows=Math.ceil(data.length/3);
        })
    };
   /* $scope.getTwentyTrades();*/

    $scope.disconnect = function() {
        $scope.streamerInstance.stopStream();
        $scope.streamerInstance = null;
    };
    
    $scope.connectToSymbol = function(url) {
        if ($scope.streamerInstance == null) {
            $scope.streamerInstance = new streamer();
            $scope.streamerInstance.startStream($scope.product.symbol, url, function(data) {
            	if(data.eventType == "depthUpdate"){
            		if($scope.stopDepthStream==true)return;
            	}
                callback(data);
            });
        }
    };
    $scope.connectToKlineStreamer = function(url) {
    	
        $scope.klineStreamer = null
        $scope.klineStreamer = new klineStreamer();
        $scope.klineStreamer.startStream($scope.product.symbol, url,translateResolution(interval), function(data) {
        	
            callback(data);
        });
   
    };
    $scope.userCallback=function(data,products){
    	if (data.eventType == "outboundAccountInfo"){
    		var balances=data.balances;
    		
    		balances.forEach(function(b){
    			if(b.asset=="CNY"){
    				//更新用户 余额
					$scope.locked=b.locked;
	    			$scope.free=b.free;	
    			}
    			
    		})
    		
    	}
    	if (data.eventType == "executionReport"){
    		 var order={};
        	 order.time = data.time;
             // order.dTime = TimeHelper.Long2DateTime(order.time);
        	 order.symbol = data.symbol;
        	 order.side = data.side;
        	 order.type = data.orderType;
        	 order.status = data.orderStatus;
        	 order.origQty = parseInt(data.qty);
        	 order.price = parseFloat(data.price);
        	 order.stopPrice = parseFloat(data.stopPrice);
        	 order.executedQty = parseInt(data.cummulativeQty);
        	 order.orderId = data.orderId;
        	 //order.avgPrice=data.avgPrice;
        	 products.forEach(function(p) {
				if(p.symbol==data.symbol){
					order.productName=p.name
				}
			})
    		 switch (data.orderStatus)
             {
                 case "NEW":
                	 order.executedQty = 0;
                	 order.avgPrice = 0;
                	console.log(order.symbol+' 委托'+order.origQty)
                	//openOrders 增加  委托
                	 $scope.openOrders.splice(0,0,order)
                	 $scope.IsopenOrdersNull=false;
                	 
                	 $scope.IsopenOrdersNull=false;
                	
                	  if (order.side == "SELL"){
                		  // userAssets 持仓
	                	 if($scope.userAssets  instanceof Array){
	                		 $scope.userAssets.forEach(function (a) {
								if(a.productSymbol==order.symbol){
									a.locked =parseFloat(a.locked)+ order.origQty;
	                                a.free = parseFloat(a.free)- order.origQty;
	                                $scope.currentUserAsset=a.free;
								}
							})
	                	 }
                	  }
                	$scope.IsopenOrdersNull=false;
                	 break;
                 case "PARTIALLY_FILLED":
                	 var lastQty = parseInt(data.lastQty);
                     var lastPrice = parseFloat(data.lastPrice);
                     var executeQty = parseFloat(data.cummulativeQty);
                	 if($scope.openOrders  instanceof Array){
                		 $scope.openOrders.forEach(function(o){
                			 if(o.symbol==order.symbol&&o.orderId==order.orderId){
                				 //更新 委托
                				 o.avgPrice = ((o.executedQty * o.avgPrice) + (lastPrice * lastQty)) / executeQty;
                                 o.executedQty = executeQty;
                                 o.status = "PARTIALLY_FILLED";
                			 }
                			
                		 })
                	 }
                	 var dd={};
                	 dd.symbol = data.symbol;
                     dd.time = data.time;
                     
                     dd.side = data.side;
                    
                     dd.qty = data.lastQty;
                     dd.price = data.lastPrice;
                     dd.productName = order.productName;
                     
                     dd.fee = data.commission;
                     // 增加成交历史
                     $scope.dealOrders.splice(0, 0, dd)
                     $scope.dealBigTotalItems=$scope.dealOrders.length
                     // 更新 持仓 内容
                     $scope.updatePosition(order, lastQty, lastPrice, parseFloat(dd.fee));
                	 break;
				 case "FILLED":
					 var lastQty1 = parseInt(data.lastQty);
	                 var lastPrice1 = parseFloat(data.lastPrice);
                     var executeQty1 = parseFloat(data.cummulativeQty);
                     var historyOrder
                     console.log(data);
                    
					 if($scope.openOrders  instanceof Array){
                		 $scope.openOrders.forEach(function(o){
                			 if(o.symbol==order.symbol&&o.orderId==order.orderId){
                				 //更新 委托
	                			 o.avgPrice = ((o.executedQty * o.avgPrice) + (lastPrice1 * lastQty1)) / executeQty1;
	                             o.executedQty = executeQty1;
	                             o.status = "FILLED";
	                             historyOrder=o
                			 }
                		 })
                	 }  
					 
					 //添加当天成交
                     var dd1 = {};
                     dd1.symbol = order.symbol;
                     dd1.time = order.time;
                     //dd1.dTime = ed.dTime;
                     dd1.side = order.side;
                     //dd1.sideName = ed.sideName;
                     dd1.qty = lastQty1;
                     dd1.price = lastPrice1;
                     var fee1 = parseFloat(data.commission);
                     dd1.fee = fee1;
                     dd1.productName = order.productName;
                     
                     // 增加成交历史
                     $scope.dealOrders.splice(0, 0, dd1);
                     $scope.dealBigTotalItems=$scope.dealOrders.length
                     
                     var orderIndex
                     $scope.openOrders.forEach(function(o,index){
            			if(o.symbol==order.symbol&&o.orderId==order.orderId){
            				orderIndex=index
            			}
            		 })
            		 
            		 
            		 // 历史委托
            		 $scope.allOrders.splice(0, 0, historyOrder)
            		 if($scope.allOrders.length==0){
            			 $scope.IsallOrdersNull=true
            		 }else{
            			 $scope.IsallOrdersNull=false
            		 }
            		
            		 // 删除 委托
            		 $scope.openOrders.splice(orderIndex,1)
            		 if($scope.openOrders.length==0){
            			 $scope.IsopenOrdersNull=true;
            		 }else{
            			 $scope.IsopenOrdersNull=false;
            		 }
            		 // 更新持仓
                     $scope.updatePosition(order, lastQty1, lastPrice1, parseFloat(fee1));
				     break;
				 case "CANCELED":
                 case "EXPIRED":
                	 if (order.side == "SELL")
                     {
                        //撤单
                		 if($scope.userAssets  instanceof Array){
	                		 $scope.userAssets.forEach(function (a) {
								if(a.productSymbol==order.symbol){
									a.locked =parseFloat(a.locked)- order.origQty+order.executedQty;
	                                a.free = parseFloat(a.free)+ order.origQty-order.executedQty;
	                                $scope.currentUserAsset=a.free;
								}
							})
	                	 }
                         
                     }
                	 var orderIndex1
                     $scope.openOrders.forEach(function(o,index){
            			if(o.symbol==order.symbol&&o.orderId==order.orderId){
            				orderIndex1=index
            			}
            		 })
            		 // 删除 委托
            		 $scope.openOrders.splice(orderIndex1,1)
            		 if($scope.openOrders.lenght==0){
            			 $scope.IsopenOrdersNull=true;
            		 }else{
            			 $scope.IsopenOrdersNull=false;
            		 }
            		 // 历史委托
            		 $scope.allOrders.splice(0, 0, order)
            		 if($scope.allOrders.length==0){
            			 $scope.IsallOrdersNull=true
            		 }else{
            			 $scope.IsallOrdersNull=false
            		 }
            		
            		 
					 break;
             }
        	 // 更新总计
        	 $scope.totalMarketValue=0
        	 $scope.cost=0
        	 $scope.userAssets.forEach(function(value,index){
        		 if(value.price){
        			 $scope.totalMarketValue+=Number(value.price)*(Number(value.free)+Number(value.freeze)+Number(value.locked)+Number(value.withdrawing));
     				$scope.cost+=Number(value.cost);
     			}
        	 })
        	 $scope.totalProfit=$scope.totalMarketValue-$scope.cost
    		
        	
    	}
    	var phase = $scope.$root.$$phase;
        if (phase != '$apply' && phase != '$digest') {
            $scope.$apply();
        }
    }
    $scope.updatePosition=function(order, lastQty, lastPrice, fee)
    {
        var pos,posIndex;
        if($scope.userAssets  instanceof Array){
	   		 $scope.userAssets.forEach(function (a,index) {
					if(a.productSymbol==order.symbol){
						pos=a;
						posIndex=index;
						
					}
				})
   	 	}
        
        if (pos){
            if (order.side == "BUY"){
            	 pos.freeze=parseFloat(pos.freeze)
                 pos.cost=parseFloat(pos.cost)
                 
                pos.free = parseFloat(pos.free)+ lastQty;
                pos.cost =parseFloat(pos.cost)+ lastQty * lastPrice + fee;
               
                pos.costPrice = pos.cost / (pos.free + pos.locked + pos.freeze);
                pos.price = lastPrice;
                pos.marketValue = lastPrice * (pos.free + pos.locked + pos.freeze);
                pos.profitLoss = pos.marketValue - pos.cost;
                pos.percent = pos.profitLoss * 100 / pos.cost;
            }
            else if (order.side == "SELL")
            {
            	pos.locked=parseFloat(pos.locked).toFixed(2)
                pos.locked -= lastQty;
                if (pos.free == 0 && pos.locked == 0 && pos.freeze == 0 && pos.ipoing == 0 && pos.ipoable == 0 && pos.storage == 0)
                {
                	$scope.userAssets.splice(posIndex,1)
                }
                else
                {
                	pos.freeze=parseFloat(pos.freeze)
                    pos.cost=parseFloat(pos.cost)
                    pos.cost -= (lastQty * lastPrice - fee);
                    pos.costPrice = pos.cost / (pos.free + pos.locked + pos.freeze);
                    pos.price = lastPrice;
                    pos.marketValue = lastPrice * (pos.free + pos.locked + pos.freeze);
                    pos.profitLoss = pos.marketValue - pos.cost;
                    pos.percent = pos.profitLoss * 100 / pos.cost;
                }
               
            }
            //  更新当前 商品持仓 数量
            $scope.currentUserAsset=pos.free;
        }
        else
        {
            if (order.side == "BUY")
            {
                var position = {};
                position.productSymbol = order.symbol;
                position.productName = order.productName;
                position.free = lastQty;
                position.locked = 0;
                position.freeze = 0;
                position.ipoing = 0;
                position.ipoable = 0;
                position.storage = 0;
                position.cost = lastQty * lastPrice + fee;
                position.costPrice = lastPrice;
                position.price = lastPrice;
                position.marketValue = lastQty * lastPrice;
                position.profitLoss = -fee;
                position.percent = position.profitLoss * 100 / position.cost;
                $scope.userAssets.splice(0,0,position);
                
                $scope.currentUserAsset=position.free;
            }
        }
        if($scope.userAssets.length==0){
        	$scope.totalMarketValue=0
        	$scope.totalProfit=0
        }
        
    }
    
	
	 $http.get("/exchange/public/productSnapshot?symbol="+$scope.product.symbol).success(function(data){
		    if("false"==data){
		    	$scope.stopDepthStream=false
		    }else{
		    	$scope.stopDepthStream=true
		    	$http.get("/exchange/public/depthSnapshot?symbol="+$scope.product.symbol).success(function(data){
		    		data.eventType = "depthUpdate"
		    		callback(data)
		    		
		    	})
		    	
		    }
		  //判断是否使用 深度 快照
		    if(window.WebSocket){
		        $http.get("public/wssUrl").success(function(data){
		        	$scope.wssUrl=data;
		        	
		            $scope.connectToSymbol(data);
		     })
		    }else{
		        $interval(function(){
		            $scope.getNewest();
		            $scope.getBestTwenty();
		            $scope.getTodayTrades();
		        },1000);
		    }
	   })

    $scope.getUserInfo=function(products){
    	if(window.WebSocket){
		   	 var tradeConfig = {};
		        tradeConfig.method = "post";
		        tradeConfig.url = "/exchange/private/startStream";
		        
		        
		     $http(tradeConfig).success(function(data){
		    	 $http.get("public/wssUrl").success(function(d){
		        	 var url = d+'/'+data.listenKey
		        	 
		        	 $interval(function(){
		        		 $http({url:"/exchange/private/pingStream",method:"post",data:"listenKey="+data.listenKey}).success(function() {
				 				console.log("pingStream success")
				 			})
		             },60*1000*30);
		        	 
		        	 if ($scope.userStreamerInstance == null) {
		                 $scope.userStreamerInstance = new userStreamer();
		                 $scope.userStreamerInstance.startStream(url, function(data) {
		                	 console.log("##################")
		                	 $scope.userCallback(data,products)
		                 })
		        	 }
		    	 })
		    })
    	}
   }

    $scope.isFull=false;
    var klineCon=angular.element("#klinecon");
    var chart_container=angular.element("#chart_container");
    var w_height=angular.element(window).height();
    $scope.setlayout=function(){
    	var w_height=angular.element(window).height();
    	var top_height=angular.element(".header").outerHeight(true);
    	var lb_height=angular.element(".detail-lb").outerHeight(true);
    	var rb_height=angular.element(".detail-rb").outerHeight(true);
    	var trade_wbheight=angular.element("#trade-wb").outerHeight(true);
    	var trade_ztheight=angular.element("#trade-zt").outerHeight(true);
    	var trade_zxheight=angular.element(".kline-item").outerHeight(true);
    	var trade_paraheight=angular.element(".table.para").outerHeight(true);
    	
    	angular.element(".detail-lt").css({"height":w_height-top_height-lb_height,'max-height':w_height-top_height-42})
    	angular.element('.detail-rt').css('height',w_height-top_height-rb_height)
    	angular.element('.newtrade').css('height',w_height-top_height-rb_height-trade_paraheight)
    	angular.element(".tradefive-inner").css('height',(w_height-top_height-rb_height-trade_wbheight-trade_zxheight-trade_ztheight)/2)
    	if($scope.tabName=='kline'){
    		console.log(12)
    		chart_container.css({'height':w_height-top_height-lb_height-33,'max-height':w_height-top_height-75})
        	chart.resize();
    	}
    	if($scope.tabName=='depth'){
	    	angular.element(".box-inner").css({'height':w_height-top_height-lb_height,'max-height':w_height-top_height-75});
	        c.resize()
    	}
    }
   
    //全屏
    $scope.fullpage=function(){
        $scope.isFull=true;
        klineCon.css({
            position:'fixed',
            top:'0px',
            left:'0px',
            width:'100%',
            height:'100%',
            'z-index':99
        });
        
        chart_container.css({
            width:'100%',
            height:w_height-33+'px',
            'max-height':w_height-33+'px'
        })
        chart.resize();

    }
    //退出全屏
    $scope.offFullpage=function(){
        $scope.isFull=false;
        klineCon.css({position:'static'})
        $scope.setlayout();

    }
    window.onload=function(){
    	$scope.setlayout();
        chart_container.width(klineCon.width())
        chart.resize();
        angular.element('input').attr("autocomplete",'off')
    }
    window.onresize=function(){
        chart_container.width(klineCon.width())
        $scope.setlayout();
    }
    
    //拖拽
    var drabale=false;
	var y1=0;
	$(".handle").mousedown(function(e){
		drabale=true;
		y1 = e.clientY
		var h=$(".detail-lt").height();
		var bottom_h=$(".detail-lb").height();
			$(document).mousemove(function(e){
				if(drabale){
					var y=e.clientY - y1;
					$(".detail-lt").css('height',h+y+"px")
					$(".detail-lb").css('height',bottom_h-y+'px')
					if($scope.tabName=='kline'){
						$("#chart_container").css('height',h+y-33+"px")
						chart.resize();
					}
					if($scope.tabName=='depth'){
						$(".box-inner").css('height',h+y-3+"px")
						c.resize();
					}
					
				}
			})
		return false;
	})
	
	$(document).mouseup(function(){
		drabale=false;
	})
}])
																				


app.factory('klineStreamer', ['$http', '$interval',function($http, $interval) {

    return function() {
        var streamer = {};
        streamer.isRunning = false;
        streamer.restart = false;
        streamer.lastTradeId = -1;
        streamer.root_url = location.host.match('localhost') || location.host.match('192.168.0') ? '/exchange/public' : '/api/v1';

        streamer.startStream = function(symbol, url,interval, callback) {
            streamer.isRunning = true;
            streamer.url = url;
            streamer.interval=interval;
            streamer.lastDepthId = -2;
            streamer.lastKlineId = -1;
            streamer.backedMsg = [];
            streamer.buildingState = false;
            streamer.restart = true;

            streamer.symbol = symbol;
            streamer.lowerCaseSymbol = symbol.toLowerCase();

            streamer.processData = function(data) {
                if (!streamer._isDuplicate(data)) {
                    callback(data);
                }
            };

            if (streamer.ws) {
                streamer.ws.close();
            } else {
                streamer.ws = streamer._makeStream(); //<--- onOpen() calls buildState();
            }
        };

        streamer.stopStream = function() {
            streamer.restart = false;
            if (streamer.ws) {
                streamer.ws.close();
            }

            streamer.lastDepthId = -1;
            streamer.lastKlineId = -1;
            streamer.backedMsg = [];
            streamer.buildingState = true;
            streamer.isRunning = false;
        };

        streamer._rolloverStream = function() {
            console.log("Rolling over stream!");
            streamer.backedMsg = [];
            streamer.buildingState = true;
            streamer.ws = streamer._makeStream(); //<--- onOpen() calls buildState();
        }

        streamer._makeStream = function() {
            var ws = new WebSocket(streamer.url + "/" + streamer.lowerCaseSymbol + "_"+streamer.interval+".b10");

            ws.onopen = function() {
                console.log("Socket has been opened for: " + streamer.symbol + "!");
               
            };

            ws.onclose = function(close) {
                console.log("Socket has been CLOSED for: " + streamer.symbol + "!");

                if (streamer.restart) {
                    streamer._rolloverStream();
                } else {
                    delete streamer.ws;
                    console.log("Socket done!");
                }
            };

            ws.onmessage = function(message) {
                var data = JSON.parse(message.data);
                data=streamer.converter(data)
                console.log("WS recv: " + data.eventType);
                
                if (streamer.buildingState) {
                    streamer.backedMsg.push(data);
                    console.log("Adding msg to backlog: " + data.eventType);
                } else {
                    streamer.processData(data);
                }
            };

            return ws;
        }

       
        streamer.converter=function(dataTmp){
        	var data={}
        	data.eventType=dataTmp.e
        	data.eventTime=dataTmp.E
        	data.symbol=dataTmp.s
        	data.kline={}
        
           
        	
        	data.kline.time=dataTmp.k.t
        	data.kline.closeTime=dataTmp.k.T
        	data.kline.symbol=dataTmp.k.s
        	data.kline.interval=dataTmp.k.i
        	data.kline.firstId=dataTmp.k.f
        	data.kline.lastId=dataTmp.k.L
        	data.kline.open=dataTmp.k.o
        	
        	data.kline.close=dataTmp.k.c
        	data.kline.high=dataTmp.k.h
        	data.kline.low=dataTmp.k.l
        	data.kline.volume=dataTmp.k.v
        	data.kline.count=dataTmp.k.n
        	data.kline.closed=dataTmp.k.x
           
        	return data
        }
        streamer._isDuplicate = function(data) {
        	
        
           if (data.eventType == "kline") {
                //always process klines
                return false;
            } else {
                console.log("Error! Bad data received:");
                console.log(data);
            }

            return true;
        };

        return streamer;
    };
}]);

app.factory('mktdataStreamer', ['$http', '$interval',function($http, $interval) {

    return function() {
        var mktdataStreamer = {};
        mktdataStreamer.isRunning = false;
        mktdataStreamer.restart = false;

        mktdataStreamer.startStream = function(url, callback) {
            mktdataStreamer.isRunning = true;
            mktdataStreamer.url = url;
            mktdataStreamer.lastTradeIds = {};
            mktdataStreamer.backedMsg = [];
            mktdataStreamer.buildingState = true;
            mktdataStreamer.restart = true;

            mktdataStreamer.processData = function(data) {
                if (!mktdataStreamer._isDuplicate(data)) {
                    callback(data);
                }
            };

            if (mktdataStreamer.ws) {
                mktdataStreamer.ws.close();
            } else {
                mktdataStreamer.ws = mktdataStreamer._makeStream(); //<--- onOpen() calls buildState();
            }
        };

        mktdataStreamer.stopStream = function() {
            mktdataStreamer.restart = false;
            if (mktdataStreamer.ws) {
                mktdataStreamer.ws.close();
            }

            mktdataStreamer.lastTradeIds = {};
            mktdataStreamer.backedMsg = [];
            mktdataStreamer.buildingState = true;
            mktdataStreamer.isRunning = false;
        };

        mktdataStreamer._rolloverStream = function() {
            console.log("Rolling over stream!");
            mktdataStreamer.backedMsg = [];
            mktdataStreamer.buildingState = true;
            mktdataStreamer.ws = mktdataStreamer._makeStream(); //<--- onOpen() calls buildState();
        }

        mktdataStreamer._makeStream = function() {
            var ws = new WebSocket(mktdataStreamer.url + "/!mktdata" + ".b10");

            ws.onopen = function() {
                console.log("Socket has been opened for: market data!");
                mktdataStreamer._buildState();
            };

            ws.onclose = function(close) {
                console.log("Socket has been CLOSED for: market data!");

                if (mktdataStreamer.restart) {
                    mktdataStreamer._rolloverStream();
                } else {
                    delete mktdataStreamer.ws;
                    console.log("Socket done!");
                }
            };

            ws.onmessage = function(message) {
                var data = JSON.parse(message.data);
                data=mktdataStreamer.converter(data);
                console.log("Market data WS recv, symbol: " + data.symbol + ", tradeId: " + data.tradeId);

                if (mktdataStreamer.buildingState) {
                    mktdataStreamer.backedMsg.push(data);
                    console.log("Adding msg to backlog: " + data.eventType);
                } else {
                    mktdataStreamer.processData(data);
                }
            };

            return ws;
        }

        mktdataStreamer._buildState = function() {
        	mktdataStreamer.buildingState = false;
        }
        mktdataStreamer.converter=function(dataTmp){
        	var data={}
        	data.eventType=dataTmp.e
        	data.eventTime=dataTmp.E
        	data.symbol=dataTmp.s
        	data.tradeId=dataTmp.t
        	data.price=dataTmp.p
        	data.qty=dataTmp.q
        	data.buyerOrderId=dataTmp.b
        	data.sellerOrderId=dataTmp.a
        	data.time=dataTmp.T
        	data.isBuyerMaker=dataTmp.m
        	return data
        }
        mktdataStreamer._isDuplicate = function(data) {
            if (data.eventType == "trade") {
            	if(mktdataStreamer.lastTradeIds[data.symbol] == undefined 
            			|| mktdataStreamer.lastTradeIds[data.symbol] < data.tradeId) {
            		mktdataStreamer.lastTradeIds[data.symbol] = data.tradeId;
            		return false;
            	}
            }

            return true;
        };

        return mktdataStreamer;
    };
}]);

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
app.factory('streamer', ['$http', '$interval',function($http, $interval) {

    return function() {
        var streamer = {};
        streamer.isRunning = false;
        streamer.restart = false;
        streamer.lastTradeId = -1;
        streamer.root_url = location.host.match('localhost') || location.host.match('192.168.0') ? '/exchange/public' : '/api/v1';

        streamer.startStream = function(symbol, url, callback) {
            streamer.isRunning = true;
            streamer.url = url;
            
            streamer.lastDepthId = -2;
            streamer.lastKlineId = -1;
            streamer.backedMsg = [];
            streamer.buildingState = true;
            streamer.restart = true;

            streamer.symbol = symbol;
            streamer.lowerCaseSymbol = symbol.toLowerCase();

            streamer.processData = function(data) {
                if (!streamer._isDuplicate(data)) {
                    callback(data);
                }
            };

            if (streamer.ws) {
                streamer.ws.close();
            } else {
                streamer.ws = streamer._makeStream(); //<--- onOpen() calls buildState();
            }
        };

        streamer.stopStream = function() {
            streamer.restart = false;
            if (streamer.ws) {
                streamer.ws.close();
            }

            streamer.lastDepthId = -1;
            streamer.lastKlineId = -1;
            streamer.backedMsg = [];
            streamer.buildingState = true;
            streamer.isRunning = false;
        };

        streamer._rolloverStream = function() {
            console.log("Rolling over stream!");
            streamer.backedMsg = [];
            streamer.buildingState = true;
            streamer.ws = streamer._makeStream(); //<--- onOpen() calls buildState();
        }

        streamer._makeStream = function() {
            var ws = new WebSocket(streamer.url + "/" + streamer.lowerCaseSymbol + ".b10");

            ws.onopen = function() {
                console.log("Socket has been opened for: " + streamer.symbol + "!");
                streamer._buildState();
            };

            ws.onclose = function(close) {
                console.log("Socket has been CLOSED for: " + streamer.symbol + "!");

                if (streamer.restart) {
                    streamer._rolloverStream();
                } else {
                    delete streamer.ws;
                    console.log("Socket done!");
                }
            };

            ws.onmessage = function(message) {
                var data = JSON.parse(message.data);

                console.log("WS recv: " + data.eventType);
                data=streamer.converter(data)
                if (streamer.buildingState) {
                    streamer.backedMsg.push(data);
                    console.log("Adding msg to backlog: " + data.eventType);
                } else {
                    streamer.processData(data);
                }
            };

            return ws;
        }

        streamer._buildState = function() {
            var depthConfig = {};
            depthConfig.method = "get";
            depthConfig.url = streamer.root_url + "/depth";
            depthConfig.params = {
                "symbol": streamer.symbol
            };

            var tradeConfig = {};
            tradeConfig.method = "get";
            tradeConfig.url = "/exchange/public/todayTrades";
            tradeConfig.params = {
                "symbol": streamer.symbol,
                "tradeId": streamer.lastTradeId + 1
            };

            //TODO: do klines need to be fetched too? I don't think so actually.
            $http(depthConfig).success(function(depthData) {
                $http(tradeConfig).success(function(tradeData) {
                    var depth = {};
                    depth.eventType = "depthUpdate";
                    depth.updateId = depthData.lastUpdateId;
                    depth.bids = depthData.bids;
                    depth.asks = depthData.asks;
                    streamer.lastKlineId = -1;

                    streamer.processData(depth);

                    for (var i = 0; i < tradeData.length; i++) {
                        var trade = {};
                        trade.eventType = "trade";
                        trade.tradeId = tradeData[i].id;
                        trade.price = tradeData[i].price;
                        trade.qty = tradeData[i].qty;
                        trade.time = tradeData[i].time;
                        trade.isBuyerMaker=tradeData[i].isBuyerMaker;
                        trade.buyerOrderId = -1;
                        trade.sellerOrderId = -1;

                        streamer.processData(trade);
                    }

                    console.log("Initial state set!");

                    console.log("Replaying " + streamer.backedMsg.length + " backed msgs!");
                    var curr = streamer.backedMsg.shift();

                    while (curr) {

                        streamer.processData(curr);
                        console.log("Replayed: " + curr.eventType);

                        curr = streamer.backedMsg.shift();
                    }
                    streamer.buildingState = false;

                    console.log("Replaying DONE! " + streamer.backedMsg.length + " backed msgs remain.");
                    if (streamer.backedMsg.length != 0) {
                        console.log("OMG!! ME SMASH!!! GIVE ME A REAL THREADING MODEL PLEASE!!");

                        curr = streamer.backedMsg.shift();
                        while (curr) {
                            streamer.processData(curr);

                            curr = streamer.backedMsg.shift();
                        }
                    }
                });
            });
        }
        streamer.converter=function(dataTmp){
        	var data={}
        	data.eventType=dataTmp.e
        	data.eventTime=dataTmp.E
        	data.symbol=dataTmp.s
        	data.kline=dataTmp.k
        
            if (data.eventType == "depthUpdate") {
            	data.event=dataTmp.e
            	data.eventTime=dataTmp.E
            	data.symbol=dataTmp.s
            	data.updateId=dataTmp.u
            	data.bids=dataTmp.b
            	data.asks=dataTmp.a
      
            } else if (data.eventType == "trade") {
            	data.event=dataTmp.e
            	data.eventTime=dataTmp.E
            	data.tradeId=dataTmp.t
            	data.price=dataTmp.p
            	data.qty=dataTmp.q
            	
            	data.buyerOrderId=dataTmp.b
            	data.sellerOrderId=dataTmp.a
            	
            	data.time=dataTmp.T
            	data.isBuyerMaker=dataTmp.m
            } else if (data.eventType == "kline") {
            	data.time=dataTmp.t
            	data.closeTime=dataTmp.T
            	data.symbol=dataTmp.s
            	data.interval=dataTmp.i
            	data.firstId=dataTmp.f
            	data.lastId=dataTmp.L
            	data.open=dataTmp.o
            	
            	data.close=dataTmp.c
            	data.high=dataTmp.h
            	data.low=dataTmp.l
            	data.volume=dataTmp.v
            	data.count=dataTmp.n
            	data.closed=dataTmp.x
            } else {
                console.log("Error! Bad data received:");
                console.log(data);
            }
        	return data
        }
        streamer._isDuplicate = function(data) {
        	
        
            if (data.eventType == "depthUpdate") {
            	
                if (data.updateId > streamer.lastDepthId) {
                    streamer.lastDepthId = data.updateId;
                    return false;
                }
            } else if (data.eventType == "trade") {
                if (data.tradeId > streamer.lastTradeId) {
                    streamer.lastTradeId = data.tradeId;
                    return false;
                }
            } else {
                console.log("Error! Bad data received:");
                console.log(data);
            }

            return true;
        };

        return streamer;
    };
}]);

app.factory('userStreamer', ['$http', '$interval',function($http, $interval) {

    return function() {
        var userStreamer = {};
        userStreamer.isRunning = false;
        userStreamer.restart = false;
      
        userStreamer.startStream = function(url, callback) {
            userStreamer.isRunning = true;
            userStreamer.url = url;
            userStreamer.lastTradeIds = {};
            userStreamer.backedMsg = [];
            userStreamer.buildingState = true;
            userStreamer.restart = true;

            userStreamer.processData = function(data) {
                if (!userStreamer._isDuplicate(data)) {
                    callback(data);
                }
            };

            if (userStreamer.ws) {
                userStreamer.ws.close();
            } else {
                userStreamer.ws = userStreamer._makeStream(); //<--- onOpen() calls buildState();
            }
        };

        userStreamer.stopStream = function() {
            userStreamer.restart = false;
            if (userStreamer.ws) {
                userStreamer.ws.close();
            }

            userStreamer.lastTradeIds = {};
            userStreamer.backedMsg = [];
            userStreamer.buildingState = true;
            userStreamer.isRunning = false;
        };

        userStreamer._rolloverStream = function() {
            console.log("Rolling over stream!");
            userStreamer.backedMsg = [];
            userStreamer.buildingState = true;
            userStreamer.ws = userStreamer._makeStream(); //<--- onOpen() calls buildState();
        }

        userStreamer._makeStream = function() {
            var ws = new WebSocket(userStreamer.url);

            ws.onopen = function() {
                console.log("Socket has been opened for: market data!");
                userStreamer._buildState();
            };

            ws.onclose = function(close) {
                console.log("Socket has been CLOSED for: market data!");

                if (userStreamer.restart) {
                    userStreamer._rolloverStream();
                } else {
                    delete userStreamer.ws;
                    console.log("Socket done!");
                }
            };

            ws.onmessage = function(message) {
                var data = JSON.parse(message.data);
                data=userStreamer.converter(data)
                console.log("User data WS recv, eventType: " + data.eventType + ", eventTime: " + data.eventTime);

                if (userStreamer.buildingState) {
                    userStreamer.backedMsg.push(data);
                    console.log("Adding msg to backlog: " + data.eventType);
                } else {
                    userStreamer.processData(data);
                }
            };

            return ws;
        }

        userStreamer._buildState = function() {
        	userStreamer.buildingState = false;
        }
        userStreamer.converter= function(dataTmp){
        	var data={}
        	data.eventType=dataTmp.e
        	if(data.eventType=="outboundAccountInfo"){
	        	data.eventTime=dataTmp.E
	        	data.makerCommission=dataTmp.m
	        	data.takerCommission=dataTmp.t
	        	data.buyerCommission=dataTmp.b
	        	data.sellerCommission=dataTmp.s
	        	data.isActive=dataTmp.a
	        	data.balances=[]
	        	dataTmp.B&&dataTmp.B.forEach(function(B){
	        		data.balances.push({
		        		asset:B.a,
			        	free:B.f,
			        	locked:B.l
		        	})
	        	})
	        	
	        	
	        	
	        	data.leverage=dataTmp.l
	        	
	        	data.positions=[]
	        	dataTmp.p&&dataTmp.p.forEach(function(pos){
	        		data.positions.push({
	        			symbol :pos.s,
	                    usedQty :pos.u,
	                    usedMargin :pos.U,
	                    avgQuotePrice :pos.q,
	                    pendingQtyBuy :pos.b,
	                    pendingMarginBuy :pos.B,
	                    pendingQtySell :pos.a,
	                    pendingMarginSell :pos.A,
	                    lockedProfitLoss :pos.l
	        		})
	        	})
        	}else if(data.eventType=="executionReport"){
        		data.event =dataTmp.e
        		data.eventTime =dataTmp.E
        		data.symbol =dataTmp.s
        		data.clOrdId =dataTmp.c
        		data.side =dataTmp.S
        		data.orderType =dataTmp.o
        		data.timeInForce =dataTmp.f
        		data.qty =dataTmp.q
        		data.price =dataTmp.p
        		data.stopPrice =dataTmp.P
        		data.maxFloor =dataTmp.F
        		data.originalClOrdId =dataTmp.C
        		data.executionType =dataTmp.x
        		data.orderStatus =dataTmp.X
        		data.orderRejectReason =dataTmp.r
        		data.orderId =dataTmp.i
        		data.lastQty =dataTmp.l
        		data.cummulativeQty =dataTmp.z
        		data.lastPrice =dataTmp.L
        		data.commission =dataTmp.n
        		data.commissionAsset =dataTmp.N
        		data.time =dataTmp.T
        		data.executionId =dataTmp.I
        		data.tradeId =dataTmp.t
        		data.workingIndicator =dataTmp.w
        		data.isMaker =dataTmp.m
        	}
        	return data
        }
        userStreamer._isDuplicate = function(data) {
            
        	/*if(userStreamer.eventTime[data.symbol] == undefined 
        			|| userStreamer.eventTime[data.symbol] < data.eventTime) {
        		userStreamer.eventTime[data.symbol] = data.eventTime;
        		return false;
        	}
*/
            return false;
        };

        return userStreamer;
    };
}]);
