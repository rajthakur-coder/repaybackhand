const { asyncLocalStorage } = require('../lib/prismaClient');

function requestContextMiddleware(req, res, next) {
  const store = {
    userId: req.user?.id ?? null,
    ip: req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip,
    latitude: req.body?.latitude ?? req.query?.latitude ?? null,
    longitude: req.body?.longitude ?? req.query?.longitude ?? null,
    remark: null,
    status: null
  };

  asyncLocalStorage.run(store, () => next());
}

module.exports = requestContextMiddleware;
