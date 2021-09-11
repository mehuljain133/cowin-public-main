const fs = require('fs');
const fetch = require('node-fetch');
const childProcess = require('child_process');

function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

function getConfig() {
  const json = fs.readFileSync('./config.json');

  return JSON.parse(json);
}

function sendToSlack(message, ...otherParams) {
  const config = getConfig();

  if (config.verbose || !config.webhook) {
    console.log(message);
    console.dir(otherParams);
  }

  if (config.webhook) {
    return fetch(config.webhook, {
      body: JSON.stringify({
        text: message,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  }
  return;
}

function uniq(arr) {
  const s = new Set(arr);
  return Array.from(s);
}

function getSlotsForAge(res) {
  const config = getConfig();

  let centers = [];

  if (!('centers' in res)) {
    return centers;
  }

  centers = res.centers.filter((centre) => {
    return centre.sessions.some(
      (session) =>
        session.min_age_limit <= config.age && session.available_capacity > 2
    );
  });

  return centers.map((c) => {
    return {
      ...c,
      pin: c.pincode,
      vaccines:
        uniq(c.sessions.map((s) => s.vaccine).filter(Boolean)).join(' ') ||
        'Not specified',
    };
  });
}

function _fetch(url, opts = {}) {
  const config = getConfig();
  const { headers = {}, ...restOpts } = opts;

  return fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Authorization': config.auth,
      'cache-control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Pragma': 'no-cache',
      ...headers,
    },
    referrer: 'https://selfregistration.cowin.gov.in/',
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    ...restOpts,
  });
}

async function watch(fn) {
  const config = getConfig();

  while (true) {
    const d = new Date();

    console.log('Checking at', d.toLocaleTimeString());
    const changed = await fn();

    if (changed) {
      break;
    }

    // sleep
    await sleep(config.sleep);
  }
}

function reauthorize() {
  childProcess.execFileSync('node', ['get-token']);
}

module.exports = {
  sleep,
  sendToSlack,
  getSlotsForAge,
  fetch: _fetch,
  watch,
  reauthorize,
};
