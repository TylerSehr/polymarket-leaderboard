import axios from 'axios'

let hour = {
	value: parseInt(Date.now() / 1000 - 86400 / 24),
	cached: null,
	lastUpdated: 0,
	updatePeriod: 86400 / 24
}

let day = {
	value: parseInt(Date.now() / 1000 - 86400),
	cached: null,
	lastUpdated: 0,
	updatePeriod: 86400 / 24
}

let week = {
	value: parseInt(Date.now() / 1000 - 604800),
	cached: null,
	lastUpdated: 0,
	updatePeriod: 86400,
}

let month = {
	value: parseInt(Date.now() / 1000 - 9192631770),
	cached: null,
	lastUpdated: 0,
	updatePeriod: 604800,
}

let allTime = {
	value: 0,
	cached: null,
	lastUpdated: 0,
	updatePeriod: 604800
}

const api = {
	hour: () => leaderboard(hour.value),
	day: () => leaderboard(day.value),
	week: () => leaderboard(week.value),
	month: () => leaderboard(month.value),
	allTime: () => leaderboard(allTime.value)
}


// const main = async (time) => {
// 	let shouldUpdate = Date.now() - time.updatePeriod 
// 	if (shouldUpdate > time.lastUpdated) {
// 		time.cached = await leaderboard(time.value)
// 	}		
// 	console.log(time.cached);
	
// 	return time.cached
// }

const leaderboard = async (time) => {
	let traders = []
	let end = false
	let page = 0
	let leaderboard
	
	while (!end) {
		let res = await fetchTraders(time, page)
		if (res.length === 0) {
			end = true
		}
		traders = traders.concat(res)
		page++
	}
	for (let i = 0; i < traders.length; i++) {
		traders[i].transactions = await getTraderMetaData(traders[i].id, time)
	}
	
	leaderboard = sortLeaderboard(traders)
	console.log(leaderboard)
	
	return leaderboard
}

const fetchTraders = async (time, page) => {
	let res = await axios.post('https://subgraph-matic.poly.market/subgraphs/name/TokenUnion/polymarket', {
		query: `{
				accounts (where: {lastTradedTimestamp_gt: ${time}}, orderBy: lastTradedTimestamp, orderDirection: desc, first: ${1000}, skip:${1000 * page}) {
					id,
					scaledCollateralVolume
				}
			}
		`
	})	
	return res.data.data.accounts
}

const getTransactions = async (trader, time, page) => {
	let res = await axios.post('https://subgraph-matic.poly.market/subgraphs/name/TokenUnion/polymarket', {
		query: `{
			transactions (where: { timestamp_gt: ${time}, user:  "${trader}" }, orderBy: timestamp, orderDirection: desc, first: ${1000}, skip:${1000 * page}) {
	  			type,
	  			tradeAmount,
	  			timestamp,
			}
		}
		`
	})
	return res.data.data.transactions
}

const getTraderTransactions = async (trader, time) => {
	let transactions = []
	let end = false
	let page = 0
	while (!end) {
		let res = await getTransactions(trader, time, page)
		if (res.length === 0) {
			end = true
		}
		transactions = transactions.concat(res)
		page++
	}
	return transactions
}

const getTraderMetaData = async (trader, time) => {
    const transactions = await getTraderTransactions(trader, time);

    const totalTrades = transactions.length;
    let invested = 0;
    let earnings = 0;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].type === "Buy") {
            invested += parseInt(transactions[i].tradeAmount);
        } else if (transactions[i].type === "Sell") {
            earnings += parseInt(transactions[i].tradeAmount);
        }
    }
    const roiDollars = earnings - invested;
    const roiPercent = roiDollars * 100 / invested;
    return (
        {
            user: trader,
            totalTrades,
            invested,
            earnings,
            roiDollars,
            roiPercent,
        }
    )
}

const sortLeaderboard = (traders) => {
    let filteredTraders = traders.filter(trader => isFinite(trader.transactions.roiPercent));
    filteredTraders.sort(function (a, b) {
        return b.transactions.roiPercent - a.transactions.roiPercent;
    });
    const leaderboard = filteredTraders.slice(0, 10);
    return (leaderboard);
}



// module.exports = api
// api.hour()