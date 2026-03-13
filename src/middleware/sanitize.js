function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const clean = {};
  for (const key in obj) {
    if (!key.startsWith('$') && !key.includes('.')) {
      clean[key] = sanitizeObject(obj[key]);
    }
  }
  return clean;
}

// Middleware (ES Modules)
export default function sanitizeMiddleware(req, res, next) {
  req.body = sanitizeObject(req.body);
  req.params = sanitizeObject(req.params);
  //   console.log(req.query);
  //   req.query = sanitizeObject({ ...req.query }); // safe: replace with new object
  next();
}
