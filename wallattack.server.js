var app = require('http').createServer(handler),
	io = require('socket.io').listen(app),
	url = require('url'),
	fs = require('fs'),
	sys= require('sys'),
	mongo = require('mongodb');

// MongoDB staff
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT
sys.puts("Connecting to " + host + ":" + port);
var db = new mongo.Db('wallattack', new mongo.Server(host, port, {}), {});

db.open(function(err, db) {
	sys.puts("Connected to Mongo! [err=" + err+"]");
});
// ~ mongodb

var users = {};
var labyrsArr = [];
var labyr = new Array();

for( var i=0; i<28; i++ )
	labyr[i] = new Array();
	
// Load walls
var mapFiles = fs.readdirSync("./maps");
for(var i in mapFiles) {
	var data = fs.readFileSync("./maps/"+mapFiles[i], "utf-8");
	labyrsArr.push(data);
}
	
app.listen(8002);

var iter=27;
var labyrsCount = labyrsArr.length-1;

var interval = setInterval( function()
{
	if( labyrsCount < 0 ) labyrsCount = labyrsArr.length-1;
	
	if( iter==27 )
		labyr = eval( labyrsArr[labyrsCount--] );
		
	io.sockets.emit("labyr-move", {line: labyr[iter--] });
	if( iter<0 ) iter = 27;

}, 500 );

var intervalToplist = setInterval( function()
{
	var users = [];
	db.collection('wallattack.ratings', function(err, collection)
	{
		var g = collection.find({}).sort('rating', -1).limit(5).toArray(function(err, docs)
		{
			for( var i in docs ) {
				users.push(docs[i]);
			}

			io.sockets.emit("update-toplist", {users:users});
		});
	});
			
}, 7000);

function handler (req, res) 
{
	var file = (url.parse(req.url).pathname == "/") ? "/index.html" : url.parse(req.url).pathname;
	
	fs.readFile(__dirname + file,
				function (err, data) {
					res.writeHead(200);
					res.end(data);
				});
}

io.configure(function () 
{
	io.set('transports', ['websocket', 'flashsocket', 'xhr-polling']);
	io.set('log level', 1); // reduce logging
});

io.sockets.on('connection', function (socket) {

	socket.emit('total-users', {total : Object.keys(users).length+1, users:users});
	users[socket.id] = {sockid:socket.id, rating:0};

	socket.on('dot-created', function (data)
	{
		if( data!=undefined ) 
		{
			users[socket.id].rating = data.rating!=undefined ? parseInt(data.rating) : 0;
				
			//if( data.rating > 0 )// revived
			//	users[socket.id].rating -= 30;
			
			updateDbRating(users[socket.id].username, socket.id, users[socket.id].rating);
		}
			
		socket.broadcast.emit('some-dot-created', {id:socket.id, total:Object.keys(users).length});
	});
	
	socket.on('im-out', function(data)
	{
		users[socket.id].rating -= 30;
		updateDbRating(users[socket.id].username, socket.id, users[socket.id].rating);
		socket.broadcast.emit('some-dot-out', {id:socket.id});
	});
	
	socket.on('update-username', function(data)
	{
		if( data.username=="" || data.password=="" ) {
			socket.emit("username-err", {"username":data.username});
			return;
		}
		
		db.collection('wallattack.ratings', function(err, collection)
		{
			collection.findOne({"username":data.username}, function(err, docs)
			{
				if( docs==null )
				{
					collection.remove({"id":socket.id});
					collection.insert({"id":socket.id, "username":data.username, "password":data.password, "rating":users[socket.id].rating});
					users[socket.id].username = data.username;
					socket.emit("username-ok", {"username":data.username});
				}
				else 
				{
					users[socket.id].username = data.username;
					users[socket.id].rating = docs.rating;
					
					if( docs.password == data.password )
						socket.emit("username-ok", {"username":data.username, "rating":docs.rating});
					else
						socket.emit("username-err", {"username":data.username});
				}
					
			});
		});
	});
	
	socket.on('dot-moved', function(data) 
	{
		users[socket.id].x = data.x;
		users[socket.id].y = data.y;
		users[socket.id].rating++;
		
		socket.broadcast.emit('some-dot-moved', {id:socket.id, x:data.x, y:data.y, rating:users[socket.id].rating});
		updateDbRating(users[socket.id].username, socket.id, users[socket.id].rating);
	});
  
	socket.on('disconnect', function(data){
		socket.broadcast.emit('dot-leaved', {id:socket.id, total:Object.keys(users).length-1});
		delete users[socket.id];
	});
});

function updateDbRating(username, socketId, rating)
{
	db.collection('wallattack.ratings', function(err, collection)
	{
		collection.update({"username":username}, 
						  {"$set":{"id":socketId, "username":username, "rating":rating}},{upsert:true},
			function(error, result){}
		);
	});
}

