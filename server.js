import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import transfer from "./wallet.js";

const prisma = new PrismaClient();

config();
console.log("here we go");

const port = process.env.PORT || 4000;
console.log("started");
const expressApp = express();
const server = createServer(expressApp);
const io = new Server(server);
const generateGameId = () => Math.random().toString(36).substr(2, 9);
const generateInviteCode = () => Math.random().toString(36).substr(7);

const broadcastActiveGames = async () => {
  const rooms = await prisma.gameRoom.findMany();
  console.log("Broadcasting active games:", rooms);
  io.emit("activeGames", rooms);
};

expressApp.get("/history", async (req, res) => {

  const userName = req.query.name;
  try {
    const history = await prisma.history.findMany({
      where: {
        OR: [
          { winnerName: userName  },
          { loserName: userName }
        ],
      }
    });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ error: "Error fetching history" });
  }
});

expressApp.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await prisma.user.findMany({
      orderBy: {
        earning: 'desc', // Sort by earning in descending order
      },
      take: 25, // Limit the number of results to top 25 users
      select: {
        userName: true,
        earning: true,
      },
    });

    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: "Error fetching leaderboard" });
  }
});


// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // create gameroom and regist creator if it is the first time
  socket.on(
    "createGame",
    async (
      data,
      callback
    ) => {
      console.log("get data: " + data);

      let user = await prisma.user.findUnique({
        where: {
          userName: data.userName,
        },
      });
      
      try {
        if (user) {
          const Id = generateGameId();
          const createdRoom = await prisma.gameRoom.create({
            data: {
              id: Id,
              creator: data.userName,
              creatorAddr: data.userAddr,
              amount: data.amount,
              choice: data.choice,
            },
          });
          broadcastActiveGames();

          callback({ success: true, createdRoom });
        } else {
          const generatedInviteCode = generateInviteCode();
          const user = await prisma.user.create({
            data: {
              userName: data.userName,
              userId: data.userId,
              userAddr: data.userAddr,
              inviteCode: generatedInviteCode,
            },
          });
          console.log("user registered:", user);

          if(data.invitedById){
            const referer = await prisma.user.findUnique({
              where:{
                userId: data.invitedById,
              }
            });

            transfer(referer?.userAddr, 0.25);
          }
          const Id = generateGameId();
          
          const createdRoom = await prisma.gameRoom.create({
            data: {
              id: Id,
              creator: data.userName,
              creatorAddr: data.userAddr,
              amount: data.amount,
              choice: data.choice,
            },
          });
          broadcastActiveGames();

          callback({ success: true, createdRoom });
        }
      } catch (error) {
        callback({ success: false, message: error });
      }
    }
  );

  // join gameroom and regist joiner if it is the first time
  socket.on(
    "joinGame",
    async (
      data,
      callback
    ) => {
      let user = await prisma.user.findUnique({
        where: {
          userName: data.userName,
        },
      });
      socket.join(data.roomId);
      try {
        if (user) {
          const joinRoom = await prisma.gameRoom.update({
            where: {
              id: data.roomId,
            },
            data: {
              joiner: data.userName,
              joinerAddr: data.userAddr,
              status: "In Progress",
            },
          });
          io.to(data.roomId).emit("gameJoined", {success: true, joinRoom});

         
            const randomInt = Math.floor(Math.random() * 2);
            const reward = joinRoom.amount*1.9;
            if(
              (randomInt == 1 && joinRoom.choice == "heads") ||
              (randomInt == 0 && joinRoom.choice == "tails")
            ){
              transfer(joinRoom.creatorAddr,BigInt(reward));
              const createHistory = await prisma.history.create({
                data: {
                  winnerName: joinRoom.creator,
                  loserName: data.userName,
                  amount: joinRoom.amount,
                }
              })

              const updateWinner = await prisma.user.update({
                where:{
                  userName: joinRoom.creator
                },
                data: {
                  earning: {
                    increment: joinRoom.amount
                  }
                }
              });

              const updateLoser = await prisma.user.update({
                where:{
                  userName: data.userName
                },
                data: {
                  earning: {
                    decrement: joinRoom.amount
                  }
                }
              })
              io.to(data.roomId).emit("gamePlayed", {success: true});

              const deleteGameRoom = await prisma.gameRoom.delete({
                where:{id: joinRoom.id}
              })

            }else{
              transfer(data.userAddr, BigInt(reward));
              const createHistory = await prisma.history.create({
                data: {
                  winnerName: data.userName,
                  loserName: joinRoom.creator,
                  amount: joinRoom.amount,
                }
              })

              const updateWinner = await prisma.user.update({
                where:{
                  userName: data.userName
                },
                data: {
                  earning: {
                    increment: joinRoom.amount,
                  }
                }
              });

              const updateLoser = await prisma.user.update({
                where:{
                  userName: joinRoom.creator
                },
                data: {
                  earning: {
                    decrement: joinRoom.amount
                  }
                }
              })
              io.to(data.roomId).emit("gamePlayed", {success: true});

              const deleteGameRoom = await prisma.gameRoom.delete({
                where:{id: joinRoom.id}
              })
            }
          
          broadcastActiveGames();
        } else {
          const generatedInviteCode = generateInviteCode();
          const user = await prisma.user.create({
            data: {
              userName: data.userName,
              userId: data.userId,
              userAddr: data.userAddr,
              inviteCode: generatedInviteCode,
            },
          });
          console.log("user registered:", user);

          if(data.invitedById){
            const referer = await prisma.user.findUnique({
              where:{
                userId: data.invitedById,
              }
            });

            transfer(referer?.userAddr, 0.25);
          }

          const joinRoom = await prisma.gameRoom.update({
            where: {
              id: data.roomId,
            },
            data: {
              joiner: data.userName,
              status: "In Progress",
            },
          });
          io.to(data.roomId).emit("gameJoined", {success: true, joinRoom});

          const randomInt = Math.floor(Math.random() * 2);
            const reward = joinRoom.amount*1.9;
            if(
              (randomInt == 1 && joinRoom.choice == "heads") ||
              (randomInt == 0 && joinRoom.choice == "tails")
            ){
              transfer(joinRoom.creatorAddr,BigInt(reward));
              const createHistory = await prisma.history.create({
                data: {
                  winnerName: joinRoom.creator,
                  loserName: data.userName,
                  amount: joinRoom.amount,
                }
              })

              const updateWinner = await prisma.user.update({
                where:{
                  userName: joinRoom.creator
                },
                data: {
                  earning: {
                    increment: joinRoom.amount
                  }
                }
              });

              const updateLoser = await prisma.user.update({
                where:{
                  userName: data.userName
                },
                data: {
                  earning: {
                    decrement: joinRoom.amount
                  }
                }
              })
              io.to(data.roomId).emit("gamePlayed", {success: true});

              const deleteGameRoom = await prisma.gameRoom.delete({
                where:{id: joinRoom.id}
              })

            }else{
              transfer(data.userAddr, BigInt(reward));
              const createHistory = await prisma.history.create({
                data: {
                  winnerName: data.userName,
                  loserName: joinRoom.creator,
                  amount: joinRoom.amount,
                }
              })

              const updateWinner = await prisma.user.update({
                where:{
                  userName: data.userName
                },
                data: {
                  earning: {
                    increment: joinRoom.amount,
                  }
                }
              });

              const updateLoser = await prisma.user.update({
                where:{
                  userName: joinRoom.creator
                },
                data: {
                  earning: {
                    decrement: joinRoom.amount
                  }
                }
              })
              io.to(data.roomId).emit("gamePlayed", {success: true});

              const deleteGameRoom = await prisma.gameRoom.delete({
                where:{id: joinRoom.id}
              })
            }

          broadcastActiveGames();
        }
      } catch (error) {
        callback({ success: false, message: error });
      }
    }
  );
  //before disconnection
  socket.on("beforedisconnecting", async (data) =>{
    const updateActiveGame = await prisma.gameRoom.delete({
      where:{
        id: data.id
      }
    })
    broadcastActiveGames();
  })
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(socket.id);
    console.log("User disconnected");
  });
});

// Use Next.js request handler for everything else

// Start the server
server.listen(port, (err) => {
  if (err) throw err;
  console.log(`> Ready on http://localhost:${port}`);
});
