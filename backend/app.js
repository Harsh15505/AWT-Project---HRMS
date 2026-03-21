const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();


app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not Found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

module.exports = app;

