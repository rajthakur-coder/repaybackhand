const express = require('express');
const router = express.Router();
const serviceSwitchingController = require('../controllers/serviceSwitchingController');

const {
  addServiceSwitchingValidation,
  updateServiceSwitchingValidation,
  deleteServiceSwitchingValidation
} = require('../validators/serviceSwitchingValidator');

// Add Service Switching
router.post(
  '/add',
  addServiceSwitchingValidation,
  serviceSwitchingController.addServiceSwitching
);

// List Service Switchings
router.post('/list', serviceSwitchingController.getServiceSwitchingList);

// Update Service Switching
router.put(
  '/update',
  updateServiceSwitchingValidation,
  serviceSwitchingController.updateServiceSwitching
);

// ID
router.get(
  '/:id',
  serviceSwitchingController.getServiceSwitchingById
);

// Delete Service Switching
router.delete(
  '/delete/:id',
  deleteServiceSwitchingValidation,
  serviceSwitchingController.deleteServiceSwitching
);

module.exports = router;
