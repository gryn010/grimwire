var $layoutContainerEl = $('#layout');
var $topbarAppsEl = $('#grim-topbar-apps');
if ($layoutContainerEl.length === 0) throw "#layout element not found";
if ($topbarAppsEl.length === 0) throw "#grim-topbar-apps element not found";
var layoutRegion = local.env.addClientRegion('layout');

// request wrapper
// -
local.env.config.workerBootstrapUrl = 'worker.min.js';
local.env.setDispatchWrapper(function(request, origin, dispatch) {
	// allow request
	var response = dispatch(request);
	response.then(
		function(res) { console.log(res.status, request.method, request.url); },
		function(res) { console.log(res.status, request.method, request.url); }
	);
	return response;
});


// client post-processor
// -
local.env.setRegionPostProcessor(function(el) {
	lifespanPostProcess(el);
	layoutPostProcess(el);
});


// environment services
// -
var hosts = {
	storage: local.http.navigator('httpl://storage.env'),
	config:  local.http.navigator('httpl://config.env')
	// workers: local.http.navigator('httpl://workers.env')
};
var storageServer = new StorageServer(sessionStorage);
var configServer = new ConfigServer(hosts.storage);
// var workerServer = new ReflectorServer(hosts.config);
local.env.addServer('storage.env', storageServer);
local.env.addServer('config.env', configServer);
// local.env.addServer('workers.env', workerServer);


// environment event handlers
// -
(function() {
	var appConfigsCollection = hosts.config.collection('apps');

	appConfigsCollection.subscribe().succeed(function(apps) {
		apps.on('update', function(e) {
			renderTopbarApps(e.data);
			highlightActiveApp(configServer.activeAppId);
		});
	});

	appConfigsCollection.item('.active').subscribe().succeed(function(activeApp) {
		activeApp.on('update', function(e) {
			var config = e.data;
			document.title = (config.title || 'Untitled Application') + ' - Grimwire';
			highlightActiveApp(config.id);
			layoutRegion.dispatchRequest(config.startpage);
		});
	});
})();


// host config load
// -
configServer.loadFromHost()
	.succeed(function(appCfgs) {
		// open the apps
		var opens = [];
		for (var appId in appCfgs)
			configServer.openApp(appCfgs[appId]);

		// set active app by hash
		configServer.setActiveApp(window.location.hash.slice(1));
	});


// UI renderers
// -
function renderTopbarApps(appCfgs) {
	var html = [];
	for (var id in appCfgs) {
		html.push('<li><a href="#',id,'"><i class="icon-',(appCfgs[id].icon || 'folder-close'),'"></i> ',appCfgs[id].title,'</a></li>');
		html.push('<li class="divider-vertical"></li>');
	}
	$topbarAppsEl.html(html.join(''));
}
function highlightActiveApp(appId) {
	$('.active', $topbarAppsEl).removeClass('active');
	$('[href="#'+appId+'"]').parent().addClass('active');
}
var __temp_counter = 100;
function layoutPostProcess(el) {
	$('[data-grim-layout]', el).each(function(i, region) {
		var params = region.dataset.grimLayout.split(' ');
		if (params[1]) {
			var div = document.createElement('div');
			div.id = __temp_counter++;
			region.appendChild(div);
			local.env.addClientRegion(div.id).dispatchRequest(params[1]);
		}
	});
}
/*function renderLayout(layoutCfg) {
	var regionUrls=[], nRegions=0;

	// build html
	var html = [];
	layoutCfg.forEach(function(rowCfg) {
		if (!Array.isArray(rowCfg)) rowCfg = [rowCfg];
		html.push('<div class="row">');
		rowCfg.forEach(function(columnCfg) {
			if (!columnCfg.width) return console.warn('Invalid layout config: `width` is required', columnCfg);
			html.push(
				'<div class="span{{width}}" {{id}}>'
					.replace('{{width}}', columnCfg.width)
					.replace('{{id}}', (columnCfg.id) ? 'id="'+columnCfg.id+'"' : '')
			);
			if (columnCfg.regions) {
				if (!Array.isArray(columnCfg.regions)) columnCfg.regions = [columnCfg.regions];
				columnCfg.regions.forEach(function(url) {
					regionUrls.push(url);
					html.push('<div class="client-region" id="client-region-'+(nRegions++)+'"></div>');
				});
			}
			html.push('</div>');
		});
		html.push('</div>');
	});

	// replace all client regions
	$('.client-region', $layoutContainerEl).forEach(function($el) {
		local.env.removeClientRegion($el.id);
	});
	$layoutContainerEl.html(html.join(''));
	regionUrls.forEach(function(url, i) {
		local.env.addClientRegion('client-region-'+i).dispatchRequest(url);
	});
}*/


// UI behaviors
// -
$topbarAppsEl.click(function(e) {
	configServer.setActiveApp($(e.target).getAttribute('href').slice(1));
});