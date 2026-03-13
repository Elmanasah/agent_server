/**
 * src/middleware/validate.js
 *
 * Factory that wraps a Zod schema and validates req.body.
 * Returns a 400 with field-level error details on failure.
 *
 * Usage:
 *   router.post('/chat', validate(chatSchema), chatController);
 */

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                issues: result.error.flatten().fieldErrors,
            });
        }
        req.body = result.data; // replace body with parsed + coerced data
        next();
    };
}
