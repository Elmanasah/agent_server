// src/middleware/allowTo.js
//
// Simple explanation:
//   This middleware checks if the logged-in user has
//   the required role before letting them through.
//
// Example usage in routes:
//   router.use('/admin', allowTo('admin'))
//   router.get('/dashboard', allowTo('admin', 'moderator'), controller)

export function allowTo(...roles) {
  return (req, res, next) => {
    // No user attached means verifyToken didn't run first
    if (!req.user) {
      return res.status(401).json({
        status:  'fail',
        message: 'Unauthorized — please log in',
      });
    }

    // User exists but doesn't have the required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status:  'fail',
        message: 'Forbidden — you do not have permission',
      });
    }

    next();
  };
}

// Keep default export too so other files that use
// import allowTo from '...' still work
export default allowTo;