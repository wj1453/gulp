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
