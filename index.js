/*
* 							Warning!
*
* All information that is taken from the Flibusta site is parsed,
* so I can't guarantee that everything will work,
* but at the time of the last commit all points were available.
*
*
* */


var app = require('koa')();
var router = require('koa-router')();
var request = require('request');
var unzip = require('unzip');
var jsdom = require('jsdom');
var { JSDOM } = jsdom;
var ORIGIN = 'http://flibusta.is';
var SITE_URL = process.env.NODE_ENV === 'production' ?
	'http://flibustapi.herokuapp.com' :
	'http://127.0.0.1:4000';

router.get('/search', search);
router.get('/download/:id/:format', download);
router.get('/info', getBookInfo);
app.use(router.routes());
app.listen(process.env.PORT || 4000);

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

/*
*
* Path: http://your.path/info?id=<book_id>
*
* Returns the view object:
*	{
*		"title": String,
*		"cover": String (URL on Image),
* 		"size": Int (In KB)
*		"pages": Int,
*		"authors": [
*			String
*		],
*		"genres": [
*			String
*		],,
*		"added": String (UTC Format)
*	}
*
* */

function* getBookInfo() {
	var raw_page = yield get(`${ORIGIN}/b/${encodeURIComponent(this.query.id)}`);
	var page = strip(raw_page);
	var { document } = new JSDOM(raw_page).window;
	var result = {};

	result['title'] = document.querySelector("h1.title").textContent
		.replace(/(\(fb2\)|\(epub\)|\(mobi\))/, '')
		.trim();

	var cover = document.querySelector('img[title="Cover image"]') != null ? ORIGIN + document.querySelector('img[title="Cover image"]').getAttribute('src') : "shorturl.at/bfoxU";
	result['cover'] = cover;

	var sizeLength = document.querySelector('span[style*="size"]').textContent.split(',');
	result['size'] = sizeLength[0].replace('K', '')*1;
	result['pages'] = sizeLength[1].replace('с.', '').trim()*1;

	result['authors'] = [];
	page.match(/<a href="\/a\/[0-9]+">[a-zA-Zа-яА-ЯёЁ .]+<\/a>/g).forEach(raw_author => {
		var author = raw_author
			.replace(/<a href="\/a\/[0-9]+">/, '')
			.replace(/<\/a>/, '');

		if (author != 'Автор Неизвестен') {
			return result['authors'].push(author)
		}
	});

	var genres = [];
	document.querySelectorAll('a.genre').forEach(genre => {if (genre.textContent != undefined) genres.push(genre.textContent)});
	result['genres'] = genres;

	result['added'] = new Date(toCorrectDate(page
		.match(/Добавлена: [0-9]+.[0-9]+.[0-9]+/g)[0]
		.replace(/Добавлена:/g, '')
		.trim())).toUTCString();

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

function toCorrectDate(date) {
	var numbers = date.split('.');
	var correct = [];

	if (numbers[0] > 12) {
		correct.push(numbers[1]);
		correct.push(numbers[0]);
		correct.push(numbers[2]);
	} else {
		correct = numbers;
	}

	return correct.join('.');
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
