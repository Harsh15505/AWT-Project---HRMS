const dotenv = require('dotenv');
dotenv.config();

const app = require('./app.js');
const connectDB = require('./src/config/db.js');

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Server is running');
});

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on: http://localhost:5000/`);
    });
})