var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var r = require('rethinkdb');

var dataTypes = [];
var connection = null;

r.connect({
  host: 'localhost',
  port: 28015,
  db: 'unrInt'
}, function (err, conn) {
  if (err) throw err;
  connection = conn;
})


dataTypes.push({
  name: 'silence',
  table: 'silences',
  plucks: ['start', 'end', 'attention'],
  order: 'start'
});

dataTypes.push({
  name: 'shot',
  table: 'shots',
  plucks: ['boundary'],
  order: 'timestamp'
});

function dtByName(name) {
  for (var dt of dataTypes) {
    if (dt.name === name) {
      return dt;
    }
  }
  console.log('no type for ' + name);
  return false;
}

http.listen(3000, function () {
  console.log('listening on *:3000');
});

io.on('connection', function (socket) {
  address = socket.handshake.address;

  socket.on('subscribe', function (msg) {
    var room = msg.name;
    hearing = msg.hearing;
    console.log('joining room', room);
    console.log(hearing + " !!!!! ");
    var type = dtByName(room);
    socket.join(room);
    r.table(type.table).orderBy(type.order).filter({
      'hearing': hearing
    }).pluck(type.plucks).run(connection).then(function (cursor) {
      return cursor.toArray();
    }).then(function (results) {
      console.log('sending ' + results.length + ' ' + type.name + ' things');
      response = {
        type: type.name,
        data: results
      };
      socket.emit('toDate', response);
    }).error(function (err) {
      console.log("errrrrr" + err)
    });

    r.table(type.table).filter({
      hearing: hearing
    }).pluck(type.plucks).changes().run(connection).then(function (cursor) {
      cursor.each(function (err, row) {
        if (row.new_val) {
          console.log("woo, got a " + type.name);
          socket.emit(type.name, row.new_val);
          console.log('emitted');
        } else {
          console.log("unwoo");
        }

      });
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
      if (!hearing && !msg.hearing) {
        console.log("WTF NO HEARING");
        return false;
      } else {
        msg.hearing = msg.hearing || hearing;
        hearing = msg.hearing; //KLUDGE
        console.log(hearing);
      }
      if (id) {
        msg.interrogator = id;
      }
      console.log(msg);
      type = dtByName(msg.type);
      msg.timestamp = new Date();
      console.log(JSON.stringify(msg, undefined, 2));
      r.table(type.table).insert(msg).run(connection).then(function (thing) {
        console.log('got a ' + type.name)
        console.log(thing);

      });


    },
    function (wat) {
      console.log("something failed")




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