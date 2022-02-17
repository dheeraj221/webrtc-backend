const socket = require("socket.io");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 4000;
app.use(cors());

const channels = [
  { name: "test", password: "test" },
  { name: "dragon-tiger", password: "test" },
  { name: "sic-bo", password: "test" },
];

let activeChannels = [];

const server = app.listen(PORT, () => {
  console.log(`Server starts listening at Port ${PORT}`);
});

const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // console.log("Web socket connected", socket.id);

  // logic to create room for broadcaster
  socket.on("create_room", ({ roomName, password }) => {
    // console.log(roomName, password);
    const rooms = io.sockets.adapter.rooms;
    const roomAlreadyExist = rooms.get(roomName);
    const validCredentials =
      channels.find((channel) => channel.name === roomName)?.password ===
      password;

    if (roomAlreadyExist === undefined && validCredentials) {
      socket.join(roomName);
      activeChannels.push(roomName);
      // socket.emit("active_channels", activeChannels);
      socket.emit("room_created", roomName);
      socket.emit("total_users_in_room", {
        roomName,
        totalActiveUsers: io.sockets.adapter.rooms.get(roomName).size,
      });
      console.log(
        "Room Name: ",
        roomName,
        "| All Users : ",
        io.sockets.adapter.rooms.get(roomName)
      );
    } else {
      console.log(
        "<==== ERROR: Broadcast conflict or password not match ====>"
      );
    }
  });

  // logic to join room for viewer
  socket.on("join_room", (roomName) => {
    // console.log(roomName)
    const rooms = io.sockets.adapter.rooms;
    const roomAlreadyExist = rooms.get(roomName);
    // console.log("Rooms for joining viewer ==> ", rooms, roomAlreadyExist);
    if (roomAlreadyExist) {
      const rooms = io.sockets.adapter.rooms;
      socket.join(roomName);
      socket.emit("room_joined", roomName);
      socket.broadcast.to(roomName).emit("total_users_in_room", {
        roomName,
        totalActiveUsers: io.sockets.adapter.rooms.get(roomName).size,
      });
      console.log(
        "Room Name: ",
        roomName,
        "| All Users : ",
        rooms.get(roomName)
      );
    } else {
      console.log("<==== ERROR: Room not exist  ====>");
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
});
