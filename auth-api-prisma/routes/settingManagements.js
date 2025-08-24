const express = require('express');
const router = express.Router();
const createSecuredRoutes = require('../utils/createSecuredRoutes');
const serviceSwitchingController = require('../controllers/serviceSwitchingController');
const authMiddleware  = require('../middleware/auth');

const {
  addServiceSwitchingValidation,
  updateServiceSwitchingValidation,
  changeServiceSwitchingStatusValidation,
  deleteServiceSwitchingValidation
} = require('../validators/serviceSwitchingValidator');


const securedRoutes = createSecuredRoutes(authMiddleware, (router) => {
  // Add Service Switching
  router.post('/service-switching/add', addServiceSwitchingValidation, serviceSwitchingController.addServiceSwitching);
  router.post('/service-switching/get-list', serviceSwitchingController.getServiceSwitchingList);
  router.put('/service-switching/update/:id', updateServiceSwitchingValidation, serviceSwitchingController.updateServiceSwitching);
  router.get('/service-switching/byid/:id', serviceSwitchingController.getServiceSwitchingById);
  router.delete('/service-switching/delete/:id', deleteServiceSwitchingValidation, serviceSwitchingController.deleteServiceSwitching);
  router.patch('/service-switching/change-status/:id', changeServiceSwitchingStatusValidation, serviceSwitchingController.changeServiceSwitchingStatus);

});

router.use('/', securedRoutes);

module.exports = router;
