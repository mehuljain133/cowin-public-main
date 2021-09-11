const config = require('./config.json');
const {
  sendToSlack,
  getSlotsForAge,
  fetch,
  watch,
  reauthorize,
} = require('./utils');

function reschedule(slot, overrideCount = false) {
  const session = slot.sessions.find(
    (session) => session.available_capacity >= (overrideCount ? 0 : 2)
  );

  return fetch(config.cowin.reschedule, {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      appointment_id: config.appointment_id,
      session_id: session.session_id,
      slot: session.slots[0],
    }),
    method: 'POST',
  })
    .then((res) => {
      if (res.status === 401) {
        console.log('Time to reauthorize');

        // Get new auth token
        reauthorize();

        return null;
      }

      return res.json();
    })
    .then((response) => {
      if (!response) {
        return false;
      }

      sendToSlack(response);

      return true;
    });
}

function check() {
  return fetch(config.cowin.search)
    .then((res) => res.json())
    .then((response) => {
      return reschedule(response.centers[0], true).then(() => {
        const slotsForAge = getSlotsForAge(response);

        if (slotsForAge.length) {
          let slot;

          if (config.covaxin) {
            slot = slotsForAge[0];
          } else {
            slot = slotsForAge.find(
              (slot) => !slot.vaccines.toLowerCase().includes('Covaxin')
            );
          }

          if (!slot) {
            return false;
          }

          return reschedule(slot);
        } else {
          return false;
        }
      });
    })
    .catch((error) => {
      console.error(error);

      sendToSlack('Script errored!', error);

      return true;
    });
}

watch(check);
