const express = require('express');
const router = express.Router();
const createSecuredRoutes = require('../utils/createSecuredRoutes');

const controller = require('../controllers/msgApiController');
const signatureController = require('../controllers/msgSignatureController');
const msgContentsController = require('../controllers/msgContentsController');
const authMiddleware = require('../middleware/auth');


const { 
  addApiValidation, updateApiValidation, deleteApiValidation, getApiByIdValidation 
} = require('../validators/msgApiValidation');

const { addOrUpdateSignatureValidator } = require('../validators/msgSignatureValidator');
const { 
  addMsgContentValidation, updateMsgContentValidation, deleteMsgContentValidation 
} = require('../validators/msgContentsValidator');



const securedRoutes = createSecuredRoutes(authMiddleware, (router) => {
  // Msg APIs
  router.post('/msg-apis/add', addApiValidation, controller.addMsgApi);
  router.post('/msg-apis/get-list', controller.getMsgApiList);
  router.get('/msg-apis/byid/:id', getApiByIdValidation, controller.getMsgApiById);
  router.put('/msg-apis/update/:id', updateApiValidation, controller.updateMsgApi);
  router.delete('/msg-apis/delete/:id', deleteApiValidation, controller.deleteMsgApi);
  router.patch('/msg-apis/change-status/:id', controller.changeMsgApiStatus);

  // Signatures
  router.post('/signature', addOrUpdateSignatureValidator, signatureController.addOrUpdateSignature);

  // Msg Contents
  router.post('/msg-contents/add', addMsgContentValidation, msgContentsController.addMsgContent);
  router.post('/msg-contents/get-list', msgContentsController.getMsgContentList);
  router.get('/msg-contents/byid/:id', deleteMsgContentValidation, msgContentsController.getMsgContentById);
  router.put('/msg-contents/updated/:id', updateMsgContentValidation, msgContentsController.updateMsgContent);
  router.delete('/msg-contents/delete/:id', deleteMsgContentValidation, msgContentsController.deleteMsgContent);

});

router.use('/', securedRoutes);

module.exports = router;
