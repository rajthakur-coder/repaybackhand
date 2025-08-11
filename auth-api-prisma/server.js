const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const productManagementRoutes = require('./routes/productManagementRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/v1', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1/product-management', productManagementRoutes);
// app.use('/api/v1/product-category', productCategoryRoutes);
// app.use('/api/v1/products', productRoutes);
// app.use('/api/v1/product-price', productPriceRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

