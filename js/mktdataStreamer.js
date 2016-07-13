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
