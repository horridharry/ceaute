created /account/settings with AccountSettingsPage as components should be shell-based, not role-based.
Idally, I want to add a redirect in next.config.js witht he following: // next.config.js
module.exports = {
async redirects() {
return [
{ source: '/account', destination: '/account/settings', permanent: true },
];
},
};

last worke don this 15:03
u need to run the prompt ingpt when usage comes back up
