var app = require('koa')();
var router = require('koa-router')();
var request = require('request');
var unzip = require('unzip');
var ORIGIN = 'http://flibusta.is';
var SITE_URL = process.env.NODE_ENV === 'production' ?
	'http://flibusta-api.herokuapp.com' :
	'http://127.0.0.1:3000';

router.get('/search', search);
router.get('/download/:id/:format', download);
router.get('/info', getBookInfo);
app.use(router.routes());
app.listen(process.env.PORT || 3000);

function get(url) {
	return cb => request(url, function (err, _, body) {
		cb(err, body);
	});
}
function getUnzip(url, format) {
	return cb => {
		request(url)
			.on('error', cb)
			.pipe(unzip.Parse())
			.on('error', cb)
			.on('entry', entry => {
				var ext = entry.path.split('.').pop();
				var chunks = [];
				if (entry.type === 'File' && ext === format) {
					cb(null, entry);
				} else {
					entry.autodrain();
				}
			});
	}
}

function* search() {
	var formats = ['mobi', 'fb2', 'epub', 'txt'];
	var raw_page = yield get(`${ORIGIN}/booksearch?ask=${encodeURIComponent(this.query.name)}`);
	var page = strip(raw_page);
	var re = /<a href="(\/b\/([^"]+))">([^<]+)<\/a>/gi;
	var results = [], match, pages, url, bookId;

	while((match = re.exec(page))) {
		url = ORIGIN + match[1];
		bookId = match[2];
		results.push({
			url, bookId,
			links: formats.map(format => ({
				format,
				url: url + '/' + format,
				downloadUrl: SITE_URL + '/download/' + bookId + '/' + format
			})),
			name: match[3],
		});
	}

	this.body = results;
}

function* getBookInfo() {
	let raw_page = yield get(`${ORIGIN}/b/${encodeURIComponent(this.query.id)}`);
	let page = strip(raw_page);
	let result = {};

	console.log(page)

	// Weird Match :)
	result['cover'] = ORIGIN + page
		.match(/src="\/i\/[0-9]+\/[0-9]+\/[a-zA-Z0-9.]+"/g)[0]
		.replace('src="', "")
		.split("")
		.reverse()
		.join("")
		.replace('"', "")
		.split("")
		.reverse()
		.join("");

	result['pages'] = Number.parseInt(page
		.match(/<span style=size>[a-zA-Z0-9., ]+/g)[0]
		.replace(/<span style=size>[0-9A-Za-z]+,/g, '')
		.trim());

	this.body = result;
}

function* download(ctx, next) {
	var url = `${ORIGIN}/b/${this.params.id}/${this.params.format}`;
	if (this.params.format === 'mobi') {
		this.body = request(url);
		return;
	}
	var entry;
	try {
		entry = yield getUnzip(url, this.params.format);
	} catch (e) {
		return next(e);
	}
	this.set('Content-Disposition', `attachment; filename=${entry.path}`);
	this.set('Content-Type', 'application/octet-stream; charset=utf-8');
	this.body = entry;
}

function strip(html)
{
	// Remove unnecessary HTML tags in book link
	html = html.replace(/<b>/g, "");
	html = html.replace(/<\/b>/g, "");
	html = html.replace(/<span style="background-color: #[a-zA-Z0-9]+">/g, "");
	html = html.replace(/<\/span>/g, "");
	// Remove the sidebar, because there are unnecessary links
	html = html.replace(/<div id="sidebar-right" class="sidebar">[^]+<\/div>/g, "");
	return html;
}
