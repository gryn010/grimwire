// Users.js
// ========
// kai's default userlist renderer

importScripts('linkjs-ext/responder.js');
importScripts('linkjs-ext/router.js');
app.onHttpRequest(function(request, response) {
  Link.router(request).mpa('get', '/', /html/, function() {
    Link.responder(response).ok('html').end('users list');
  }).error(response);
});
app.postMessage('loaded');