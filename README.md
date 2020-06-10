## Installation

To run this API on your computer or on your own server, you need to clone the repository and then set all dependencies:

```console
foo@bar:~$ npm install
```

After that you should run the code, you can do it by prescribing a command:

```console
foo@bar:~$ npm start
```

## Schema

You can set a specific domain in the `.env` file, which defines the environment variables, by default this:

```console
URL_DEV=localhost:5555
URL_PROD=http://flibustapi.herokuapp.com
PORT=5555
```

At the moment there are three API points available, let's walk through them in order.

The first one is responsible for the search and is registered:

```console
GET /search?name=<book title>
```

This point returns an array that has the following form:

```javascript
{
	"url": "String",
	"bookId": "String",
	"links": [
		{
			"format": "mobi",
			"url": "String",
			"downloadUrl": "String"
		},
		{
			"format": "fb2",
			"url": "String",
			"downloadUrl": "String"
		},
		{
			"format": "epub",
			"url": "String",
			"downloadUrl": "String"
		},
		{
			"format": "txt",
			"url": "String",
			"downloadUrl": "String"
		}
	],
	"name": "String"
}
```

The second point is responsible for the information about the book, is spelled out:

```console
GET /info?id=<id books>
```

This point returns an array that has the following form:

```javascript
{
	"title": "String",
	"cover": "String",
	"size": Int or null,
	"pages": Int or null,
	"authors": [
		"String"
	],
	"genres": [
		"String"
	],
	"added": "String" (UTC Format)
}
```

The third point is responsible for downloading the file, it is spelled out:

```console
GET /download/<id books>/<format name>
```

Returns a ready-made file for download.

## Example

Here's an example.

Searching for the phrase "Darth Plegas."

```console
https://flibustapi.herokuapp.com/search?name=Darth Plegas
```

Gives us back an array with one element:

```javascript
[
	{
		"url": "http://flibusta.is/b/297929",
		"bookId": "297929",
			"links": [
				{
					"format": "mobi",
					"url": "http://flibusta.is/b/297929/mobi",
					"downloadUrl": "http://flibustapi.herokuapp.com/download/297929/mobi"
				},
				{
					"format": "fb2",
					"url": "http://flibusta.is/b/297929/fb2",
					"downloadUrl": "http://flibustapi.herokuapp.com/download/297929/fb2"
				},
				{
					"format": "epub",
					"url": "http://flibusta.is/b/297929/epub",
					"downloadUrl": "http://flibustapi.herokuapp.com/download/297929/epub"
				},
				{
					"format": "txt",
					"url": "http://flibusta.is/b/297929/txt",
					"downloadUrl": "http://flibustapi.herokuapp.com/download/297929/txt"
				}
			],
		"name": "Дарт Плэгас"
	}
]
```

And the request for information about this book will give us the next line:

```javascript
{
	"title": "Дарт Плэгас",
	"cover": "http://flibusta.is/i/29/297929/cover.jpg",
	"size": 1646,
	"pages": 443,
	"authors": [
			"Джеймс Лучено"
	],
	"genres": [
			"Космическая фантастика"
	],
	"added": "Fri, 10 Feb 2012 00:00:00 GMT"
}
```

## Working API

You can already use this API by domain: flibustapi.herokuapp.com