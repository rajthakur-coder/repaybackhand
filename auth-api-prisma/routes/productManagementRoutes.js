const express = require('express');
const router = express.Router();

const productCategoryController = require('../controllers/productCategoryController');
const productPriceController = require('../controllers/productPriceController');
const productController = require('../controllers/productController');
const authMiddleware  = require('../middleware/auth');


const {
  addProductValidation,
  updateProductValidation,
  deleteProductValidation,
  changeStatusValidation: productChangeStatusValidation,
} = require('../validators/productValidator');

const {
  productCategoryValidation,
  updateProductCategoryValidation,
  deleteCategoryValidation,
  changeStatusValidation: categoryChangeStatusValidation,
} = require('../validators/productCategoryValidator');


const {
  createProductPriceValidator,
  updateProductPriceValidator,
  deleteProductPriceValidator,
} = require('../validators/productPriceValidator');
const upload = require('../middleware/uploads');


// router.use(authMiddleware);

// Product Category Routes
router.post('/category/get-list', productCategoryController.getProductCategoryList);
router.post('/category/add', productCategoryValidation, productCategoryController.addProductCategory);
router.get('/category/byid/:id', productCategoryController.getProductCategoryById);
router.put('/category/update', updateProductCategoryValidation, productCategoryController.updateProductCategory);
router.delete('/category/delete/byid/:id', deleteCategoryValidation, productCategoryController.deleteProductCategory);
router.post('/category/change-status', categoryChangeStatusValidation, productCategoryController.changeProductCategoryStatus);


// Product Management Routes
router.post('/products/list', productController.getProductList);
router.post('/products/add', upload.single('icon'), addProductValidation, productController.addProduct);
router.get('/products/byid/:id', productController.getProductById);
router.put('/products/update/:id', upload.single('image'), updateProductValidation, productController.updateProduct);
router.delete('/products/delete/:id', deleteProductValidation, productController.deleteProduct);
router.post('/products/change-status', productChangeStatusValidation, productController.changeProductStatus);


// Product Prices Routes
router.post('/prices/add', createProductPriceValidator, productPriceController.addProductPrice);
router.post('/prices/list', productPriceController.getProductPricingList);
router.get('/prices/:id', productPriceController.getProductPriceById);
router.put('/prices/update/:id', updateProductPriceValidator, productPriceController.updateProductPrice);
router.delete('/prices/delete/:id', deleteProductPriceValidator, productPriceController.deleteProductPrice);

module.exports = router;
