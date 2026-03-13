import AppError from '../utils/AppError.js';

const errorMessagesAR = {
  'User not found': 'المستخدم غير موجود',
  'Invalid token. Please log in again!':
    'توكن غير صالح. يرجى تسجيل الدخول مرة أخرى!',
  'Your token has expired! Please log in again.':
    'انتهت صلاحية التوكن الخاص بك! يرجى تسجيل الدخول مرة أخرى.',
  'Invalid credentials': 'بيانات الاعتماد غير صالحة',
  'Incorrect current password': 'كلمة المرور الحالية غير صحيحة',
  'Incorrect password': 'كلمة المرور غير صحيحة',
  'Invalid or expired OTP': 'رمز OTP غير صالح أو منتهي الصلاحية',
  'Invalid or expired reset token': 'توكن إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية',
  'Something went wrong!': 'حدث خطأ ما!',
  'Duplicate field value': 'قيمة حقل مكررة. يرجى استخدام قيمة أخرى!',
  'Invalid input data': 'بيانات إدخال غير صالحة',
};

const localizeMessage = (message) => {
  if (!message) return message;
  // Check for exact matches
  if (errorMessagesAR[message]) return errorMessagesAR[message];

  // Check for partial matches (e.g., for validation errors or duplicate fields)
  for (const [key, value] of Object.entries(errorMessagesAR)) {
    if (message.includes(key)) return value;
  }

  return message;
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: localizeMessage(err.message),
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: localizeMessage(err.message),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: localizeMessage('Something went wrong!'),
    });
  }
};

const errorMiddleware = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

export default errorMiddleware;
