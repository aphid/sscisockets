var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var r = require('rethinkdb');

var argyle = {};



r.connect().then(function (conn) {



});


app.get('/', function (req, res) {
  res.send('<h1>Hello world</h1>');
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});



io.on('connection', function (socket) {
  //var address, table, plucks;
  var referer = socket.request.headers.referer;
  if (referer.includes('sound') || referer.includes('hearing')) {
    argyle.name = 'quiet';
    argyle.table = 'silences';
    argyle.plucks = ['start', 'end', 'attention'];
    argyle.order = 'start';
  } else if (referer.includes('shot')) {
    argyle.name = 'shot';
    argyle.table = 'shots';
    argyle.plucks = ['boundaries'];
    argyle.order = 'timestamp';
  }

  r.connect().then(function (conn) {
    address = socket.handshake.address;

    r.db('unrInt').table(argyle.table).changes().run(conn, function (err, cursor) {
      cursor.each(function (err, row) {
        if (row.new_val) {
          console.log("woo, got a " + argyle.name);
          socket.emit(argyle.name, row.new_val);
        } else {
          console.log("unwoo");
        }

      });
    });



    r.db('unrInt').table(argyle.table).orderBy(argyle.order).pluck(argyle.plucks).run(conn).then(function (cursor) {
      return cursor.toArray();
    }).then(function (results) {


      console.log('sending ' + results.length + ' ' + argyle.name + ' things');
      io.emit('toDate', JSON.stringify(results));

    }).error(function (err) {
      console.log("errrrrr" + err)
    });



  });


  var id, hearing;
  console.log('a user connected');
  socket.on('authenticate', function (msg) {
    id = msg.interrogator;
    hearing = msg.hearing
    console.log('id: ' + id + ' from: ' + address + " analyzing: " + hearing);
  });

  socket.on('intel', function (msg) {
    r.connect().then(function (conn) {
        if (hearing) {
          msg.hearing = hearing;
        }
        if (id) {
          msg.interrogator = id;
        }
        msg.timestamp = new Date();
        console.log(JSON.stringify(msg, undefined, 2));
        r.db('unrInt').table(argyle.table).insert(msg).run(conn).then(function (thing) {
          console.log('got a ' + argyle.name)
          console.log(thing);

        });


      },
      function (wat) {
        console.log("something failed")

      }); //end r



  }); //end intel
  socket.on('disconnect', function () {
    console.log('user disconnected');
  });
});

/*
r.db('unrInt').table('silences').changes.run(conn, function (err, cursor) {
  cursor.each(console.log);

  //io.emit('change', JSON.stringify(thing));
}); */