// :DEBUG:
// =======

$('.sigils i').on('click', function(e) {
	$(e.target).toggleClass('charged');
});


// Center Space
// ============
// :TODO: move into Grim.*
var centerElem = document.getElementById('center');
centerElem.addEventListener('drop', function(e) {

	var elem = document.createElement('div');
	elem.id = Grim.genClientRegionId();
	elem.className = "client-region";
	centerElem.appendChild(elem);

	var region = Environment.addClientRegion(new Grim.ClientRegion(elem.id));
	region.__handleDrop(e);
});
centerElem.addEventListener('dragover',  function(e) {
	if (e.dataTransfer.types.indexOf('application/request+json') !== -1) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'link';
		return false;
	} else if (e.dataTransfer.types.indexOf('text/uri-list') !== -1) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'link';
		return false;
	}
});
centerElem.addEventListener('dragenter', function(e) {
	if (e.target == centerElem) {
		if (e.dataTransfer.types.indexOf('application/request+json') !== -1)
			centerElem.classList.add('drophover');
		else if (e.dataTransfer.types.indexOf('text/uri-list') !== -1)
			centerElem.classList.add('drophover');
	}
});
centerElem.addEventListener('dragleave', function(e) {
	if (e.target == centerElem)
		centerElem.classList.remove('drophover');
});
centerElem.addEventListener('dragend', function(e) {
	centerElem.classList.remove('drophover');
});


// Definitions
// ===========

Environment.config.workerBootstrapUrl = '/local/lib/worker_bootstrap.js';

// helpers
function logError(err, request) {
	console.log(err.message, request);
	return err;
}

// request wrapper
Environment.setDispatchHandler(function(origin, request) {
	// make any connectivity / permissions decisions here
	// var urld = Link.parseUri(request);

	// add the credentials, if targetting our host and currently logged in
	// if (Environment.user && /https?/i.test(urld.protocol) && /linkapjs\.com$/i.test(urld.host)) {
	//	request.headers = Link.headerer(request.headers).setAuth(Environment.user);
	// }

	// allow request
	var response = Link.dispatch(request);
	response.except(logError, request);
	return response;
});

// dom update post-processor
Environment.setRegionPostProcessor(function(elem) {
	// addPersonaCtrls(elem);
});



// Init
// ====

// instantiate environment servers
// var personaServer = new PersonaServer();
// Environment.addServer('user.env', personaServer);

// instantiate apps
Environment.addServer('targets.app', new Environment.WorkerServer({
	scriptUrl : '/grim/apps/debug/targets.js'
}));
Environment.addServer('forms.app', new Environment.WorkerServer({
	scriptUrl : '/grim/apps/debug/forms.js'
}));

// load client regions
Environment.addClientRegion(new Grim.ClientRegion('app-targets')).dispatchRequest('httpl://targets.app');
Environment.addClientRegion(new Grim.ClientRegion('app-forms')).dispatchRequest('httpl://forms.app');