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
