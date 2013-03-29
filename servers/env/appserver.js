Grim = (typeof Grim == 'undefined') ? {} : Grim;
(function(exports) {

	// App Server
	// ============
	// EXPORTED
	// an isolated region of the DOM
	function AppServer(id) {
		Environment.Server.call(this);
		this.serversBroadcast = Link.broadcaster();
	}
	AppServer.prototype = Object.create(Environment.Server.prototype);

	AppServer.prototype.handleHttpRequest = function(request, response) {
		Link.router(request)
			.pma('/', /GET/i, 'text/event-stream', (function() {
				Link.responder(response).ok('text/event-stream');
				this.serversBroadcast.addStream(response);
				this.serversBroadcast.emitTo(response, 'update');
			}).bind(this))
			.pm('/', /HEAD|GET/i, $getApps.bind(this, request, response))
			.pmt('/', /POST/i, /json|form\-data|text/i, $addApp.bind(this, request, response))
			// .pm(RegExp('/[^/]+/?'), /HEAD|GET/i, $getApp.bind(this, request, response))
			// .pm(RegExp('/[^/]+/?'), /DELETE/i, $killApp.bind(this, request, response))
			.pmta(RegExp('/load-confirmer/?','i'), /POST/i, /json|form\-data/i, /html/i, $confirmAddApp.bind(this, request, response))
			.pmta(RegExp('/inspector/?','i'), /POST/i, /form\-data/i, /html/i, $inspectApp.bind(this, request, response))
			.pa(RegExp('/null/?','i'), /html/i, $null.bind(this, request, response))
			.pa(RegExp('/echo/?','i'), /html/i, $echo.bind(this, request, response))
			.pmta(RegExp('/err/?','i'), /POST/i, /json/i, /html/i, $err.bind(this, request, response))
			.error(response);
	};

	// GET|HEAD /
	function $getApps(request, response) {
		var respond = Link.responder(response);
		var router = Link.router(request);

		var apps = Environment.listFilteredServers(function(s) { return (s instanceof Environment.WorkerServer); });

		var headerer = Link.headerer();
		headerer.addLink('/', 'self current');
		Object.keys(apps).forEach(function(domain) {
			headerer.addLink('httpl://'+domain, 'service', { title:domain });
		});

		if (/get/i.test(request.method)) {
			// GET
			var self = this;
			router.a(/html/i, function() {
				respond.ok('html', headerer).end(self.renderAppsHtml(apps));
			});
			router.a(/json/i, function() {
				respond.ok('json', headerer).end(self.renderAppsJson(apps));
			});
			router.error(response, ['path','method']);
		} else {
			// HEAD
			respond.ok(null, headerer).end();
		}
	}

	function extractAddParams(request) {
		var params;
		if (/multipart\/form-data/.test(request.headers['content-type'])) {
			// an intent
			var contextLinks = request.body.parts[1].body;
			var contextData = request.body.parts[2].body;
			var contextDataType = request.body.parts[2]['content-type'];

			// pick the script origin from the best possible source
			if (/javascript/.test(contextDataType)) {
				// javascript context body
				params = { script:contextData };
			} else if (/uri-list/.test(contextDataType)) {
				// uri context body
				params = { url:contextData };
			} else if (/json|www-form-urlencoded/.test(contextDataType)) {
				// form context body
				if (contextData.text)
					params = { script:contextData.text };
				else if (contextData.script)
					params = { script:contextData.script };
				else if (contextData.url)
					params = { url:contextData.url };
			} else if (typeof contextData == 'string') {
				params = { script:contextData };
			} else {
				// context link header
				params = { url : Link.lookupLink(contextLinks, 'http://grimwire.com/rels/src', 'application') };
			}
		} else {
			if (typeof request.body == 'string')
				params = { script:request.body };
			else
				params = request.body;
		}
		return params;
	}

	// POST /
	function $addApp(request, response) {
		var self = this;
		var respond = Link.responder(response);
		var router = Link.router(request);
		var server;
		var fail = function(message) {
			if (server) server.terminate();
			return respond.badRequest('text/plain').end(message);
		};

		var params = extractAddParams(request);
		if (!params || (!params.url && !params.script)) {
			return fail('Must receive `url` or `script');
		}

		params.scriptUrl = params.url;
		delete params.url;

		var domain = params.scriptUrl.replace(/\./g, '-').split('/').reverse().join('.');
		if (Environment.getServer(domain)) {
			if (params.replace_existing) {
				Environment.killServer(domain);
			} else {
				return respond
					.seeOther('text/plain', { location: 'httpl://'+domain })
					.end('Domain \''+domain+'\' is already in use');
			}
		}

		server = new Environment.WorkerServer(params, function(result) {
			respond.unprocessableEntity().end();
		});
		Environment.addServer(domain, server);
		self.serversBroadcast.emit('update');
		if (/html/.test(request.headers.accept))
			return respond.pipe(Link.dispatch({ method:'get', url:'httpl://'+domain, headers:{ accept:'text/html' }}, this));
		respond.ok('application/json').end(server.config);
	}

	// POST /load-confirmer
	function $confirmAddApp(request, response) {
		var params = extractAddParams(request);
		if (!params || (!params.url && !params.script)) {
			return Link.responder(response).badRequest('text/html').end('Must receive `url` or `script');
		}

		Link.responder(response).ok('text/html').end([
			'<form action="httpl://app" method="post" enctype="application/json">',
				'<input type="hidden" name="replace_existing" value="1" />',
				'<legend>Would you like to load this program into the session?</legend>',
				'<p>',
					(params.url) ?
						'<input class="input-block-level" type="text" name="url" value="'+params.url+'" />' :
						'<textarea class="input-block-level" name="script">'+params.script.replace(/</g, '&lt;').replace(/>/g, '&gt;')+'</textarea>',
				'</p>',
				'<p>',
					'<a href="httpl://app/null" title="Cancel">No</a> ',
					'<input class="btn" type="submit" value="Yes" title="Do It" style="float:right" />',
				'</p>',
			'</form>'
		].join(''));
	}

	// POST /inspector
	function $inspectApp(request, response) {
		var contextLinks = request.body.parts[1].body || [];

		Link.responder(response).ok('text/html').end([
			contextLinks.map(function(link) {
				var KVs = [];
				for (var k in link) {
					if (k == 'rel') continue;
					KVs.push('<tr><td width=50><span class="muted">'+k+'</span></td><td>'+link[k]+'</td></tr>');
				}
				return [
				'<form>',
					'<input type=hidden name=url value="',link.href,'" />',
					'<h5>',link.rel,'</h5>',
					'<table class="table table-condensed">',
						KVs.join(''),
					'</table>',
				'</form>'
				].join('');
			}).join('')
		].join(''));
	}

	// /null html
	function $null(request, response) {
		Link.responder(response).ok('text/html').end('');
	}

	// /echo html
	function $echo(request, response) {
		var content = request.body;
		if (/post/i.test(request.method) && /multipart\/form\-data/.test(request.headers['content-type']))
			content = content.parts[2].body;
		if (typeof content === 'object')
			content = content.text || JSON.stringify(content);
		Link.responder(response).ok('text/html').end(content);
	}

	// POST /err html
	function $err(request, response) {
		var errRequest = request.body.request;
		var errResponse = request.body.response;
		var body = errResponse.body;
		if (body && typeof body == 'object') {
			if (body.error) {
				body = [
					'<p>"',body.error.message,'"</p>',
					'<p>',JSON.stringify(body.error.response, null, "\t").replace(/\\t/g,"&nbsp;&nbsp;"),'</p>'
				].join('');
			} else { body = JSON.stringify(body); }
		}
		Link.responder(response).ok('text/html').end([
			'<form>',
				'<input type="hidden" name="request" value="',JSON.stringify(errRequest).replace(/"/g,'&quot;'),'" />',
				'<input type="hidden" name="response" value="',JSON.stringify(errResponse).replace(/"/g,'&quot;'),'" />',
				'<div class="alert alert-error alert-block">',
					'<a class="close" href="httpl://app/null">&times;</a>',
					'<h4>',errResponse.status,' <small style="color:#b94a48">',errResponse.reason,'</small></h4>',
					'<p>',body,'</p>',
				'</div>',
			'</form>'
		].join(''));
	}

	// GET|HEAD /:app
	function $getApp(request, respond, appName) {
		Link.responder(response).notImplemented().end();
	}

	AppServer.prototype.renderAppsHtml = function(apps) {
		var renderAppItem = function(app) {
			return [
				'<li>',
					'<a target="-blank" href="httpl://', app.config.domain, '">',
						app.config.domain, '<br/><small>', app.config.scriptUrl, '</small>',
					'</a>',
				'</li>'
			].join('');
		};
		var html = [];
		for (var domain in apps)
			html.push(renderAppItem(apps[domain]));
		return [
		'<form action="httpl://app" data-output="true">',
			'<ul class="nav nav-pills pull-right">',
				'<li class="dropdown">',
					'<a class="dropdown-toggle" data-toggle="dropdown" href="javascript:void(0)">Servers</a>',
					'<ul class="dropdown-menu">',
						html.join(''),
					'</ul>',
				'</li>',
			'</ul>',
		'</form>'
		].join('');
	};

	AppServer.prototype.renderAppsJson = function(apps) {
		var data = {};
		for (var domain in apps) {
			data[domain] = JSON.parse(JSON.stringify(apps[domain].config)); // do this correctly to win a prize
		}
		return data;
	};

	exports.AppServer = AppServer;
})(Grim);