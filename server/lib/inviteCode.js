const crypto = require('crypto');

function generateInviteCode(length = 8) {
  return crypto.randomBytes(length).toString('base64url').replace(/[-_]/g, 'X').slice(0, length);
}

module.exports = { generateInviteCode };
