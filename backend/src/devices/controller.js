const { supabase } = require('../config/supabase');
const response = require('../utils/response');
const logger = require('../utils/logger');

const devicesController = {
  /**
   * GET /api/devices
   * Returns all known devices for the authenticated user.
   */
  async getDevices(req, res) {
    try {
      const userId = req.user.userId;

      const { data: devices, error } = await supabase
        .from('devices')
        .select('id, device_name, device_type, os_info, ip_address, is_trusted, last_active, created_at')
        .eq('user_id', userId)
        .order('last_active', { ascending: false });

      if (error) throw error;

      return response.success(res, devices.map((d) => ({
        id: d.id,
        name: d.device_name,
        type: d.device_type,
        os: d.os_info,
        ipAddress: d.ip_address,
        isTrusted: d.is_trusted,
        lastActive: d.last_active,
        addedAt: d.created_at,
      })));
    } catch (err) {
      logger.error('Get devices failed', { error: err.message });
      return response.error(res, 'Failed to fetch devices', 500);
    }
  },

  /**
   * DELETE /api/devices/:id
   * Remove (revoke) a device — it will be treated as new on next login.
   */
  async removeDevice(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // ownership guard

      if (error) throw error;

      logger.info('Device removed', { userId, deviceId: id });
      return response.success(res, null, 'Device removed. It will be treated as new on next login.');
    } catch (err) {
      logger.error('Remove device failed', { error: err.message });
      return response.error(res, 'Failed to remove device', 500);
    }
  },

  /**
   * PUT /api/devices/:id/trust
   * Manually trust a device (admin / user preference).
   */
  async trustDevice(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const { error } = await supabase
        .from('devices')
        .update({ is_trusted: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      return response.success(res, null, 'Device trusted successfully.');
    } catch (err) {
      logger.error('Trust device failed', { error: err.message });
      return response.error(res, 'Failed to trust device', 500);
    }
  },
};

module.exports = devicesController;
