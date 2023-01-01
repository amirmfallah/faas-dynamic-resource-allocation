const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");
const fnURL = "http://localhost:31112/function/qrcode-go";
const outputPath = "./log.csv";

const maxInvocationPerMin = 9;
const minInvocationPerMin = 1;

async function invokeFunction() {
  var dataString =
    "aaaLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Sagittis aliquam malesuada bibendum arcu vitae elementum curabitur. Ultrices neque ornare aenean euismod elementum nisi quis. Quis vel eros donec ac. Pretium viverra suspendisse potenti nullam ac. Scelerisque eleifend donec pretium vulputate sapien nec. Feugiat pretium nibh ipsum consequat nisl vel pretium lectus quam. Malesuada bibendum arcu vitae elementum curabitur vitae nunc sed. Neque sodales ut etiam sit amet nisl purus in mollis. Arcu dictum varius duis at consectetur lorem donec massa. Ut tristique et egestas quis ipsum suspendisse ultrices. Ac turpis egestas maecenas pharetra. Commodo elit at imperdiet dui accumsan sit. Tincidunt arcu non sodales neque sodales ut etiam. Vulputate eu scelerisque felis imperdiet proin.aaaLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Sagittis aliquam malesuada bibendum arcu vitae elementum curabitur. Ultrices neque ornare aenean euismod elementum nisi quis. Quis vel eros donec ac. Pretium viverra suspendisse potenti nullam ac. Scelerisque eleifend donec pretium vulputate sapien nec. Feugiat pretium nibh ipsum consequat nisl vel pretium lectus quam. Malesuada bibendum arcu vitae elementum curabitur vitae nunc sed. Neque sodales ut etiam sit amet nisl purus in mollis. Arcu dictum varius duis at consectetur lorem donec massa. Ut tristique et egestas quis ipsum suspendisse ultrices. Ac turpis egestas maecenas pharetra. Commodo elit at imperdiet dui accumsan sit. Tincidunt arcu non sodales neque sodales ut etiam. Vulputate eu scelerisque felis imperdiet proin.aaaLorem ips";

  return await axios.post(fnURL, dataString);
}

function getRandomInt() {
  return Math.floor(Math.random() * maxInvocationPerMin) + minInvocationPerMin;
}

// creating a cronjob to run every minute
cron.schedule("* * * * *", async () => {
  const invocationCount = getRandomInt();
  for (let i = 0; i < invocationCount; i++) {
    const timestamp = Date.now();

    // create a record of function call
    fs.appendFileSync(outputPath, `${timestamp}\n`);
    console.log(
      `Function "${fnURL.split("/").pop()}" called @ ${Date(
        timestamp
      )} - ${timestamp}.`
    );
    await invokeFunction();
  }
});
