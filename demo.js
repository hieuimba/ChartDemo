const API_KEY = 'PKK43JN5CEE7DO56PFEA';
const SECRET_KEY = 'PAf774AkgrDgtXYivfc61JdZy52oHgV7IloYBNQE';

let currentBar = {};
let trades = [];
let symbolList = [];
var sockets = [];

function clearBox(elementID) {
    document.getElementById(elementID).innerHTML = "";
}

function render_chart() {
    var symbol = document.getElementById("input").value.toUpperCase() + 'USD';
    symbolList.unshift(symbol);

    clearBox('chart');
    candleSeries = add_chart();
    get_historical_data(symbol, candleSeries);
    get_real_time_data(symbolList);
}

function add_chart() {
    var chart = LightweightCharts.createChart(document.getElementById('chart'), {
        width: 700,
        height: 700,
        layout: {
            backgroundColor: '#F5F5F5',
            textColor: '#000000',
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
		    borderColor: '#000000',
	    },
	    timeScale: {
		    borderColor: '#000000',
	    },
    });

    var candleStyle = {
        upColor: '#FFFFFF',
        downColor: '#000000',
        borderColor: '#000000',
        wickColor: '#000000',
        priceLineColor: '#000000',
        priceLineVisible: false,
    };

    ChartSeries = chart.addCandlestickSeries(candleStyle)
    // ChartSeries = ChartSeries.LineStyleOptions({crosshairMarkerVisible:false})
    return ChartSeries;
}

function get_historical_data(s, candleSeries) {
    const one_hour = (7200 * 2000)
    var start = new Date(Date.now() - 3 * one_hour).toISOString();

    var bars_url = 'https://data.alpaca.markets/v1beta1/crypto/' + s +'/bars?exchanges=CBSE&timeframe=1Min&start=' + start;

    fetch(bars_url, {
        headers: {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': SECRET_KEY
        }
    }).then((r) => r.json())
        .then((response) => {

            const his_data = response.bars.map(bar => (
                {
                    open: bar.o,
                    high: bar.h,
                    low: bar.l,
                    close: bar.c,
                    time: Date.parse(bar.t) / 1000
                }
            ));

            currentBar = his_data[his_data.length-1];

            candleSeries.setData(his_data);
            console.log('data: ', his_data );
        })
}

function addClient(url) {
    var socket = new WebSocket(url);
    sockets.push(socket);
    return socket
}

function removeAllClients(){
    sockets.forEach(function(s) {
        s.close();
    });
}

function get_real_time_data(s_list) {
    removeAllClients()
    var socket = addClient("wss://stream.data.alpaca.markets/v1beta1/crypto")

    const quotesElement = document.getElementById('quotes');
    const tradesElement = document.getElementById('trades');

    const auth = {"action": "auth", "key": API_KEY, "secret": SECRET_KEY};

    if (s_list.length > 2) {
        s_list.pop()
    }

    // var firstSymbol = s_list[0]
    var firstSymbol = s_list[0]
    // var lastSymbol = s_list[s_list.length-1]

    const subscribe = {"action":"subscribe", "trades":[`${firstSymbol}`], "quotes":[`${firstSymbol}`], "bars":[`${firstSymbol}`]}
    // const unsubscribe = {"action":"unsubscribe", "trades":[`${lastSymbol}`], "quotes":[`${lastSymbol}`], "bars":[`${lastSymbol}`]}

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        const message = data[0]['msg'];

        if (message == 'connected') {
            console.log(message);
            socket.send(JSON.stringify(auth));
        }

        if (message == 'authenticated') {
            socket.send(JSON.stringify(subscribe));
            console.log(`subscribed to ${firstSymbol}`);
            trades = []
        }

        for (var key in data) {
            const type = data[key].T;

            if (type == 'q') {
                const quoteElement = document.createElement('div');
                quoteElement.className = 'quote';
                quoteElement.innerHTML = `<b>${data[key].t}</b> Bid: ${data[key].bp}, Ask: ${data[key].ap}`;
                quotesElement.appendChild(quoteElement);

                var elements = document.getElementsByClassName('quote');
                if (elements.length > 10) {
                    quotesElement.removeChild(elements[0]);
                }
            }

            if (type == 't') {
                const tradeElement = document.createElement('div');
                tradeElement.className = 'trade';
                tradeElement.innerHTML = `<b>${data[key].t}</b>, Price: ${data[key].p}, Size: ${data[key].s}`;
                tradesElement.appendChild(tradeElement);

                var elements = document.getElementsByClassName('trade');
                if (elements.length > 10) {
                    tradesElement.removeChild(elements[0]);
                }

                trades.push(data[key].p);

                var open = trades[0];
                var high = Math.max(...trades);
                var low = Math.min(...trades);
                var close = trades[trades.length - 1];

                candleSeries.update({
                    time: currentBar.time + 60,
                    open: open,
                    high: high,
                    low: low,
                    close: close
                })
            }

            if (type == 'b' && data[key].x == 'CBSE') {
                console.log('got a new bar');
                console.log(data[key]);

                var bar = data[key];
                var timestamp = new Date(bar.t).getTime() / 1000;

                currentBar = {
                    time: timestamp,
                    open: bar.o,
                    high: bar.h,
                    low: bar.l,
                    close: bar.c
                }

                candleSeries.update(currentBar);

                trades = [];
            }
        }
    }
    return socket
}