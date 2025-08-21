// const express = require('express');
// const router = express.Router();

// const controller = require('../controllers/msgApiController');
// const signatureController = require('../controllers/msgSignatureController');
// // const authMiddleware  = require('../middleware/auth');

// const { addApiValidation,
//   updateApiValidation,
//   deleteApiValidation,
//   getApiByIdValidation
// } = require('../validators/msgApiValidation');

// const {
// addOrUpdateSignatureValidator
// } = require('../validators/msgSignatureValidator');


// const {
//   addMsgContentValidation,
//   updateMsgContentValidation,
//   deleteMsgContentValidation
// } = require('../validators/msgContentsValidator');

// const {
//   addMsgContent,
//   getMsgContentList,
//   getMsgContentById,
//   updateMsgContent,
//   deleteMsgContent
// } = require('../controllers/msgContentsController');

// // router.use(authMiddleware);


// // Add Message API
// router.post('/msg-apis/add', addApiValidation, controller.addMsgApi);
// router.post('/msg-apis/get-list', controller.getMsgApiList);
// router.get('/msg-apis/byid/:id', getApiByIdValidation,controller.getMsgApiById);
// router.put('/msg-apis/update/:id', updateApiValidation, controller.updateMsgApi);
// router.delete('/msg-apis/delete/:id', deleteApiValidation, controller.deleteMsgApi);


// // Add new signature
// router.post('/signature', addOrUpdateSignatureValidator, signatureController.addOrUpdateSignature);

// // Add new message content
// router.post('/msg-contents/add', addMsgContentValidation, addMsgContent);
// router.post('/msg-contents/get-list', getMsgContentList);
// router.get('/msg-contents/byid/:id', deleteMsgContentValidation, getMsgContentById);
// router.put('/msg-contents/updated/:id', updateMsgContentValidation, updateMsgContent);
// router.delete('/msg-contents/delete/:id', deleteMsgContentValidation, deleteMsgContent);


// // POST: Get Message Logs
// // router.get('/msg-logs/get-list', getMessageLogs);

// module.exports = router;



const express = require('express');
const router = express.Router();

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

/**
 * Helper to create a group of routes with middleware
 * @param {Array|Function} middleware - middleware(s) to apply
 * @param {Function} defineRoutes - callback to define routes on router
 */
function createSecuredRoutes(middleware, defineRoutes) {
  const groupRouter = express.Router();

  if (Array.isArray(middleware)) groupRouter.use(...middleware);
  else groupRouter.use(middleware);

  // Call the callback to define routes on this router
  defineRoutes(groupRouter);

  return groupRouter;
}

// -----------------------------
// Secured Routes
// -----------------------------
const securedRoutes = createSecuredRoutes(authMiddleware, (r) => {
  // Msg APIs
  r.post('/msg-apis/add', addApiValidation, controller.addMsgApi);
  r.post('/msg-apis/get-list', controller.getMsgApiList);
  r.get('/msg-apis/byid/:id', getApiByIdValidation, controller.getMsgApiById);
  r.put('/msg-apis/update/:id', updateApiValidation, controller.updateMsgApi);
  r.delete('/msg-apis/delete/:id', deleteApiValidation, controller.deleteMsgApi);

  // Signatures
  r.post('/signature', addOrUpdateSignatureValidator, signatureController.addOrUpdateSignature);

  // Msg Contents
  r.post('/msg-contents/add', addMsgContentValidation, msgContentsController.addMsgContent);
  r.post('/msg-contents/get-list', msgContentsController.getMsgContentList);
  r.get('/msg-contents/byid/:id', deleteMsgContentValidation, msgContentsController.getMsgContentById);
  r.put('/msg-contents/updated/:id', updateMsgContentValidation, msgContentsController.updateMsgContent);
});

// Mount secured routes
router.use('/', securedRoutes);

// -----------------------------
// Public Routes (no middleware)
// -----------------------------
router.delete('/msg-contents/delete/:id', deleteMsgContentValidation, msgContentsController.deleteMsgContent);

// Example: any other public route
router.get('/public-info', (req, res) => {
  res.json({ message: "This is public data" });
});

module.exports = router;
