const express = require('express');

/**
 * Helper to create a secured routes group with middleware
 * @param {Function|Array} middleware - Single middleware or array of middlewares
 * @param {Function} defineRoutes - Function that defines routes inside the group
 * @returns {express.Router}
 */
function createSecuredRoutes(middleware, defineRoutes) {
  const groupRouter = express.Router();

  if (Array.isArray(middleware)) groupRouter.use(...middleware);
  else groupRouter.use(middleware);

  defineRoutes(groupRouter);

  return groupRouter;
}

module.exports = createSecuredRoutes;
