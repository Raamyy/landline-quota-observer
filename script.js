const axios = require('axios').default;
const fs = require('fs')
require('dotenv').config()
const ChartJsImage = require('chartjs-to-image');
const moment = require('moment');

const landlinenumber = process.env.LANDLINE_NUMBER; // 02xxxxxxxx
const password = process.env.HASHED_PASSWORD;

async function getAnnonymousToken() {
    const url = `https://api-my.te.eg/api/user/generatetoken?channelId=WEB_APP`;
    let config = {
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en,ar;q=0.9,en-US;q=0.8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Origin': 'https://my.te.eg',
            'Pragma': 'no-cache',
            'Referer': 'https://my.te.eg/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        }
    }
    let tokenResult = await axios.get(url, config);
    return tokenResult.data.body.jwt;
}

async function getWEToken(jwt) {
    const url = `https://api-my.te.eg/api/user/login?channelId=WEB_APP`;
    let data = JSON.stringify({
        "header": {
            "msisdn": landlinenumber,
            "numberServiceType": "FBB",
            "timestamp": new Date().getTime(),
            "locale": "en"
        },
        "body": {
            "password": password
        }
    });
    let config = {
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en,ar;q=0.9,en-US;q=0.8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json',
            'Jwt': jwt,
            'Origin': 'https://my.te.eg',
            'Pragma': 'no-cache',
            'Referer': 'https://my.te.eg/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        }
    }
    let tokenResult = await axios.post(url, data, config);
    if (!tokenResult.data.body) {
        throw new Error("login failed, incorrect landline number or password");
    }
    // console.log(tokenResult);
    return { jwt: tokenResult.data.body.jwt, customerId: tokenResult.data.header.customerId };
}


async function getCurrentUsage(jwt, customerId) {
    const url = `https://api-my.te.eg/api/line/freeunitusage`;
    let data = JSON.stringify({
        "header": {
            "customerId": customerId,
            "msisdn": landlinenumber,
            "numberServiceType": "FBB",
            "locale": "en"
        }
    });
    let config = {
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en,ar;q=0.9,en-US;q=0.8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json',
            'Jwt': jwt,
            'Origin': 'https://my.te.eg',
            'Pragma': 'no-cache',
            'Referer': 'https://my.te.eg/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        }
    };
    let usageResult = await axios.post(url, data, config);

    return {
        freeUsage: usageResult.data.body.summarizedLineUsageList.find(u => u.summaryGroupName == "ADSL_USAGE_PREPAID").freeAmount,
        initialTotalAmount: usageResult.data.body.summarizedLineUsageList.find(u => u.summaryGroupName == "ADSL_USAGE_PREPAID").initialTotalAmount
    }
}

function getDateWithOffset(offset) {
    const currentMoment = moment().utcOffset(offset);
    console.log("current moment", currentMoment);
    return currentMoment;
}
async function main() {
    if (!landlinenumber) {
        throw new Error("landline not provided");
    }
    if (!password) {
        throw new Error("password not provided");
    }
    let annoynmousToken = await getAnnonymousToken();
    let { jwt, customerId } = await getWEToken(annoynmousToken);
    let { freeUsage, initialTotalAmount } = await getCurrentUsage(jwt, customerId);
    let now = getDateWithOffset(2);
    let day = now.date(), month = now.month(), year = now.year(), hour = now.hour();
    let text = `${now.toString()}|${freeUsage}/${initialTotalAmount}\n`;
    let filename = `quota-logs/${day}-${month}-${year}.txt`
    fs.appendFileSync(filename, text, { flag: 'a+' });

    if (hour == 0 || hour == 1) { // new day: append to summary file daily
        fs.appendFileSync("quota-logs/README.md", "## " + text, { flag: 'a+' });
    }

    generateChart("quota-logs/README.md");
}

function generateChart(dataFile) {
    let file = fs.readFileSync(dataFile);

    let fileContent = file.toString().split("\n");

    let dates = [];
    let dataset = [];

    for (const line of fileContent) {
        if (!line) continue;
        let splt = line.split("|");
        let date = new Date(splt[0].split("## "[1]));
        let usage = splt[1].split("/")[0];
        dates.push(date);
        dataset.push(usage);
    }

    const data = {
        labels: dates,
        datasets: [{
            label: 'Usage',
            backgroundColor: "#228DAC",
            borderColor: "#228DAC",
            fill: false,
            data: dataset,
        }]
    };

    let chartConfig = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Personal Landline Consumption'
            },
            scales: {
                xAxes: [{
                    type: 'time',
                    scaleLabel: {
                        display: true,
                        labelString: 'Date'
                    },
                    ticks: {
                        // show ticks every four days :)
                        callback: function (val, index) {
                            return index % 4 === 0 ? val : '';
                        },
                    }
                }],
                yAxes: [{
                    type: 'linear',
                    scaleLabel: {
                        display: true,
                        labelString: 'value'
                    }
                }]
            }
        },
    };

    const myChart = new ChartJsImage();
    myChart.setConfig(chartConfig);
    myChart.setWidth(1400);
    myChart.setWidth(800);

    myChart.toFile('./chart.png');
}

main()
