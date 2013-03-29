// SidenavServer
// ============
// serves HTML for navigation

function SidenavServer(configService) {
	Environment.Server.call(this);
	this.sidenavBroadcast = Link.broadcaster();
	this.serversConfigItem = configService.collection('values').item('servers');

	var self = this;
	this.serversConfigItem.resolve()
		.then(function(url) {
			var serversConfigUpdates = Link.subscribe(url);
			serversConfigUpdates.on('update', function(e) {
				self.sidenavBroadcast.emit('update');
			});
		});
}
SidenavServer.prototype = Object.create(Environment.Server.prototype);

// request router
SidenavServer.prototype.handleHttpRequest = function(request, response) {
	var self = this;
	var router = Link.router(request);
	router.pma('/', /GET/i, /html/, this.handler('getInterface', request, response));
	router.pma('/', /GET/i, /event-stream/, this.handler('getEventStream', request, response));
	router.error(response);
};

SidenavServer.prototype.handler = function(handlerName, request, response) {
	var self = this;
	var handler = this[handlerName];
	return function(match) { handler.call(self, request, response, match); };
};

function addLI(url, label, activeUrl) {
	return [
		'<li ', (url == activeUrl) ? 'class="active"' : '', '>',
			'<a href="',url,'" target="content">',label,'</a>',
		'</li>'
	].join('');
}

SidenavServer.prototype.getInterface = function(request, response) {
	Link.responder(response).pipe(
		this.serversConfigItem.getJson(),
		function(headers) {
			headers['content-type'] = 'text/html';
			return headers;
		},
		function(body) {
			if (body && typeof body == 'object') {
				var activeUrl = request.query.active || body.feed;
				var ul = [
					'<input type="hidden" name="active" value="',activeUrl,'" />',
					'<ul class="nav nav-pills nav-stacked">',
						addLI(body.feed, 'Feed', activeUrl),
						addLI('httpl://servers.env', 'Local Servers', activeUrl),
						addLI('httpl://config.env', 'Config', activeUrl),
					'</ul>'
				].join('');
				if (request.query.output == 'ul')
					return ul;
				return [
				'<form action="httpl://sidenav.env">',
					'<output name="ul">',
						ul,
					'</output>',
				'</form>'
				].join('');
			}
			return 'Error: server config would not load';
		}
	);
};

SidenavServer.prototype.getEventStream = function(request, response) {
	Link.responder(response).ok('event-stream');
	this.sidenavBroadcast.addStream(response);
};