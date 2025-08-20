const express = require('express');
const router = express.Router();

const serviceSwitchingController = require('../controllers/serviceSwitchingController');
// const authMiddleware  = require('../middleware/auth');


const {
    addServiceSwitchingValidation,
    updateServiceSwitchingValidation,
    deleteServiceSwitchingValidation
} = require('../validators/serviceSwitchingValidator');


// router.use(authMiddleware);

// Add Service Switching
router.post('/service-switching/add', addServiceSwitchingValidation, serviceSwitchingController.addServiceSwitching);
router.post('/service-switching/get-list', serviceSwitchingController.getServiceSwitchingList);
router.patch('/service-switching/update/:id', updateServiceSwitchingValidation, serviceSwitchingController.updateServiceSwitching);
router.get('/service-switching/byid/:id', serviceSwitchingController.getServiceSwitchingById);
router.delete('/service-switching/delete/:id', deleteServiceSwitchingValidation, serviceSwitchingController.deleteServiceSwitching);

module.exports = router;
