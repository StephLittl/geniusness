// Today's date in Eastern time zone (YYYY-MM-DD)
function getEasternDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

module.exports = { getEasternDate };
