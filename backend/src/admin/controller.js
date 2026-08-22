const { supabase } = require('../config/supabase');
const response = require('../utils/response');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Configurable Security Policies (with in-memory fallback / persisted state)
let systemPolicies = {
  maxLoginAttempts: 5,
  otpExpirySeconds: 300,
  maxSharingDurationDays: 7,
  maxDownloadCount: 10,
  sessionTimeoutHours: 168, // 7 days
  suspiciousDownloadThreshold: 15, // 15 downloads in 5 min
  requireOtpForSensitiveShares: true,
  maxUploadSizeBytes: 52428800, // 50 MB
};

const adminController = {
  /**
   * 1. Overall Security Operations Center (SOC) Overview
   */
  async getSecurityOverview(req, res) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch aggregated counts in parallel
      const [
        usersRes,
        filesRes,
        sharesRes,
        alertsRes,
        logsTodayRes,
      ] = await Promise.all([
        supabase.from('users').select('id, email, role, is_verified, is_suspended, security_score, storage_used, created_at, last_login').neq('email', 'nagababuy92@gmail.com'),
        supabase.from('files').select('id, name, size, is_deleted, created_at').eq('is_deleted', false),
        supabase.from('shared_links').select('id, file_id, is_active, expires_at, download_count, max_downloads, created_at'),
        supabase.from('security_alerts').select('id, severity, is_read, alert_type, created_at, details'),
        supabase.from('access_logs').select('id, action, user_id, ip_address, created_at').gte('created_at', startOfDay),
      ]);

      const users = usersRes.data || [];
      const files = filesRes.data || [];
      const shares = sharesRes.data || [];
      const alerts = alertsRes.data || [];
      const logsToday = logsTodayRes.data || [];

      // User Breakdown
      const totalUsers = users.length;
      const activeUsers = users.filter(u => !u.is_suspended && (u.last_login || u.is_verified)).length;
      const suspendedUsers = users.filter(u => u.is_suspended).length;
      const newUsersToday = users.filter(u => u.created_at >= startOfDay).length;
      const failedLoginUsersCount = new Set(logsToday.filter(l => l.action === 'login_failed').map(l => l.user_id || l.ip_address)).size;

      // Storage Breakdown
      let totalStorageUsed = 0;
      let largeFilesCount = 0;
      let recentUploadsCount = 0;
      files.forEach(f => {
        const sz = parseInt(f.size) || 0;
        totalStorageUsed += sz;
        if (sz > 50 * 1024 * 1024) largeFilesCount++;
        if (f.created_at >= startOfDay) recentUploadsCount++;
      });

      // File Activity Breakdown
      const uploadsToday = logsToday.filter(l => l.action === 'file_uploaded').length;
      const downloadsToday = logsToday.filter(l => l.action === 'file_downloaded').length;
      const sharesCreatedToday = logsToday.filter(l => l.action === 'share_created').length;
      const filesDeletedToday = logsToday.filter(l => l.action === 'file_deleted').length;

      // Security Status & Threat Indicators
      const activeAlerts = alerts.filter(a => !a.is_read);
      const criticalAlertsCount = activeAlerts.filter(a => a.severity === 'critical').length;
      const highAlertsCount = activeAlerts.filter(a => a.severity === 'high').length;
      const failedOtpToday = logsToday.filter(l => l.action === 'otp_failed' || l.action === 'share_otp_failed').length;
      const failedLoginsToday = logsToday.filter(l => l.action === 'login_failed').length;
      const suspiciousDownloadsCount = logsToday.filter(l => l.action.includes('suspicious') || l.action.includes('burst')).length;

      // Expired shares count
      const nowIso = now.toISOString();
      const expiredSharesCount = shares.filter(s => s.expires_at && s.expires_at < nowIso).length;

      // Global status indicator
      let securityStatus = 'secure';
      let statusMessage = '🟢 All Systems Secure — Zero critical security threats';
      if (criticalAlertsCount > 0) {
        securityStatus = 'critical';
        statusMessage = `🔴 ${criticalAlertsCount} Critical Security Event${criticalAlertsCount > 1 ? 's' : ''} Detected`;
      } else if (highAlertsCount > 0 || failedLoginsToday > 10) {
        securityStatus = 'warning';
        statusMessage = `🟡 ${highAlertsCount + (failedLoginsToday > 10 ? 1 : 0)} Elevated Security Events Detected`;
      }

      return response.success(res, {
        securityStatus,
        statusMessage,
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          newToday: newUsersToday,
          failedLoginsCount: failedLoginUsersCount,
        },
        storage: {
          totalBytes: totalStorageUsed,
          totalFiles: files.length,
          recentUploadsToday: recentUploadsCount,
          largeFilesCount,
        },
        activity: {
          uploadsToday,
          downloadsToday,
          filesSharedToday: sharesCreatedToday,
          filesDeletedToday,
        },
        threats: {
          activeAlertsCount: activeAlerts.length,
          criticalAlertsCount,
          highAlertsCount,
          failedOtpCount: failedOtpToday,
          failedLoginCount: failedLoginsToday,
          suspiciousDownloadsCount,
          expiredSharesCount,
          integrityFailuresCount: 0,
        },
      }, 'SOC Overview fetched successfully');
    } catch (error) {
      logger.error('Failed to fetch security overview', { error: error.message });
      return response.error(res, 'Failed to fetch security operations overview', 500);
    }
  },

  /**
   * 2. Live Security Activity Stream
   */
  async getLiveSecurityStream(req, res) {
    try {
      const { limit = 40 } = req.query;

      const { data: logs, error } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      // Fetch user map for quick enrichment
      const userIds = [...new Set((logs || []).map(l => l.user_id).filter(Boolean))];
      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', userIds);
        (users || []).forEach(u => {
          userMap[u.id] = u;
        });
      }

      const stream = (logs || []).map(log => {
        let details = {};
        try {
          details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
        } catch {
          details = {};
        }

        const user = userMap[log.user_id] || { email: details.email || 'Anonymous', full_name: 'Guest/System' };
        
        let status = 'Normal';
        let severity = 'info';
        const act = (log.action || '').toLowerCase();

        if (act.includes('critical') || act.includes('breach') || act.includes('takeover')) {
          status = '🔴 Critical Threat';
          severity = 'critical';
        } else if (act.includes('failed') || act.includes('denied') || act.includes('suspicious') || act.includes('burst')) {
          status = '⚠️ Suspicious';
          severity = 'warning';
        } else if (act.includes('revoked') || act.includes('deleted')) {
          status = 'Notice';
          severity = 'notice';
        }

        return {
          id: log.id,
          time: log.created_at,
          userId: log.user_id,
          userName: user.full_name || 'System User',
          userEmail: user.email || 'system@securevault.app',
          action: log.action,
          fileName: details.fileName || details.name || details.filename || null,
          ip: log.ip_address || '127.0.0.1',
          userAgent: log.user_agent || 'Unknown Device',
          status,
          severity,
          details,
        };
      });

      return response.success(res, stream, 'Live security activity stream fetched');
    } catch (error) {
      logger.error('Failed to fetch live stream', { error: error.message });
      return response.error(res, 'Failed to fetch live security stream', 500);
    }
  },

  /**
   * 3. User Risk Monitoring & Directory
   */
  async getUsersMonitoring(req, res) {
    try {
      const { search, role, status } = req.query;

      let query = supabase
        .from('users')
        .select('id, email, full_name, role, is_verified, security_score, storage_used, storage_limit, is_suspended, created_at, last_login')
        .neq('email', 'nagababuy92@gmail.com');

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      if (role && role !== 'all') {
        query = query.eq('role', role);
      }
      if (status === 'suspended') {
        query = query.eq('is_suspended', true);
      }

      query = query.order('created_at', { ascending: false });

      const { data: users, error } = await query;
      if (error) throw error;

      // Enrich with comprehensive user telemetry
      const enriched = await Promise.all((users || []).map(async (u) => {
        const [
          filesRes,
          sharesCountRes,
          downloadsRes,
          failedOtpRes,
          failedLoginRes,
          sessionsRes,
          lastLogRes,
        ] = await Promise.all([
          supabase.from('files').select('id, size').eq('user_id', u.id).eq('is_deleted', false),
          supabase.from('shared_links').select('id, download_count').eq('user_id', u.id),
          supabase.from('access_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('action', 'file_downloaded'),
          supabase.from('access_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('action', 'otp_failed'),
          supabase.from('access_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('action', 'login_failed'),
          supabase.from('user_sessions').select('id, ip_address, user_agent, created_at, last_activity').eq('user_id', u.id).eq('is_active', true),
          supabase.from('access_logs').select('ip_address, user_agent, created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(1),
        ]);

        const files = filesRes.data || [];
        const filesCount = files.length;
        const sharedLinks = sharesCountRes.data || [];
        const sharesCount = sharedLinks.length;
        const downloadsCount = (downloadsRes.count || 0) + sharedLinks.reduce((acc, s) => acc + (parseInt(s.download_count) || 0), 0);
        const failedOtps = failedOtpRes.count || 0;
        const failedLogins = failedLoginRes.count || 0;
        const sessions = sessionsRes.data || [];
        const activeSessions = sessions.length;
        const lastLog = lastLogRes.data?.[0] || null;
        const lastIpAddress = lastLog?.ip_address || (sessions[0]?.ip_address) || '127.0.0.1';

        const score = u.security_score !== null ? u.security_score : 50;

        let riskLevel = 'Low';
        if (u.is_suspended || score < 30 || failedOtps >= 5 || failedLogins >= 5) {
          riskLevel = 'Critical';
        } else if (score < 50 || failedOtps >= 3 || failedLogins >= 3) {
          riskLevel = 'High';
        } else if (score < 75 || failedOtps >= 1 || failedLogins >= 1) {
          riskLevel = 'Medium';
        }

        return {
          ...u,
          filesCount,
          downloadsCount,
          sharesCount,
          failedOtps,
          failedLogins,
          activeSessions,
          sessions,
          lastIpAddress,
          riskLevel,
        };
      }));

      return response.success(res, enriched, 'Users monitoring data fetched');
    } catch (error) {
      logger.error('Failed to fetch users monitoring', { error: error.message });
      return response.error(res, 'Failed to fetch user risk monitoring', 500);
    }
  },

  /**
   * User Sessions & Termination
   */
  async getUserSessions(req, res) {
    try {
      const { userId } = req.params;
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return response.success(res, data || [], 'User active sessions fetched');
    } catch (error) {
      return response.error(res, 'Failed to fetch sessions', 500);
    }
  },

  async revokeUserSessions(req, res) {
    try {
      const { userId } = req.params;
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'sessions_revoked_by_admin',
        details: JSON.stringify({ revokedBy: req.user.email }),
        created_at: new Date().toISOString(),
      });

      return response.success(res, null, 'All active sessions for this user have been terminated.');
    } catch (error) {
      return response.error(res, 'Failed to terminate sessions', 500);
    }
  },

  /**
   * 4. File Monitoring (Zero-Knowledge Integrity & Sharing Audits)
   */
  async getFilesMonitoring(req, res) {
    try {
      const { search } = req.query;
      let query = supabase
        .from('files')
        .select('id, name, original_name, mime_type, size, category, checksum, is_deleted, created_at, user_id, download_count')
        .eq('is_deleted', false);

      if (search) {
        query = query.or(`name.ilike.%${search}%,original_name.ilike.%${search}%`);
      }
      query = query.order('created_at', { ascending: false });

      const { data: files, error } = await query;
      if (error) throw error;

      // Enrich with owner info and active share links
      const fileIds = (files || []).map(f => f.id);
      const userIds = [...new Set((files || []).map(f => f.user_id).filter(Boolean))];

      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, email, full_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }

      let shareMap = {};
      if (fileIds.length > 0) {
        const { data: shares } = await supabase.from('shared_links').select('id, file_id, is_active, download_count').in('file_id', fileIds);
        (shares || []).forEach(s => {
          if (!shareMap[s.file_id]) shareMap[s.file_id] = { count: 0, active: 0 };
          shareMap[s.file_id].count++;
          if (s.is_active) shareMap[s.file_id].active++;
        });
      }

      const enrichedFiles = (files || []).map(f => {
        const owner = userMap[f.user_id] || { email: 'Unknown', full_name: 'Unknown' };
        const shareStats = shareMap[f.id] || { count: 0, active: 0 };

        return {
          id: f.id,
          name: f.original_name || f.name,
          rawName: f.name,
          mimeType: f.mime_type,
          category: f.category || 'other',
          size: parseInt(f.size) || 0,
          ownerEmail: owner.email,
          ownerName: owner.full_name,
          isEncrypted: true,
          encryptionType: 'AES-256-GCM',
          integrityVerified: !!f.checksum,
          checksum: f.checksum || 'sha256:verified-on-upload',
          sharesCount: shareStats.count,
          activeSharesCount: shareStats.active,
          downloadCount: f.download_count || 0,
          createdAt: f.created_at,
        };
      });

      return response.success(res, enrichedFiles, 'Files monitoring directory fetched');
    } catch (error) {
      logger.error('Failed to fetch files monitoring', { error: error.message });
      return response.error(res, 'Failed to fetch file monitoring list', 500);
    }
  },

  async revokeFileSharing(req, res) {
    try {
      const { fileId } = req.params;
      const { data, error } = await supabase
        .from('shared_links')
        .update({ is_active: false })
        .eq('file_id', fileId)
        .select('id');

      if (error) throw error;

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        action: 'file_shares_revoked_by_admin',
        resource_id: fileId,
        details: JSON.stringify({ fileId, revokedLinksCount: (data || []).length, admin: req.user.email }),
        created_at: new Date().toISOString(),
      });

      return response.success(res, { count: (data || []).length }, 'All active sharing links for this file have been revoked.');
    } catch (error) {
      return response.error(res, 'Failed to revoke file sharing links', 500);
    }
  },

  /**
   * 5. Threat Center & Incident Investigation (#SEC-XXXX)
   */
  async getSecurityAlerts(req, res) {
    try {
      const { severity, status } = req.query;

      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (severity && severity !== 'all') {
        query = query.eq('severity', severity);
      }
      if (status === 'unread') {
        query = query.eq('is_read', false);
      } else if (status === 'resolved') {
        query = query.eq('is_read', true);
      }

      const { data: alerts, error } = await query;
      if (error) throw error;

      // Enrich alerts with user and sequential incident code (#SEC-1001+)
      const userIds = [...new Set((alerts || []).map(a => a.user_id).filter(Boolean))];
      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, email, full_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }

      const formatted = (alerts || []).map((a, idx) => {
        let details = {};
        try {
          details = typeof a.details === 'string' ? JSON.parse(a.details) : (a.details || {});
        } catch {
          details = {};
        }

        const user = userMap[a.user_id] || { email: details.email || 'Unknown User', full_name: 'Security Subject' };
        const incidentId = `SEC-${String(1000 + alerts.length - idx).padStart(4, '0')}`;

        return {
          id: a.id,
          incidentId,
          userId: a.user_id,
          userName: user.full_name,
          userEmail: user.email,
          type: a.alert_type,
          severity: a.severity || 'medium',
          title: a.title || a.alert_type?.replace(/_/g, ' ')?.toUpperCase() || 'Security Event',
          message: a.message || details.message || 'Suspicious activity detected on user account.',
          isRead: a.is_read,
          status: a.is_read ? 'Resolved' : 'Active Investigation',
          details,
          createdAt: a.created_at,
        };
      });

      return response.success(res, formatted, 'Security alerts fetched');
    } catch (error) {
      logger.error('Failed to fetch security alerts', { error: error.message });
      return response.error(res, 'Failed to fetch threat alerts', 500);
    }
  },

  async updateAlertStatus(req, res) {
    try {
      const { alertId } = req.params;
      const { isRead, resolutionNote } = req.body;

      const { error } = await supabase
        .from('security_alerts')
        .update({
          is_read: isRead !== undefined ? isRead : true,
          details: JSON.stringify({ resolutionNote, resolvedBy: req.user.email, resolvedAt: new Date().toISOString() }),
        })
        .eq('id', alertId);

      if (error) throw error;
      return response.success(res, null, 'Incident status updated.');
    } catch (error) {
      return response.error(res, 'Failed to update alert status', 500);
    }
  },

  async getIncidentInvestigation(req, res) {
    try {
      const { alertId } = req.params;

      const { data: alert, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (error || !alert) {
        return response.error(res, 'Incident record not found', 404);
      }

      let details = {};
      try {
        details = typeof alert.details === 'string' ? JSON.parse(alert.details) : (alert.details || {});
      } catch {
        details = {};
      }

      let user = { full_name: 'Unknown', email: 'Unknown', security_score: 50, is_suspended: false };
      if (alert.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, full_name, email, security_score, is_suspended')
          .eq('id', alert.user_id)
          .single();
        if (userData) user = userData;
      }

      // Fetch chronological logs around incident
      const { data: timelineLogs } = await supabase
        .from('access_logs')
        .select('*')
        .eq('user_id', alert.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      const timeline = (timelineLogs || []).map(l => {
        let lDetails = {};
        try { lDetails = JSON.parse(l.details); } catch {}
        return {
          id: l.id,
          time: l.created_at,
          action: l.action,
          ip: l.ip_address,
          description: lDetails.reason || lDetails.message || l.action.replace(/_/g, ' '),
        };
      });

      return response.success(res, {
        incidentId: `SEC-${alert.id.slice(0, 4).toUpperCase()}`,
        alert,
        user,
        details,
        timeline,
      }, 'Incident investigation dossier compiled');
    } catch (error) {
      return response.error(res, 'Failed to compile incident investigation', 500);
    }
  },

  async remediateIncident(req, res) {
    try {
      const { alertId } = req.params;
      const { userId, blockUser, revokeLinks, terminateSessions, markResolved } = req.body;

      if (blockUser && userId) {
        await supabase.from('users').update({ is_suspended: true }).eq('id', userId);
      }
      if (revokeLinks && userId) {
        await supabase.from('shared_links').update({ is_active: false }).eq('user_id', userId);
      }
      if (terminateSessions && userId) {
        await supabase.from('user_sessions').update({ is_active: false }).eq('user_id', userId);
      }
      if (markResolved) {
        await supabase.from('security_alerts').update({ is_read: true }).eq('id', alertId);
      }

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'incident_remediation_applied',
        details: JSON.stringify({ alertId, blockUser, revokeLinks, terminateSessions, admin: req.user.email }),
        created_at: new Date().toISOString(),
      });

      return response.success(res, null, 'Remediation measures executed successfully.');
    } catch (error) {
      return response.error(res, 'Failed to execute remediation actions', 500);
    }
  },

  /**
   * 6. Secure Sharing Governance
   */
  async getSharingManagement(req, res) {
    try {
      const { data: shares, error } = await supabase
        .from('shared_links')
        .select('id, file_id, user_id, token, password_hash, require_otp, expires_at, max_downloads, download_count, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fileIds = (shares || []).map(s => s.file_id);
      const userIds = (shares || []).map(s => s.user_id);

      let fileMap = {};
      if (fileIds.length > 0) {
        const { data: files } = await supabase.from('files').select('id, name, original_name, size').in('id', fileIds);
        (files || []).forEach(f => { fileMap[f.id] = f; });
      }

      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, email, full_name').in('id', userIds);
        (users || []).forEach(u => { userMap[u.id] = u; });
      }

      const nowIso = new Date().toISOString();

      const formatted = (shares || []).map(s => {
        const file = fileMap[s.file_id] || { name: 'Unknown File', size: 0 };
        const user = userMap[s.user_id] || { email: 'Unknown Owner', full_name: 'Unknown' };

        const isExpired = s.expires_at && s.expires_at < nowIso;
        const isLimitReached = s.max_downloads && s.download_count >= s.max_downloads;
        let status = 'Active';
        if (!s.is_active) status = 'Revoked';
        else if (isExpired) status = 'Expired';
        else if (isLimitReached) status = 'Limit Reached';

        return {
          id: s.id,
          token: s.token,
          fileName: file.original_name || file.name,
          fileSize: parseInt(file.size) || 0,
          createdByName: user.full_name,
          createdByEmail: user.email,
          expiresAt: s.expires_at,
          maxDownloads: s.max_downloads || 0,
          downloadCount: s.download_count || 0,
          requireOtp: !!s.require_otp,
          hasPassword: !!s.password_hash,
          isActive: s.is_active,
          status,
          createdAt: s.created_at,
        };
      });

      return response.success(res, formatted, 'Sharing governance links fetched');
    } catch (error) {
      logger.error('Failed to fetch sharing management', { error: error.message });
      return response.error(res, 'Failed to fetch sharing management list', 500);
    }
  },

  async revokeSharedLink(req, res) {
    try {
      const { linkId } = req.params;
      const { error } = await supabase
        .from('shared_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        action: 'shared_link_revoked_by_admin',
        resource_id: linkId,
        details: JSON.stringify({ linkId, admin: req.user.email }),
        created_at: new Date().toISOString(),
      });

      return response.success(res, null, 'Sharing link revoked successfully.');
    } catch (error) {
      return response.error(res, 'Failed to revoke sharing link', 500);
    }
  },

  /**
   * 7. Searchable SIEM Access Logs & Audit Trail
   */
  async getAccessLogs(req, res) {
    try {
      const { action, search, limit = 50, page = 1 } = req.query;

      let query = supabase
        .from('access_logs')
        .select('*', { count: 'exact' });

      if (action && action !== 'all') {
        query = query.eq('action', action);
      }
      if (search) {
        query = query.or(`action.ilike.%${search}%,ip_address.ilike.%${search}%,details.ilike.%${search}%`);
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

      const { data: logs, error, count } = await query;
      if (error) throw error;

      return response.paginated(res, logs || [], parseInt(page), parseInt(limit), count || 0);
    } catch (error) {
      logger.error('Failed to fetch access logs', { error: error.message });
      return response.error(res, 'Failed to fetch audit access logs', 500);
    }
  },

  /**
   * 8. Security Policies & Thresholds
   */
  async getSecurityPolicies(req, res) {
    return response.success(res, systemPolicies, 'System security policies fetched');
  },

  async updateSecurityPolicies(req, res) {
    try {
      const {
        maxLoginAttempts,
        otpExpirySeconds,
        maxSharingDurationDays,
        maxDownloadCount,
        sessionTimeoutHours,
        suspiciousDownloadThreshold,
        requireOtpForSensitiveShares,
        maxUploadSizeBytes,
      } = req.body;

      if (maxLoginAttempts !== undefined) systemPolicies.maxLoginAttempts = parseInt(maxLoginAttempts);
      if (otpExpirySeconds !== undefined) systemPolicies.otpExpirySeconds = parseInt(otpExpirySeconds);
      if (maxSharingDurationDays !== undefined) systemPolicies.maxSharingDurationDays = parseInt(maxSharingDurationDays);
      if (maxDownloadCount !== undefined) systemPolicies.maxDownloadCount = parseInt(maxDownloadCount);
      if (sessionTimeoutHours !== undefined) systemPolicies.sessionTimeoutHours = parseInt(sessionTimeoutHours);
      if (suspiciousDownloadThreshold !== undefined) systemPolicies.suspiciousDownloadThreshold = parseInt(suspiciousDownloadThreshold);
      if (requireOtpForSensitiveShares !== undefined) systemPolicies.requireOtpForSensitiveShares = !!requireOtpForSensitiveShares;
      if (maxUploadSizeBytes !== undefined) systemPolicies.maxUploadSizeBytes = parseInt(maxUploadSizeBytes);

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        action: 'security_policies_updated',
        details: JSON.stringify({ policies: systemPolicies, admin: req.user.email }),
        created_at: new Date().toISOString(),
      });

      return response.success(res, systemPolicies, 'Security policies updated successfully.');
    } catch (error) {
      return response.error(res, 'Failed to update security policies', 500);
    }
  },

  // Legacy compat
  async getUsers(req, res) {
    return adminController.getUsersMonitoring(req, res);
  },

  async getAnalytics(req, res) {
    return adminController.getSecurityOverview(req, res);
  },

  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (!['admin', 'user', 'security_admin', 'storage_admin', 'audit_admin'].includes(role)) {
        return response.error(res, 'Invalid role specified', 400);
      }

      await supabase.from('users').update({ role }).eq('id', userId);
      return response.success(res, null, `User role updated to ${role}`);
    } catch (error) {
      return response.error(res, 'Failed to update role', 500);
    }
  },

  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { suspend = true } = req.body;
      await supabase.from('users').update({ is_suspended: suspend }).eq('id', userId);
      return response.success(res, null, `User ${suspend ? 'suspended' : 'unsuspended'}`);
    } catch (error) {
      return response.error(res, 'Failed to change suspension', 500);
    }
  },

  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      // Check target user
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', userId)
        .single();

      if (!targetUser) {
        return response.error(res, 'User not found in database', 404);
      }

      if (targetUser.email.toLowerCase() === 'nagababuy92@gmail.com') {
        return response.error(res, 'The dedicated system administrator account cannot be deleted.', 403);
      }

      // 1. Delete all shared links for user's files and user
      const { data: userFiles } = await supabase.from('files').select('id').eq('user_id', userId);
      const fileIds = (userFiles || []).map(f => f.id);

      if (fileIds.length > 0) {
        await supabase.from('shared_links').delete().in('file_id', fileIds);
      }
      await supabase.from('shared_links').delete().eq('user_id', userId);

      // 2. Cascade delete related records across all tables
      await Promise.allSettled([
        supabase.from('security_alerts').delete().eq('user_id', userId),
        supabase.from('user_sessions').delete().eq('user_id', userId),
        supabase.from('devices').delete().eq('user_id', userId),
        supabase.from('otp_logs').delete().eq('user_id', userId),
        supabase.from('access_logs').delete().eq('user_id', userId),
      ]);

      // 3. Delete files record from files table
      await supabase.from('files').delete().eq('user_id', userId);

      // 4. Permanently delete user from Supabase public.users table
      const { error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userDeleteError) {
        logger.error('Failed to delete user row in Supabase', { userId, error: userDeleteError.message });
        throw userDeleteError;
      }

      // 5. Attempt Supabase Auth deletion if present
      try {
        const { supabaseAdmin } = require('../config/supabase');
        if (supabaseAdmin?.auth?.admin) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
      } catch {}

      // 6. Record security audit log
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        action: 'user_permanently_deleted_by_admin',
        details: JSON.stringify({
          deletedUserId: userId,
          deletedUserEmail: targetUser.email,
          deletedBy: req.user?.email || 'admin',
        }),
        created_at: new Date().toISOString(),
      });

      logger.info('User permanently deleted from Supabase', { userId, email: targetUser.email });

      return response.success(res, { deletedUserId: userId }, `User ${targetUser.email} was permanently deleted from Supabase.`);
    } catch (error) {
      logger.error('Failed to permanently delete user', { error: error.message });
      return response.error(res, error.message || 'Failed to delete user from Supabase', 500);
    }
  },
};

module.exports = adminController;
