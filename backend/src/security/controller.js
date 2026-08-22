const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const response = require('../utils/response');
const logger = require('../utils/logger');

const securityController = {
  /**
   * Get access logs
   */
  async getLogs(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20, action } = req.query;

      let query = supabase
        .from('access_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (action) query = query.eq('action', action);
      query = query.order('created_at', { ascending: false });
      query = query.range((page - 1) * limit, page * limit - 1);

      const { data: logs, error, count } = await query;
      if (error) throw error;

      return response.paginated(
        res,
        logs.map((l) => ({
          id: l.id,
          action: l.action,
          ipAddress: l.ip_address,
          userAgent: l.user_agent,
          resourceId: l.resource_id,
          details: l.details ? JSON.parse(l.details) : null,
          createdAt: l.created_at,
        })),
        parseInt(page),
        parseInt(limit),
        count || 0
      );
    } catch (error) {
      return response.error(res, 'Failed to fetch logs', 500);
    }
  },

  /**
   * Get security alerts
   */
  async getAlerts(req, res) {
    try {
      const userId = req.user.userId;

      const { data: alerts, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return response.success(res, alerts.map((a) => ({
        id: a.id,
        type: a.alert_type,
        severity: a.severity,
        message: a.message,
        isRead: a.is_read,
        createdAt: a.created_at,
      })));
    } catch (error) {
      return response.error(res, 'Failed to fetch alerts', 500);
    }
  },

  /**
   * Get active sessions
   */
  async getSessions(req, res) {
    try {
      const userId = req.user.userId;

      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return response.success(res, sessions.map((s) => ({
        id: s.id,
        deviceInfo: s.device_info,
        ipAddress: s.ip_address,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
      })));
    } catch (error) {
      return response.error(res, 'Failed to fetch sessions', 500);
    }
  },

  /**
   * Terminate session
   */
  async terminateSession(req, res) {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;

      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', userId);

      return response.success(res, null, 'Session terminated');
    } catch (error) {
      return response.error(res, 'Failed to terminate session', 500);
    }
  },
};

module.exports = securityController;
