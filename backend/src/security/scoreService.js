const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const scoreService = {
  /**
   * Determine score status based on standard scale
   * @param {number} score 
   */
  calculateSecurityStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Secure';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Risky';
    return 'Critical';
  },

  /**
   * Central security score modifier
   */
  async updateSecurityScore(userId, delta, eventType, details = {}) {
    try {
      // 1. Fetch current score
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('security_score')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        logger.warn('Failed to fetch user score', { userId, error: fetchError?.message });
        return null;
      }

      const currentScore = user.security_score !== null ? user.security_score : 50;
      
      // Calculate new score with absolute boundaries [0, 100]
      const newScore = Math.max(0, Math.min(100, currentScore + delta));

      if (newScore === currentScore) {
        return currentScore; // No visual change
      }

      // 2. Prevent infinite farming spam for high-frequency actions (like fast encrypted uploads)
      if (delta > 0 && (eventType === 'file_upload' || eventType === 'otp_verification')) {
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
        const { data: recentLogs } = await supabase
          .from('access_logs')
          .select('details')
          .eq('user_id', userId)
          .eq('action', 'security_score_increase')
          .gte('created_at', tenSecondsAgo);

        if (recentLogs && recentLogs.length >= 3) {
          // Limit to max 3 increases per 10 seconds to block script farms
          logger.info('Score update throttled to prevent duplicate spam farming', { userId, eventType });
          return currentScore;
        }
      }

      // 3. Update the users table
      const { error: updateError } = await supabase
        .from('users')
        .update({ security_score: newScore })
        .eq('id', userId);

      if (updateError) throw updateError;

      // 4. Log the score update inside access_logs
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: delta > 0 ? 'security_score_increase' : 'security_score_decrease',
        details: JSON.stringify({
          eventType,
          delta,
          previousScore: currentScore,
          newScore,
          ...details
        }),
        created_at: new Date().toISOString(),
      });

      // 5. Auto-generate alerts if score enters Risky or Critical range
      if (newScore < 50 && delta < 0) {
        const severity = newScore < 30 ? 'critical' : 'high';
        await supabase.from('security_alerts').insert({
          id: uuidv4(),
          user_id: userId,
          alert_type: 'low_security_score',
          severity,
          message: `Your Security Score has dropped to a ${severity.toUpperCase()} level (${newScore}/100 - ${this.calculateSecurityStatus(newScore)}) due to recurring suspicious behavior (${eventType.replace(/_/g, ' ')}).`,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      logger.info('Security score updated successfully', { userId, delta, previousScore: currentScore, newScore, eventType });
      return newScore;
    } catch (err) {
      logger.error('Failed to modify user security score', { userId, error: err.message });
      return null;
    }
  },

  async increaseSecurityScore(userId, amount, eventType, details = {}) {
    return this.updateSecurityScore(userId, Math.abs(amount), eventType, details);
  },

  async decreaseSecurityScore(userId, amount, eventType, details = {}) {
    return this.updateSecurityScore(userId, -Math.abs(amount), eventType, details);
  }
};

module.exports = scoreService;
