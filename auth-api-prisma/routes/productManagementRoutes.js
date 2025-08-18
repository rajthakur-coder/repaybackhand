const express = require('express');
const router = express.Router();

const authMiddleware  = require('../middleware/auth');
const upload = require('../middleware/uploads');

//Controllers
const productCategoryController = require('../controllers/productCategoryController');
const productController = require('../controllers/productController');
const productPriceController = require('../controllers/productPriceController');

//Validators 
const {
  productCategoryValidation,
  updateProductCategoryValidation,
  deleteCategoryValidation,
  changeCategoryStatusValidation,

  addProductValidation,
  updateProductValidation,
  deleteProductValidation,
  changeProductStatusValidation,

  createProductPriceValidator,
  updateProductPriceValidator,
  deleteProductPriceValidator,
} = require('../validators/productManagement');
// Apply Auth Middleware for all routes 
router.use(authMiddleware);

// Product Category Routes
router.post('/category/get-list', productCategoryController.getProductCategoryList);
router.post('/category/add', productCategoryValidation, productCategoryController.addProductCategory);
router.get('/category/byid/:id', productCategoryController.getProductCategoryById);
router.put('/category/update', updateProductCategoryValidation, productCategoryController.updateProductCategory);
router.delete('/category/delete/byid/:id', deleteCategoryValidation, productCategoryController.deleteProductCategory);
router.post('/category/change-status', changeCategoryStatusValidation, productCategoryController.changeProductCategoryStatus);

// Product Routes 
router.post('/products/list', productController.getProductList);
router.post('/products/add', upload.single('icon'), addProductValidation, productController.addProduct);
router.get('/products/byid/:id', productController.getProductById);
router.put('/products/update', upload.single('icon'), updateProductValidation, productController.updateProduct);
router.delete('/products/delete/:id', deleteProductValidation, productController.deleteProduct);
router.post('/products/change-status', changeProductStatusValidation, productController.changeProductStatus);

// Product Price Routes
router.post('/prices/add', createProductPriceValidator, productPriceController.addProductPrice);
router.post('/prices/list', productPriceController.getProductPricingList);
router.get('/prices/byid/:id', productPriceController.getProductPriceById);
router.put('/prices/update', updateProductPriceValidator, productPriceController.updateProductPrice);
router.delete('/prices/delete/:id', deleteProductPriceValidator, productPriceController.deleteProductPrice);

module.exports = router;
