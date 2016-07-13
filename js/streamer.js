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
