const express = require('express');
const controller = require('../controllers/msgApiController');
const { addApiValidation, updateApiValidation, deleteApiValidation, getApiByIdValidation } = require('../validators/msgApiValidation');

const router = express.Router();

router.post('/add', addApiValidation, controller.addMsgApi);

router.get('/list', controller.getMsgApiList);

router.get('/:id', getApiByIdValidation, controller.getMsgApiById);

router.put('/update', updateApiValidation, controller.updateMsgApi);

router.delete('/delete/:id', deleteApiValidation, controller.deleteMsgApi);

module.exports = router;
