/**
 * Response formatting middleware
 * Standardizes API responses
 */
export const formatResponse = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    // If it's an error response, don't format it
    if (res.statusCode >= 400) {
      return originalJson.call(this, data);
    }

    // Format success responses
    const formattedData = {
      status: 'success',
      ...(data?.data && { data: data.data }),
      ...(data?.count !== undefined && { count: data.count }),
      ...(data?.message && { message: data.message }),
      ...(data?.pagination && { pagination: data.pagination }),
    };

    // If data doesn't have the expected structure, wrap it
    if (!data?.data && !data?.count) {
      formattedData.data = data;
    }

    return originalJson.call(this, formattedData);
  };

  next();
};

