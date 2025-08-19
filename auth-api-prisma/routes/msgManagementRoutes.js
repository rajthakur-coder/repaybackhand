const express = require('express');
const router = express.Router();

const controller = require('../controllers/msgApiController');
const signatureController = require('../controllers/msgSignatureController');
// const { getMessageLogs } = require('../controllers/msgLogsController');
// const authMiddleware  = require('../middleware/auth');



const { addApiValidation,
  updateApiValidation,
  deleteApiValidation,
  getApiByIdValidation
} = require('../validators/msgApiValidation');

const {
  addSignatureValidation,
  updateSignatureValidation,
  deleteSignatureValidation
} = require('../validators/msgSignatureValidator');


const {
  addMsgContentValidation,
  updateMsgContentValidation,
  deleteMsgContentValidation
} = require('../validators/msgContentsValidator');

const {
  addMsgContent,
  getMsgContentList,
  getMsgContentById,
  updateMsgContent,
  deleteMsgContent
} = require('../controllers/msgContentsController');

// router.use(authMiddleware);


// Add Message API
router.post('/msg-apis/add', addApiValidation, controller.addMsgApi);
router.get('/msg-apis/get-list', controller.getMsgApiList);
router.get('/msg-apis/byid/:id', getApiByIdValidation,controller.getMsgApiById);
router.patch('/msg-apis/update', updateApiValidation, controller.updateMsgApi);
router.delete('/msg-apis/delete/:id', deleteApiValidation, controller.deleteMsgApi);


// Add new signature
router.post('/msg-signatures/add', addSignatureValidation, signatureController.addSignature);
router.get('/msg-signatures/get-list', signatureController.getSignatureList);
router.get('/msg-signatures/byid/:id', signatureController.getSignatureById);
router.patch('/msg-signatures/updated', updateSignatureValidation, signatureController.updateSignature);
router.delete('/msg-signatures/delete/:id', deleteSignatureValidation, signatureController.deleteSignature);


// Add new message content
router.post('/msg-contents/add', addMsgContentValidation, addMsgContent);
router.get('/msg-contents/get-list', getMsgContentList);
router.get('/msg-contents/byid/:id', deleteMsgContentValidation, getMsgContentById);
router.patch('/msg-contents/updated', updateMsgContentValidation, updateMsgContent);
router.delete('/msg-contents/delete/:id', deleteMsgContentValidation, deleteMsgContent);


// POST: Get Message Logs
// router.get('/msg-logs/get-list', getMessageLogs);

module.exports = router;

