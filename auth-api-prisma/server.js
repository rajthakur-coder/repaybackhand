const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/v1', authRoutes);
app.use('/api/v1', userRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

