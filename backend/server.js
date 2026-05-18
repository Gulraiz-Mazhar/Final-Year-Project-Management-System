/* ===== backend/server.js ===== */
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const dns = require('node:dns/promises');
dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);

const connectDB = require('./src/config/db');

const routes = require('./src/routes');

const errorHandler = require('./src/middlewares/error');

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json()); 
app.use(cookieParser());

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false
}));


if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            console.log('Body:', JSON.stringify(req.body, null, 2));
        }
        next();
    });
}

app.use('/api', routes);


app.use(errorHandler);


app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});