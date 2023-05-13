const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");
const { writeFile } = require("fs");
const fileUpload = require("express-fileupload");
const cors = require("cors");
dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept json data
app.use(fileUpload()); // to accept files (images, videos, etc)

// app.get("/", (req, res) => {
//   res.send("API Running!");
// });

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

app.use(cors());
// --------------------------deployment------------------------------
app.use(express.static("public"));
// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT;
const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    // origin: "/localhost:3001 ",
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("Connected to socket.io");
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));
  socket.on("upload", (data, callback) => {
    // console.log(data); // <Buffer 25 50 44 ...>
    //broadcast the file to all the users in the room
    // socket.emit("add image", file);
    // socket.broadcast.emit("add image", file);
    // save the content to the disk, for example

    if (!data.receiver_id) return console.log("chat.receiver_id not defined");

    data.receiver_id.forEach((user) => {
      if (user._id == data.sender_id) return;

      socket.in(user._id).emit("add image", data.file);
    });
    writeFile("/data", data.file, (err) => {
      callback({ message: err ? "failure" : "success" });
    });
  });
  socket.on("new message", (newMessageRecieved) => {
    console.log("mesaage", newMessageRecieved);
    var chat = newMessageRecieved.chat;
    console.log(chat);

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });

  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData._id);
  });
});
