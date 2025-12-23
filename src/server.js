import './loadEnv.js';
import app from './app.js';
import connectDB from './config/database.js';





const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';



connectDB();

const server = app.listen(PORT, () => {
  console.log("ENV TEST:", process.env.MONGODB_URI);

  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});


process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});