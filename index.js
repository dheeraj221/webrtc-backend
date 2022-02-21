const socket = require("socket.io");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 4000;
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => callback(null, true),
  })
);

const channels = [
  { name: "test", password: "test" },
  { name: "dragon-tiger", password: "test" },
  { name: "sic-bo", password: "test" },
];

let activeChannels = new Set([]);

const server = app.listen(PORT, () => {
  console.log(`Server starts listening at Port ${PORT}`);
});

const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
  },
});

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With, content-type, Authorization, Content-Type"
  );
  // Set to true if you need the website to include cookies in the requests sent to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);
  // Pass to next layer of middleware
  next();
});

app.get("/active-channels", (req, res) => {
  const result = Array.from(activeChannels).map((item) => ({
    name: item.charAt(0).toUpperCase() + item.slice(1),
    value: item,
  }));
  res.json(result);
});

io.on("connection", (socket) => {
  console.log("Web socket connected", socket.id);

  // logic to create room for broadcaster
  socket.on("create_room", ({ roomName, password }) => {
    // console.log(roomName, password);
    const rooms = io.sockets.adapter.rooms;
    const roomAlreadyExist = rooms.get(roomName);
    const validCredentials =
      channels.find((channel) => channel.name === roomName)?.password ===
      password;

    if (validCredentials) {
      if (roomAlreadyExist) {
        socket.emit("broadcast_conflict");
      } else {
        socket.join(roomName);
        activeChannels.add(roomName);
        socket.emit("room_created", roomName);
        socket.emit("total_users_in_room", {
          roomName,
          totalActiveUsers: io.sockets.adapter.rooms.get(roomName)?.size || 0,
        });
        console.log(
          "Room Name: ",
          roomName,
          "| All Users : ",
          io.sockets.adapter.rooms.get(roomName)
        );
      }
    } else {
      socket.emit("wrong_password");
    }
  });

  // logic to join room for viewer
  socket.on("join_room", (roomName) => {
    // console.log(roomName)
    const rooms = io.sockets.adapter.rooms;
    console.log(rooms);
    const roomAlreadyExist = rooms.get(roomName);
    // console.log("Rooms for joining viewer ==> ", rooms, roomAlreadyExist);
    if (roomAlreadyExist) {
      const rooms = io.sockets.adapter.rooms;
      socket.join(roomName);
      socket.emit("room_joined", roomName);
      socket.broadcast.to(roomName).emit("total_users_in_room", {
        roomName,
        totalActiveUsers: io.sockets.adapter.rooms.get(roomName)?.size || 0,
      });
      console.log(
        "Room Name: ",
        roomName,
        "| All Users : ",
        rooms.get(roomName)
      );
    } else {
      socket.emit("room_not_exist", roomName);
      console.log("<==== ERROR: Room not exist  ====>", roomName);
    }
  });

  // logic to inform room creator someone joins your room
  socket.on("ready", (roomName) => {
    // console.log('id at ready sent',socket.id)
    socket.broadcast.to(roomName).emit("ready", roomName, socket.id);
  });

  // logic to exchnage ICE candidates to establish connection
  socket.on("candidate", (candidate, roomName) => {
    // console.log(candidate)
    socket.broadcast.to(roomName).emit("candidate", candidate, socket.id);
  });

  // logic to make an offer
  socket.on("offer", (offer, roomName) => {
    socket.broadcast.to(roomName).emit("offer", offer, socket.id);
  });

  // logic to make an answer
  socket.on("answer", (answer, roomName) => {
    // console.log(answer)
    socket.broadcast.to(roomName).emit("answer", answer, socket.id);
  });

  socket.on("disconnect_call", (roomName, isBrodcaster) => {
    if (!isBrodcaster) {
      console.log("Connection disconnect============", roomName, socket.id);
      socket.to(roomName).emit("disconnectViewer", socket.id);
      socket.leave(roomName);

      setTimeout(() => {
        console.log(
          "Room Left: ",
          roomName,
          "| All Users : ",
          io.sockets.adapter.rooms.get(roomName)
        );
        socket.broadcast.to(roomName).emit("total_users_in_room", {
          roomName,
          totalActiveUsers: io.sockets.adapter.rooms.get(roomName)?.size || 0,
        });
      }, 300);
    } else {
      console.log(
        "Connection disconnect Brodcaster============",
        roomName,
        socket.id
      );
      socket.to(roomName).emit("disconnectBrodcaster");
      activeChannels.delete(roomName);
      io.socketsLeave(roomName);
      setTimeout(() => {
        console.log(
          "Room Left: ",
          roomName,
          "| All Users : ",
          io.sockets.adapter.rooms.get(roomName)
        );
      }, 300);
    }
  });
});
