const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const encryption = require('../utils/encryption');
const otpService = require('../otp/service');
const response = require('../utils/response');
const logger = require('../utils/logger');
const scoreService = require('../security/scoreService');


const sharingController = {
  /**
   * Create a share link
   */
  async createLink(req, res) {
    try {
      const userId = req.user.userId;
      const { fileId, expiresIn, maxDownloads, password, requireOtp } = req.body;

      // Verify file ownership
      const { data: file } = await supabase
        .from('files')
        .select('id, original_name')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (!file) {
        return response.error(res, 'File not found', 404);
      }

      const token = encryption.generateToken(24);
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: link, error } = await supabase
        .from('shared_links')
        .insert({
          id: uuidv4(),
          user_id: userId,
          file_id: fileId,
          token,
          password_hash: password ? encryption.encrypt(password) : null,
          require_otp: requireOtp || false,
          max_downloads: maxDownloads || null,
          download_count: 0,
          expires_at: expiresAt,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // ─── Cybersecurity Trust Score updates ───
      // 1. Reward OTP-protected link creation (+5)
      if (requireOtp) {
        await scoreService.increaseSecurityScore(userId, 5, 'secure_link_with_otp');
      }

      // 2. Reward temporary secure sharing (+3)
      if (expiresIn || maxDownloads) {
        await scoreService.increaseSecurityScore(userId, 3, 'temporary_secure_sharing');
      }

      // 3. Prevent excessive sharing behavior (deduct -15 if user has > 10 active shares)
      const { count: activeSharesCount } = await supabase
        .from('shared_links')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (activeSharesCount && activeSharesCount > 10) {
        await scoreService.decreaseSecurityScore(userId, 15, 'excessive_sharing_behavior');
      }

      logger.info('Share link created', { userId, fileId, token });

      return response.success(res, {
        id: link.id,
        token: link.token,
        expiresAt: link.expires_at,
        maxDownloads: link.max_downloads,
        requireOtp: link.require_otp,
        hasPassword: !!link.password_hash,
      }, 'Share link created', 201);
    } catch (error) {
      logger.error('Share link creation failed', { error: error.message });
      return response.error(res, 'Failed to create share link', 500);
    }
  },

  /**
  /**
   * Request an OTP for accessing an OTP-protected share link.
   * POST /api/share/request-otp/:token
   * Security: OTP is ALWAYS sent to the file owner's registered phone number.
   * Accepts no phone from the request body — prevents phone spoofing attacks.
   * Public endpoint (no auth required    * Public: Request Email OTP for shared link access
    * POST /api/share/request-otp/:token
    * Body: { email? }
    */
  async requestShareOTP(req, res) {
    try {
      const { token } = req.params;
      const { email } = req.body || {};

      const { data: link } = await supabase
        .from('shared_links')
        .select('id, user_id, is_active, expires_at, download_count, max_downloads, require_otp')
        .eq('token', token)
        .single();

      if (!link || !link.is_active) {
        return response.error(res, 'Share link not found or inactive', 404);
      }
      if (new Date(link.expires_at) < new Date()) {
        return response.error(res, 'Share link has expired', 410);
      }
      if (link.max_downloads && link.download_count >= link.max_downloads) {
        return response.error(res, 'Download limit reached', 410);
      }

      // Fetch file owner's email as default
      const { data: owner } = await supabase
        .from('users')
        .select('email')
        .eq('id', link.user_id)
        .single();

      const targetEmail = (email && email.trim()) ? email.trim().toLowerCase() : owner?.email;

      if (!targetEmail || !targetEmail.includes('@')) {
        return response.error(res, 'Please provide a valid email address to receive the OTP.', 400);
      }

      // Generate and send dynamic Email OTP via Gmail SMTP
      const result = await otpService.generateAndSendEmailOTP({
        userId: link.user_id,
        type: 'share_access',
        targetEmail: targetEmail,
        refId: link.id,
      });

      return response.success(res, {
        targetEmail: targetEmail,
        maskedEmail: result.maskedEmail,
        expiresIn: 300,
        resendCooldown: 60,
      }, `OTP sent successfully to ${result.maskedEmail}`);
    } catch (err) {
      if (err.code === 'COOLDOWN') {
        return response.error(res, err.message, 429);
      }
      logger.error('requestShareOTP failed', { error: err.message });
      return response.error(res, err.message || 'Failed to send OTP', 500);
    }
  },

  /**
   * Verify and access shared file.
   * POST /api/share/verify/:token
   * Body: { password?, otp?, otpCode?, email? }
   */
  async verifyLink(req, res) {
    try {
      const { token } = req.params;
      const { password, otp, otpCode, email } = req.body;
      const submittedOtp = (otp || otpCode || '').toString().trim();
      const submittedEmail = (email || '').toString().trim().toLowerCase();

      const { data: link } = await supabase
        .from('shared_links')
        .select('*, files(original_name, size, mime_type, storage_path, hash)')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        return response.error(res, 'Link not found or expired', 404);
      }

      if (new Date(link.expires_at) < new Date()) {
        await supabase.from('shared_links').update({ is_active: false }).eq('id', link.id);
        return response.error(res, 'Link has expired', 410);
      }

      if (link.max_downloads && link.download_count >= link.max_downloads) {
        await supabase.from('shared_links').update({ is_active: false }).eq('id', link.id);
        return response.error(res, 'Download limit reached', 410);
      }

      let authenticated = false;
      let authMethod = 'public';

      // ─── Case 1: Strict OTP Enforced by File Owner (require_otp === true) ───
      if (link.require_otp) {
        if (!submittedOtp) {
          return response.error(res, 'Strict Email OTP verification is enforced for this file. Please request and enter the 6-digit OTP sent to your email.', 401);
        }

        const otpResult = await otpService.verifyOTP({
          userId: link.user_id,
          otpCode: submittedOtp,
          type: 'share_access',
          refId: link.id,
        });

        if (!otpResult.success) {
          return response.error(res, otpResult.reason === 'expired' ? 'OTP expired. Please request a new code.' : 'Invalid verification code.', 400);
        }

        if (link.password_hash) {
          if (!password) {
            return response.error(res, 'OTP verified, but share password is also required.', 401);
          }
          const decryptedPass = encryption.decrypt(link.password_hash);
          if (decryptedPass !== password) {
            return response.error(res, 'Incorrect share password.', 401);
          }
        }

        authenticated = true;
        authMethod = 'email_otp';
      } else {
        // ─── Case 2: Owner did not enforce strict OTP -> Dual Options (Password OR OTP) ───
        
        // Option A: Password
        if (password && link.password_hash) {
          const decryptedPass = encryption.decrypt(link.password_hash);
          if (decryptedPass === password) {
            authenticated = true;
            authMethod = 'password';
          }
        }

        // Option B: OTP
        if (!authenticated && submittedOtp) {
          const otpResult = await otpService.verifyOTP({
            userId: link.user_id,
            otpCode: submittedOtp,
            type: 'share_access',
            refId: link.id,
          });

          if (otpResult.success) {
            authenticated = true;
            authMethod = 'email_otp';
          } else {
            return response.error(res, otpResult.reason === 'expired' ? 'OTP expired. Please request a new code.' : 'Invalid verification code.', 400);
          }
        }

        if (!link.password_hash && !link.require_otp) {
          authenticated = true;
        }

        if (!authenticated) {
          if (password) {
            return response.error(res, 'Incorrect password. You can also verify via Email OTP.', 401);
          }
          return response.error(res, 'Password or Email OTP verification required.', 401);
        }
      }

      return response.success(res, {
        file: link.files,
        authMethod,
        downloadUrl: `${link.files.storage_path}`,
        accessGranted: true,
      }, 'Access granted');
    } catch (error) {
      logger.error('Share link verification failed', { error: error.message });
      return response.error(res, 'Verification failed', 500);
    }
  },

  /**
   * Get user's shared links with full downloader audit trail
   */
  async getLinks(req, res) {
    try {
      const userId = req.user.userId;

      const { data: links, error } = await supabase
        .from('shared_links')
        .select('*, files(original_name, size, mime_type), download_history(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return response.success(res, links.map((l) => {
        const downloads = (l.download_history || []).map((dh) => {
          let email = 'Direct Access';
          let authMethod = 'Public';
          const match = (dh.user_agent || '').match(/\[(?:Downloader:\s*([^|\]]+))?(?:\s*\|\s*)?(?:Auth:\s*([^\]]+))?\]/);
          if (match) {
            if (match[1]) email = match[1].trim();
            if (match[2]) authMethod = match[2].trim();
          }
          return {
            id: dh.id,
            ipAddress: dh.ip_address,
            userAgent: (dh.user_agent || '').replace(/\[Downloader:[^\]]+\]\s*/g, ''),
            downloaderEmail: email,
            authMethod: authMethod,
            downloadedAt: dh.created_at,
          };
        });

        return {
          id: l.id,
          token: l.token,
          fileName: l.files?.original_name,
          fileSize: l.files?.size,
          fileType: l.files?.mime_type,
          downloadCount: l.download_count,
          maxDownloads: l.max_downloads,
          requireOtp: l.require_otp,
          hasPassword: !!l.password_hash,
          isActive: l.is_active,
          expiresAt: l.expires_at,
          createdAt: l.created_at,
          downloads: downloads,
        };
      }));
    } catch (error) {
      return response.error(res, 'Failed to fetch links', 500);
    }
  },

  /**
   * Toggle share link active status
   */
  async toggleLink(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { isActive } = req.body;

      const { data: link, error } = await supabase
        .from('shared_links')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !link) {
        return response.error(res, 'Link not found or update unauthorized', 404);
      }

      logger.info(`Share link toggled`, { linkId: id, isActive });
      return response.success(res, { isActive: link.is_active }, 'Link status updated successfully');
    } catch (error) {
      logger.error('Failed to toggle share link', { error: error.message });
      return response.error(res, 'Failed to update link status', 500);
    }
  },

  /**
   * Public download link with direct decryption (Accepts Password OR Email OTP)
   */
  async downloadLink(req, res) {
    try {
      const { token } = req.params;
      const { password, otp, otpCode, email } = { ...req.query, ...req.body };
      const submittedOtp = (otp || otpCode || '').toString().trim();
      const submittedEmail = (email || '').toString().trim().toLowerCase();
      const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers?.['user-agent'] || 'Unknown Browser';

      const { data: link } = await supabase
        .from('shared_links')
        .select('*, files(original_name, size, mime_type, storage_path, hash), users(email)')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        return res.status(404).send('Share link not found, inactive, or expired.');
      }

      // Check expiry
      if (new Date(link.expires_at) < new Date()) {
        await supabase.from('shared_links').update({ is_active: false }).eq('id', link.id);
        return res.status(410).send('Share link has expired.');
      }

      // Check download limit
      if (link.max_downloads && link.download_count >= link.max_downloads) {
        await supabase.from('shared_links').update({ is_active: false }).eq('id', link.id);
        return res.status(410).send('Download limit has been reached.');
      }

      let authenticated = false;
      let authMethod = 'public_link';
      let verifiedEmail = submittedEmail || null;

      // ─── Case 1: Strict OTP Enforced by File Owner (require_otp === true) ───
      if (link.require_otp) {
        if (!submittedOtp) {
          return res.status(401).send('Strict Email OTP verification is enforced for this file. Please request and enter the 6-digit code sent to your email.');
        }

        const otpResult = await otpService.verifyOTP({
          userId: link.user_id,
          otpCode: submittedOtp,
          type: 'share_access',
          refId: link.id,
        });

        if (!otpResult.success) {
          return res.status(401).send(otpResult.reason === 'expired' ? 'OTP code expired. Please request a new code.' : 'Invalid OTP verification code.');
        }

        if (link.password_hash) {
          if (!password) {
            return res.status(401).send('OTP verified, but share password is also required.');
          }
          const decryptedPass = encryption.decrypt(link.password_hash);
          if (decryptedPass !== password) {
            return res.status(401).send('Incorrect share password.');
          }
        }

        authenticated = true;
        authMethod = 'email_otp';

        if (!verifiedEmail) {
          const { data: recentOtp } = await supabase
            .from('otp_logs')
            .select('target_phone')
            .eq('ref_id', link.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (recentOtp?.target_phone) {
            verifiedEmail = recentOtp.target_phone;
          }
        }
      } else {
        // ─── Case 2: Owner did not enforce strict OTP -> Dual Options (Password OR OTP) ───
        
        // Option A: Password
        if (password && link.password_hash) {
          const decryptedPass = encryption.decrypt(link.password_hash);
          if (decryptedPass === password) {
            authenticated = true;
            authMethod = 'password';
          }
        }

        // Option B: OTP
        if (!authenticated && submittedOtp) {
          const otpResult = await otpService.verifyOTP({
            userId: link.user_id,
            otpCode: submittedOtp,
            type: 'share_access',
            refId: link.id,
          });

          if (otpResult.success) {
            authenticated = true;
            authMethod = 'email_otp';
            if (!verifiedEmail) {
              const { data: recentOtp } = await supabase
                .from('otp_logs')
                .select('target_phone')
                .eq('ref_id', link.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              if (recentOtp?.target_phone) {
                verifiedEmail = recentOtp.target_phone;
              }
            }
          } else {
            return res.status(401).send(otpResult.reason === 'expired' ? 'OTP code expired. Please request a new code.' : 'Invalid OTP verification code.');
          }
        }

        if (!link.password_hash && !link.require_otp) {
          authenticated = true;
        }

        if (!authenticated) {
          if (password) {
            return res.status(401).send('Incorrect link password. You can also verify with Email OTP.');
          }
          return res.status(401).send('Verification required. Enter password or verify with Email OTP.');
        }
      }

      // Increment download count
      await supabase
        .from('shared_links')
        .update({ download_count: link.download_count + 1 })
        .eq('id', link.id);

      // Downloader details string
      const downloaderTag = verifiedEmail 
        ? `[Downloader: ${verifiedEmail} | Auth: ${authMethod}] ` 
        : `[Downloader: Anonymous | Auth: ${authMethod}] `;

      // Log download into download_history
      await supabase.from('download_history').insert({
        id: uuidv4(),
        shared_link_id: link.id,
        file_id: link.file_id,
        ip_address: String(ipAddress),
        user_agent: `${downloaderTag}${userAgent}`,
        created_at: new Date().toISOString(),
      });

      // Log into access_logs
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: link.user_id,
        action: 'shared_file_download',
        resource_id: link.file_id,
        ip_address: String(ipAddress),
        user_agent: userAgent,
        details: JSON.stringify({
          linkId: link.id,
          token: link.token,
          fileName: link.files?.original_name,
          downloaderEmail: verifiedEmail || 'anonymous_password_user',
          authMethod,
          timestamp: new Date().toISOString(),
        }),
        created_at: new Date().toISOString(),
      });

      // Self-destruct if max downloads reached
      if (link.max_downloads && link.download_count + 1 >= link.max_downloads) {
        await supabase.from('shared_links').update({ is_active: false }).eq('id', link.id);
      }

      // Download and decrypt actual file from Supabase storage
      const { data: storageBlob, error: downloadError } = await supabase.storage
        .from('encrypted-files')
        .download(link.files.storage_path);

      if (downloadError || !storageBlob) {
        throw new Error(downloadError ? downloadError.message : 'Storage file not found');
      }

      const arrayBuffer = await storageBlob.arrayBuffer();
      const encryptedString = Buffer.from(arrayBuffer).toString();
      const decryptedBase64 = encryption.decrypt(encryptedString);
      if (!decryptedBase64) {
        throw new Error('Decryption failed');
      }
      const decryptedBuffer = Buffer.from(decryptedBase64, 'base64');

      // Verify file integrity using SHA-256
      if (link.files.hash && !encryption.verifyHash(decryptedBuffer, link.files.hash)) {
        logger.error('File integrity verification failed during shared download (possible tampering)', { linkId: link.id, fileId: link.file_id });
        return res.status(400).send('File integrity verification failed. The decrypted content does not match the original hash.');
      }

      res.setHeader('Content-Type', link.files.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${link.files.original_name}"`);
      res.setHeader('Content-Length', decryptedBuffer.length);

      return res.send(decryptedBuffer);
    } catch (error) {
      logger.error('Shared download failed', { error: error.message });
      return res.status(500).send('An error occurred during file decryption and download.');
    }
  },

  /**
   * Render premium browser view for shared links
   */
  async viewLink(req, res) {
    try {
      const { token } = req.params;

      const { data: link } = await supabase
        .from('shared_links')
        .select('*, files(original_name, size, mime_type), users(email, full_name)')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        return res.status(404).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Link Not Found - SecureVault</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { background: #1e293b; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; }
  </style>
</head>
<body>
  <div class="box">
    <h1 style="font-size: 24px; margin-bottom: 8px;">🔒 Link Expired or Not Found</h1>
    <p style="color: #94a3b8; font-size: 14px;">This secure share link is inactive or has reached its download limit.</p>
  </div>
</body>
</html>
        `);
      }

      const fileName = link.files.original_name;
      const fileSize = (link.files.size / 1024 / 1024).toFixed(2) + ' MB';
      const ownerEmail = link.users?.email || '';
      const isStrictOtp = !!link.require_otp;
      const hasPassword = !!link.password_hash;

      // Serve high-grade, interactive HTML interface
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SecureVault - Secure File Share</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient-start: #0f172a;
      --bg-gradient-end: #020617;
      --card-bg: rgba(30, 41, 59, 0.85);
      --card-border: rgba(255, 255, 255, 0.12);
      --primary: #10b981;
      --primary-hover: #059669;
      --text: #f8fafc;
      --text-secondary: #94a3b8;
      --error: #ef4444;
      --success: #10b981;
      --accent: #3b82f6;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', sans-serif;
    }
    
    body {
      background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      width: 100%;
      max-width: 490px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 36px 30px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    
    .logo-container {
      width: 60px;
      height: 60px;
      background: rgba(16, 185, 129, 0.15);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px auto;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .logo-icon {
      font-size: 28px;
    }
    
    h1 {
      font-size: 23px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    
    .subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 22px;
    }
    
    .file-card {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 22px;
      display: flex;
      align-items: center;
      text-align: left;
    }
    
    .file-icon {
      font-size: 28px;
      margin-right: 14px;
    }
    
    .file-details {
      flex: 1;
      overflow: hidden;
    }
    
    .file-name {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 3px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    
    .file-size {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .security-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 100px;
      margin-left: auto;
    }

    .tab-bar {
      display: flex;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 22px;
      gap: 4px;
    }

    .tab-btn {
      flex: 1;
      padding: 11px 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      user-select: none;
    }

    .tab-btn.active {
      background: var(--primary) !important;
      color: #FFFFFF !important;
      box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
    }
    
    .form-group {
      text-align: left;
      margin-bottom: 18px;
    }
    
    label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    input {
      width: 100%;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 14px 16px;
      color: var(--text);
      font-size: 15px;
      outline: none;
      transition: all 0.2s ease;
    }
    
    input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    }

    .otp-send-box {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.22);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 18px;
      text-align: left;
    }

    .otp-send-btn {
      width: 100%;
      background: #3b82f6;
      color: #FFFFFF;
      border: none;
      border-radius: 10px;
      padding: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
    }

    .otp-send-btn:hover {
      background: #2563eb;
    }
    
    .btn {
      width: 100%;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 15px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .btn:hover {
      background: var(--primary-hover);
    }
    
    .error-msg {
      color: #fca5a5;
      font-size: 13px;
      margin-top: 14px;
      display: none;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 11px;
      text-align: left;
    }

    .success-msg {
      color: #86efac;
      font-size: 13px;
      margin-top: 14px;
      display: none;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 11px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <span class="logo-icon">🛡️</span>
    </div>
    <h1>Secure Share Access</h1>
    <p class="subtitle" id="pageSubtitle">
      ${isStrictOtp 
        ? 'Email OTP verification is required to decrypt this file' 
        : (hasPassword ? 'Authenticate with Password or Email OTP to decrypt' : 'Verify via Email OTP to decrypt')}
    </p>
    
    <div class="file-card">
      <span class="file-icon">📄</span>
      <div class="file-details">
        <div class="file-name">${fileName}</div>
        <div class="file-size">${fileSize}</div>
      </div>
      <span class="security-badge">AES-256</span>
    </div>

    ${isStrictOtp ? `
    <!-- Strict OTP Enforcement Alert -->
    <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 12px 14px; margin-bottom: 22px; font-size: 12px; color: #fca5a5; font-weight: 600; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <span>🔒</span>
      <span>Strict 2FA Email OTP Verification Required</span>
    </div>
    ` : `
    <!-- Dual Auth Mode Switcher (When OTP not strictly enforced) -->
    <div class="tab-bar">
      <button type="button" class="tab-btn active" id="tabOtpBtn">
        ✉️ Verify via Email OTP
      </button>
      <button type="button" class="tab-btn" id="tabPasswordBtn">
        🔑 Use Password
      </button>
    </div>
    `}

    <!-- Section 1: Email OTP Auth -->
    <div id="otpSection" style="display: block;">
      <div class="otp-send-box">
        <div style="font-size: 13px; color: var(--text); font-weight: 600; margin-bottom: 4px;">Step 1: Request 6-Digit Email Code</div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
          Authorized destination email (Locked by File Owner):
        </div>
        <input 
          type="email" 
          id="emailInput" 
          value="${ownerEmail}" 
          readonly 
          style="margin-bottom: 4px; font-size: 14px; background: rgba(15, 23, 42, 0.5); color: #cbd5e1; cursor: not-allowed; border-color: rgba(255, 255, 255, 0.15);"
        >
        <div style="font-size: 11px; color: #64748b; margin-bottom: 10px; display: flex; align-items: center; gap: 4px;">
          <span>🔒</span>
          <span>Security Lock: OTP is strictly routed to the verified owner email</span>
        </div>
        <button type="button" class="otp-send-btn" id="sendOtpBtn">
          ✉️ Send 6-Digit Code to Email
        </button>
        <div style="font-size: 11px; color: var(--success); margin-top: 8px; display: none;" id="otpStatusDesc"></div>
      </div>

      <form id="otpForm">
        ${(isStrictOtp && hasPassword) ? `
        <div class="form-group" style="margin-bottom: 16px;">
          <label for="strictPasswordInput">Link Password (Required by Owner)</label>
          <input type="password" id="strictPasswordInput" placeholder="Enter share link password" autocomplete="current-password">
        </div>
        ` : ''}

        <div class="form-group">
          <label for="otpInput">Step 2: Enter 6-Digit OTP Code</label>
          <input type="text" id="otpInput" placeholder="000000" maxlength="6" style="text-align: center; letter-spacing: 8px; font-size: 20px; font-weight: bold;">
        </div>
        <button type="submit" class="btn" id="otpSubmitBtn">
          <span>🔓 Verify OTP & Decrypt File</span>
        </button>
      </form>
    </div>
    
    <!-- Section 2: Password Auth -->
    <div id="passwordSection" style="display: none;">
      <form id="passwordForm">
        <div class="form-group">
          <label for="passwordInput">Enter File Share Password</label>
          <input type="password" id="passwordInput" placeholder="Enter share link password" autocomplete="current-password" style="font-size: 15px;">
        </div>
        <button type="submit" class="btn" id="passwordSubmitBtn">
          <span>🔓 Decrypt & Download with Password</span>
        </button>
      </form>
    </div>

    <div class="error-msg" id="errorDiv"></div>
    <div class="success-msg" id="successDiv"></div>
  </div>

  <script>
    (function() {
      function selectTab(mode) {
        var tabPasswordBtn = document.getElementById('tabPasswordBtn');
        var tabOtpBtn = document.getElementById('tabOtpBtn');
        var passwordSection = document.getElementById('passwordSection');
        var otpSection = document.getElementById('otpSection');
        var errorDiv = document.getElementById('errorDiv');
        var successDiv = document.getElementById('successDiv');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';

        if (mode === 'password') {
          if (tabPasswordBtn) tabPasswordBtn.className = 'tab-btn active';
          if (tabOtpBtn) tabOtpBtn.className = 'tab-btn';
          if (passwordSection) passwordSection.style.display = 'block';
          if (otpSection) otpSection.style.display = 'none';
          var pwdInput = document.getElementById('passwordInput');
          if (pwdInput) pwdInput.focus();
        } else {
          if (tabOtpBtn) tabOtpBtn.className = 'tab-btn active';
          if (tabPasswordBtn) tabPasswordBtn.className = 'tab-btn';
          if (passwordSection) passwordSection.style.display = 'none';
          if (otpSection) otpSection.style.display = 'block';
          var otpInput = document.getElementById('otpInput');
          if (otpInput) otpInput.focus();
        }
      }

      var tabOtpBtn = document.getElementById('tabOtpBtn');
      if (tabOtpBtn) {
        tabOtpBtn.addEventListener('click', function(e) {
          e.preventDefault();
          selectTab('otp');
        });
      }

      var tabPasswordBtn = document.getElementById('tabPasswordBtn');
      if (tabPasswordBtn) {
        tabPasswordBtn.addEventListener('click', function(e) {
          e.preventDefault();
          selectTab('password');
        });
      }

      var sendOtpBtn = document.getElementById('sendOtpBtn');
      if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async function(e) {
          e.preventDefault();
          var otpStatusDesc = document.getElementById('otpStatusDesc');
          var errorDiv = document.getElementById('errorDiv');
          var successDiv = document.getElementById('successDiv');
          var email = "${ownerEmail}";

          if (errorDiv) errorDiv.style.display = 'none';
          if (successDiv) successDiv.style.display = 'none';

          sendOtpBtn.disabled = true;
          sendOtpBtn.innerText = 'Dispatching OTP to inbox... ⏳';

          try {
            var res = await fetch('/api/share/request-otp/${token}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email })
            });
            var data = await res.json();

            if (!data.success) {
              if (errorDiv) {
                errorDiv.innerText = data.message || 'Failed to dispatch OTP';
                errorDiv.style.display = 'block';
              }
              sendOtpBtn.disabled = false;
              sendOtpBtn.innerText = '✉️ Resend OTP Code';
              return;
            }

            var masked = data.data?.maskedEmail || email;
            if (otpStatusDesc) {
              otpStatusDesc.innerText = '✅ 6-digit code dispatched to ' + masked + ' (valid for 5 mins).';
              otpStatusDesc.style.display = 'block';
            }
            if (successDiv) {
              successDiv.innerText = '✉️ 6-digit code sent! Please check your Inbox (and Spam/Junk folder).';
              successDiv.style.display = 'block';
            }
            sendOtpBtn.innerText = '✉️ Resend Code';
            sendOtpBtn.disabled = false;
            var otpInput = document.getElementById('otpInput');
            if (otpInput) otpInput.focus();
          } catch (err) {
            if (errorDiv) {
              errorDiv.innerText = 'Network error while requesting OTP.';
              errorDiv.style.display = 'block';
            }
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerText = '✉️ Send 6-Digit Code to Email';
          }
        });
      }

      async function executeDownload(paramKey, paramVal, extraEmail, extraPassword, submitBtn, defaultText) {
        var errorDiv = document.getElementById('errorDiv');
        var successDiv = document.getElementById('successDiv');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Verifying & Decrypting File... ⏳';
        }

        try {
          var downloadUrl = '/api/share/download/${token}?' + encodeURIComponent(paramKey) + '=' + encodeURIComponent(paramVal);
          if (extraEmail) {
            downloadUrl += '&email=' + encodeURIComponent(extraEmail);
          }
          if (extraPassword) {
            downloadUrl += '&password=' + encodeURIComponent(extraPassword);
          }

          var res = await fetch(downloadUrl);
          if (!res.ok) {
            var errMsg = await res.text();
            if (errorDiv) {
              errorDiv.innerText = errMsg || 'Access verification failed.';
              errorDiv.style.display = 'block';
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = defaultText;
            }
            return;
          }

          // Single-pass stream conversion: stream directly into file download without making a duplicate request
          var blob = await res.blob();
          var blobUrl = window.URL.createObjectURL(blob);
          var downloadAnchor = document.createElement('a');
          downloadAnchor.style.display = 'none';
          downloadAnchor.href = blobUrl;
          downloadAnchor.download = '${fileName}';
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();

          setTimeout(function() {
            window.URL.revokeObjectURL(blobUrl);
            downloadAnchor.remove();
          }, 2000);

          if (successDiv) {
            successDiv.innerText = '✅ File decrypted & downloaded successfully!';
            successDiv.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '✅ Downloaded Successfully';
          }
        } catch (err) {
          if (errorDiv) {
            errorDiv.innerText = 'Connection error. Please try again.';
            errorDiv.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = defaultText;
          }
        }
      }

      var otpForm = document.getElementById('otpForm');
      if (otpForm) {
        otpForm.addEventListener('submit', function(e) {
          e.preventDefault();
          var otp = (document.getElementById('otpInput')?.value || '').trim();
          var email = "${ownerEmail}";
          var strictPwd = (document.getElementById('strictPasswordInput')?.value || '').trim();

          if (!otp) {
            var errorDiv = document.getElementById('errorDiv');
            if (errorDiv) {
              errorDiv.innerText = 'Please enter the 6-digit OTP code.';
              errorDiv.style.display = 'block';
            }
            return;
          }
          executeDownload('otp', otp, email, strictPwd, document.getElementById('otpSubmitBtn'), '🔓 Verify OTP & Decrypt File');
        });
      }

      var passwordForm = document.getElementById('passwordForm');
      if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
          e.preventDefault();
          var pwd = (document.getElementById('passwordInput')?.value || '').trim();
          if (!pwd) {
            var errorDiv = document.getElementById('errorDiv');
            if (errorDiv) {
              errorDiv.innerText = 'Please enter the share link password.';
              errorDiv.style.display = 'block';
            }
            return;
          }
          executeDownload('password', pwd, null, null, document.getElementById('passwordSubmitBtn'), '🔓 Decrypt & Download with Password');
        });
      }
    })();
  </script>
</body>
</html>
      `);
    } catch (error) {
      return res.status(500).send('Failed to compile access page.');
    }
  }
};

module.exports = sharingController;
