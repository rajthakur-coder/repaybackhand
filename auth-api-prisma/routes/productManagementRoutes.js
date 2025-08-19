
const express = require('express');
const router = express.Router(); 

const authMiddleware  = require('../middleware/auth');
const upload = require('../middleware/uploads');
const { validationResult } = require('express-validator');


//Controllers
const productCategoryController = require('../controllers/productCategoryController');
const productController = require('../controllers/productController');
const productPriceController = require('../controllers/productPriceController');

//Validators 
const {
   addProductCategoryValidation,
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


// Product Category Routes
router.post('/category/add', addProductCategoryValidation, productCategoryController.addProductCategory);
router.get('/category/get-list', productCategoryController.getProductCategoryList);
router.get('/category/byid/:id', productCategoryController.getProductCategoryById);
router.put('/category/update/:id', updateProductCategoryValidation, productCategoryController.updateProductCategory);
router.delete('/category/delete/:id', deleteCategoryValidation,productCategoryController.deleteProductCategory);
router.post('/category/change-status/:id', changeCategoryStatusValidation,  productCategoryController.changeProductCategoryStatus);

// Product Routes
router.post('/products/add', upload.single('icon'), addProductValidation,  productController.addProduct);
router.get('/products/get-list', productController.getProductList);
router.get('/products/byid/:id', productController.getProductById);
router.put('/products/update/:id', upload.single('icon'), updateProductValidation, productController.updateProduct);
router.delete('/products/delete/:id', deleteProductValidation, productController.deleteProduct);
router.post('/products/change-status/:id', changeProductStatusValidation, productController.changeProductStatus );

// Product Price Routes
router.post('/prices/add', createProductPriceValidator,productPriceController.addProductPrice);
router.get('/prices/get-list', productPriceController.getProductPricingList);
router.get('/prices/byid/:id', productPriceController.getProductPriceById);
router.put('/prices/update/:id', updateProductPriceValidator, productPriceController.updateProductPrice);
router.delete('/prices/delete/:id', deleteProductPriceValidator,  productPriceController.deleteProductPrice);

module.exports = router;
