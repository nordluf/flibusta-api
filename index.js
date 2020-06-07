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

/*
*
* Path: http://your.path/info?id=<book_id>
*
* Returns the view object:
*	{
*		"title": String,
*		"cover": String (URL on Image),
*		"pages": Int,
*		"authors": [
*			String
*		],
*		"genre": String,
*		"added": String (UTC Format)
*	}
*
* */

function* getBookInfo() {
	let raw_page = yield get(`${ORIGIN}/b/${encodeURIComponent(this.query.id)}`);
	let page = strip(raw_page);
	let result = {};

	result['title'] = page
		.match(/<h1 class="title">[a-zA-Zа-яА-ЯёЁ0-9!$%^&*()_+|~=`{}\[\]:";'<>?,.\/ ]+<\/h1>/g)[0]
		.replace(/<h1 class="title">/g, '')
		.replace(/<\/h1>/g, '')
		.replace(/(\(fb2\)|\(epub\)|\(mobi\))/, '')
		.trim();

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

	result['authors'] = [];

	page.match(/<a href="\/a\/[0-9]+">[a-zA-Zа-яА-ЯёЁ .]+<\/a>/g).forEach(raw_author => {
		let author = raw_author
			.replace(/<a href="\/a\/[0-9]+">/, '')
			.replace(/<\/a>/, '');

		if (author != 'Автор Неизвестен') {
			return result['authors'].push(author)
		}
	});

	result['genre'] = page
		.match(/<a href="\/g\/[0-9]+" class="genre" name="[a-zA-Z0-9_]+">[a-zA-Zа-яА-ЯёЁ .]+<\/a>/g)[0]
		.replace(/<a href="\/g\/[0-9]+" class="genre" name="[a-zA-Z0-9_]+">/, '')
		.replace(/<\/a>/, '');

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
	let numbers = date.split('.');
	let correct = [];

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
