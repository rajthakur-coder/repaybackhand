const express = require('express');
const router = express.Router();

const controller = require('../controllers/msgApiController');
const signatureController = require('../controllers/msgSignatureController');
// const authMiddleware  = require('../middleware/auth');

const { addApiValidation,
  updateApiValidation,
  deleteApiValidation,
  getApiByIdValidation
} = require('../validators/msgApiValidation');

const {
addOrUpdateSignatureValidator
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
router.post('/msg-apis/get-list', controller.getMsgApiList);
router.get('/msg-apis/byid/:id', getApiByIdValidation,controller.getMsgApiById);
router.put('/msg-apis/update/:id', updateApiValidation, controller.updateMsgApi);
router.delete('/msg-apis/delete/:id', deleteApiValidation, controller.deleteMsgApi);


// Add new signature
router.post('/signature', addOrUpdateSignatureValidator, signatureController.addOrUpdateSignature);

// Add new message content
router.post('/msg-contents/add', addMsgContentValidation, addMsgContent);
router.post('/msg-contents/get-list', getMsgContentList);
router.get('/msg-contents/byid/:id', deleteMsgContentValidation, getMsgContentById);
router.put('/msg-contents/updated/:id', updateMsgContentValidation, updateMsgContent);
router.delete('/msg-contents/delete/:id', deleteMsgContentValidation, deleteMsgContent);


// POST: Get Message Logs
// router.get('/msg-logs/get-list', getMessageLogs);

module.exports = router;

