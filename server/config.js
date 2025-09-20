require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 5000,
    MONGODB_URI: process.env.MONGODB_URI,
    CLIENT_URL: process.env.NODE_ENV === 'production' 
        ? 'https://your-frontend-url.vercel.app'
        : 'http://localhost:3000'
};