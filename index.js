const Twit = require('twit');
const Axios = require('axios');
const fs = require('fs');

const Configuration = require('./config.json');

// Replace with your own API keys and tokens.
const T = new Twit({
    consumer_key: Configuration.TwitterAPI_Key,
    consumer_secret: Configuration.TwitterAPI_KeySecret,
    access_token: Configuration.TwitterBot_AccessToken,
    access_token_secret: Configuration.TwitterBot_AccessSecret,
});


async function CheckUpdates(){
    //Requests the event rotation.
    const Response = await Axios({
        url: "https://bsproxy.royaleapi.dev/v1/events/rotation",
        headers: {
            'Authorization': `Bearer ${Configuration.BrawlStarsToken}`
        }
    }).catch((Error) => {
        console.log(Error.response.data);
    });

    if(Response.status != 200) return;

    //Old Map Data from JSON File.
    delete require.cache[require.resolve(`./response.json`)];
    const OldData = require('./response.json');
    //This is your new request data.
    const NewData = Response.data;
    //Index Idetifier.
    let i = 0;
    //New Map Objects here.
    let NewMaps = [];


    Promise.all(OldData.map(async (OldMap) => {
        if(OldMap.event.id != NewData[i].event.id && OldMap.slotId == NewData[i].slotId){
            NewMaps.push(NewData[i]);
        };

        i++;
    })).then(async (Next) => {
        if(NewMaps.length == 0) return;
        let BrawlifyMapData = [];

        Promise.all(NewMaps.map(async (NewMap) => {
            const Map = await Axios({
                url: `https://api.brawlapi.com/v1/maps/${NewMap.event.id}`
            });

            if(Map.status != 200) return;

            BrawlifyMapData.push(Map.data);
        })).then(async (Response) => {
            await CreateMessages(BrawlifyMapData, NewMaps);
        });
        
    });

    //Writes the new map data locally, so when changes happen, it will notice.
    fs.writeFileSync('response.json', JSON.stringify(Response.data, null, 4));
};

//Creates the Twitter Messages.
async function CreateMessages(BrawlifyMapData, NewMaps){
    const Response = await Axios({
        url: "https://bsproxy.royaleapi.dev/v1/brawlers",
        headers: {
            'Authorization': `Bearer ${Configuration.BrawlStarsToken}`
        }
    }).catch((Error) => {
        console.log(Error.response.data);
    });

    let i = 0;

    Promise.all(BrawlifyMapData.map(async (Map) => {
        const FirstBest = Map.stats[0]; //{ brawler: 16000065, winRate: 67.4, useRate: 2.8 };
        const SecondBest = Map.stats[1];
        const ThirdBest = Map.stats[2];


        const FirstBrawler = `1️⃣ - ${Response.data.items.filter(m => m.id == FirstBest.brawler)[0].name} (Win Rate: ${FirstBest.winRate}% | Use Rate: ${FirstBest.useRate}%)\n`;
        const SecondBrawler = `2️⃣ - ${Response.data.items.filter(m => m.id == SecondBest.brawler)[0].name} (Win Rate: ${SecondBest.winRate}% | Use Rate: ${SecondBest.useRate}%)\n`;
        const ThirdBrawler = `3️⃣ - ${Response.data.items.filter(m => m.id == ThirdBest.brawler)[0].name} (Win Rate: ${ThirdBest.winRate}% | Use Rate: ${ThirdBest.useRate}%)\n`;
        const BestBrawlers = `Best Brawlers:\n${FirstBrawler}${SecondBrawler}${ThirdBrawler}`;

        const Message = `⏰ New Map! ${Map.name} is now in rotation. Play it now!\n\n🎪 Mode: ${Map.gameMode.name}\n\n${BestBrawlers}\n🔗 Link: ${Map.link}`;

        await TweetNewMap(Message);
    }));
};


async function TweetNewMap(Message) {
    // Post the message to Twitter.
    T.post('statuses/update', { status: Message }, (err, data, response) => {
        if (err) {
            console.log('Error:', err);
        } else {
            console.log(`Tweeted: ${Message}`);
        };
    });
};

;(async() => {
    //When it starts for the first time.
    await CheckUpdates();
    console.log(`[SERVER] | Checking for updates! ${new Date().toLocaleTimeString()}`);

    //Checks every 5 minutes.
    setInterval(async () => {
        await CheckUpdates();
        console.log(`[SERVER] | Checking for updates! ${new Date().toLocaleTimeString()}`);
    }, 5 * 60 * 1000);
})();