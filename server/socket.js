const socketServer = (io) => {
  io.on('connection', socket => {
    console.log('New client connected');

    socket.on('joinRoom', roomId => {
      socket.join(roomId);
      console.log(`Joined room: ${roomId}`);
    });

    socket.on('codeChange', ({ roomId, code }) => {
      socket.to(roomId).emit('codeChange', code);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};

export default socketServer;
