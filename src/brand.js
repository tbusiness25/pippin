// The app's display name. Self-hosters can call their copy whatever they like with APP_NAME.
module.exports = { APP_NAME: (process.env.APP_NAME || 'Pippin').slice(0, 30) };
