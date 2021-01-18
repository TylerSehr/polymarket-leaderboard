import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'isomorphic-fetch';
import axios from "axios";
import tradesRoutes from './routes/trades.js';

const app = express();
const PORT = 5000;

app.use(bodyParser.json());

app.use('/trades', tradesRoutes);
app.get('/', (req, res) => res.send('Hello from Homepage'));

const perPage = 1000;

let dailyTimeCached = 0;
let dailyCache = [];

let weeklyTimeCached = 0;
let weeklyCache = [];

let monthlyTimeCached = 0;
let monthlyCache = [];

let allTimeCached = 0;
let allCache = [];

const setCache = (filter, time, cache) => {
    switch (filter) {
        case "daily":
            dailyTimeCached = time;
            dailyCache = cache;
            break;
        case "weekly":
            weeklyTimeCached = time;
            weeklyCache = cache;
            break;
        case "monthly":
            monthlyTimeCached = time;
            montlyCache = cache;
            break;
        case "all":
            allTimeCached = time;
            allCache = cache;
            break;
        default:
            allTimeCached = time;
            allCache = cache;
    }
}

const getTimeCached = (filter) => {
    let timeCached;
    switch (filter) {
        case "daily":
            timeCached = dailyTimeCached;
            break;
        case "weekly":
            timeCached = weeklyTimeCached;
            break;
        case "monthly":
            timeCached = monthlyTimeCached;
            break;
        case "all":
            timeCached = allTimeCached;
            break;
        default:
            timeCached = allTimeCached;
    }
    return timeCached;
}

const getTimeAgo = (filter) => {
    let timeAgo;
    switch (filter) {
        case "daily":
            timeAgo = parseInt(Date.now() / 1000 - 86400);
            break;
        case "weekly":
            timeAgo = Date.now() / 1000 - 604800;
            break;
        case "monthly":
            timeAgo = Date.now() / 1000 - 9192631770;
            break;
        case "all":
            timeAgo = 0;
            break;
        default:
            timeAgo = 0;
    }
    return timeAgo;
}

const getCache = (filter) => {
    let cache;
    switch (filter) {
        case "daily":
            cache = dailyCache;
            break;
        case "weekly":
            cache = weeklyCache;
            break;
        case "monthly":
            cache = monthlyCache;
            break;
        case "all":
            cache = allCache;
            break;
        default:
            cache = allCache;
    }
    return cache;
}

const getAllTraders = async (time) => {
    const fetchTraders = async (page) => {
        let res = await axios.post('https://subgraph-matic.poly.market/subgraphs/name/TokenUnion/polymarket', {
            query: `
                {
                    accounts (where: {lastTradedTimestamp_gt: ${time}}, orderBy: lastTradedTimestamp, orderDirection: desc, first: ${perPage}, skip:${perPage * page}) {
                        id
                    }
                }
            `
        })
        const accounts = res.data.data.accounts;
        console.log("fetching traders page ", page, time, "\n", res.data.data.accounts);
        if (accounts.length === perPage
            // DEEELETTTEE, JUST FOR FASTER TESTING
            // && page < 1
        ) {
            return accounts.concat(await fetchTraders(page + 1));
        } else {
            return accounts;
        }
    }
    return await fetchTraders(0);
}

const getTraderTransactions = async (traderId, time) => {
    const fetchTransactions = async (page) => {
        let res = await axios.post('https://subgraph-matic.poly.market/subgraphs/name/TokenUnion/polymarket', {
            query: `
            {
                transactions (where: { timestamp_gt: ${time}, user: "${traderId}" }, orderBy: timestamp, orderDirection: desc, first: ${perPage}, skip:${perPage * page}) {
          type,
          tradeAmount,
          timestamp,
                }
            }
            `
        })
        const transactions = res.data.data.transactions;
        console.log("fetching transactions page ", page, time, "\n", transactions);
        if (transactions.length === perPage) {
            return transactions.concat(await fetchTransactions(page + 1));
        } else {
            return transactions;
        }
    }
    return await fetchTransactions(0);
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

const getLeaderboard = (traders) => {
    let filteredTraders = traders.filter(trader => isFinite(trader.roiPercent));
    console.log("filtered", filteredTraders);
    filteredTraders.sort(function (a, b) {
        console.log("compare?", a, b);
        return b.roiPercent - a.roiPercent;
    });
    console.log("sorted", filteredTraders);
    const leaderboard = filteredTraders.slice(0, 10);
    return (leaderboard);
}

const updateCache = async (filter) => {
    const timeAgo = getTimeAgo(filter);
    const traders = await getAllTraders(timeAgo);
    let updatedTraders = [];
    for (let trader of traders) {
        const updatedTrader = await getTraderMetaData(trader.id, timeAgo)
        updatedTraders.push(updatedTrader);
    }
    const leaderboard = getLeaderboard(updatedTraders);
    console.log("updated finale", leaderboard);
}

app.get('/traders', (req, res) => {
    try {
        const filterQuery = JSON.parse(req.query.filter);
        console.log("filter", filterQuery);
        const timeCached = getTimeCached(filterQuery);
        const cache = getCache(filterQuery);
        console.log("gettin", cache, timeCached);
        if (!cache.length) {
            updateCache("daily");
            // updateCache("weekly");
            // updateCache("monthly");
            // updateCache("all");
            res.send("API just started, try again soon.")
            return;
        }
        const oneHourAgo = Date.now() / 1000 - 3600;
        if (timeCached < oneHourAgo) {
            updateCache(filterQuery);
        }
        res.send(cache);
    } catch (error) {
        console.log(error);
        res.status(500).send("server error");
    }
});

app.listen(PORT, () => console.log(`Server running on port: http://localhost:${PORT}`));