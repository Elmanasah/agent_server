import { LogService } from '../modules/logs/log.service.js';

/**
 * Global Activity Logger Middleware
 * 
 * Replaces Morgan and tracks requests directly in the activity_logs table.
 * It waits for the response to finish to capture the final status code.
 */
const activityLogger = async (req, res, next) => {
    // Skip logging for health checks or static assets if any
    if (req.path === '/' || req.path === '/favicon.ico') {
        return next();
    }

    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const method = req.method;
        const path = req.path;
        const userId = req.user?.id || null;
        let action = `${method} ${path}`;
        let category = 'api';

        // simple mapping for common routes to make logs readable
        if (path.includes('/auth/login')) { action = 'login'; category = 'auth'; }
        else if (path.includes('/auth/register')) { action = 'register'; category = 'auth'; }
        else if (path.includes('/auth/verify-email')) { action = 'verify_email'; category = 'auth'; }
        else if (path.includes('/auth/reset-password')) { action = 'reset_password'; category = 'auth'; }
        else if (path.includes('/auth/change-password')) { action = 'password_changed'; category = 'auth'; }
        else if (path.includes('/auth/google/callback')) { action = 'google_oauth_login'; category = 'auth'; }
        else if (path.includes('/auth/logout')) { action = 'logout'; category = 'auth'; }
        else if (path.includes('/chat')) { action = 'chat_message'; category = 'ai'; }
        else if (path.includes('/image/generate')) { action = 'image_generation'; category = 'ai'; }
        else if (path.includes('/users/me')) {
            if (method === 'PATCH' || method === 'PUT') action = 'profile_updated';
            else if (method === 'DELETE') action = 'account_deleted';
            category = 'auth';
        }
        else if (path.includes('/usage/admin')) {
            category = 'admin';
            if (path.includes('/plan')) action = 'admin_change_plan';
            else if (path.includes('/lock')) action = 'admin_lock_user';
            else if (path.includes('/unlock')) action = 'admin_unlock_user';
            else if (path.includes('/reset-all')) action = 'admin_trigger_reset_all';
            else if (path.includes('/reset')) action = 'admin_reset_usage';
            else action = 'admin_view_usage';
        }
        else if (path.includes('/plans')) { category = 'admin'; action = 'manage_plans'; }

        // Categorize by status
        if (statusCode >= 500) category = 'error';
        else if (statusCode >= 400) category = 'warning';
        else if (method !== 'GET') category = 'action';

        // Fire and forget (don't block the response)
        LogService.write({
            userId,
            category,
            action,
            statusCode,
            req,
            meta: {
                duration: `${duration}ms`,
                params: req.params,
                query: req.query,
                // Avoid logging full body for privacy/performance, maybe just keys
                bodyKeys: Object.keys(req.body || {}),
            }
        }).catch(err => {
            console.error('[ActivityLogger] Failed to write log:', err.message);
        });
    });

    next();
};

export default activityLogger;
