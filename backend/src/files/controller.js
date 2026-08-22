const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { supabase } = require('../config/supabase');
const encryption = require('../utils/encryption');
const response = require('../utils/response');
const logger = require('../utils/logger');
const scoreService = require('../security/scoreService');

const filesController = {
  /**
   * Upload file
   */
  async upload(req, res) {
    try {
      if (!req.file) {
        return response.error(res, 'No file provided', 400);
      }

      const userId = req.user.userId;
      const file = req.file;
      const fileId = uuidv4();
      const fileHash = encryption.generateHash(file.buffer);
      const encryptedName = `${fileId}${path.extname(file.originalname || 'file')}`;

      // Encrypt file buffer with AES-256
      const encryptedContent = encryption.encrypt(file.buffer.toString('base64'));

      // Upload encrypted payload to Supabase Storage bucket 'encrypted-files'
      const { error: uploadError } = await supabase.storage
        .from('encrypted-files')
        .upload(`${userId}/${encryptedName}`, Buffer.from(encryptedContent), {
          contentType: 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        logger.error('Supabase storage upload error', { error: uploadError.message });
        throw uploadError;
      }

      // Save file record to Supabase public.files table
      const { data: fileRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          id: fileId,
          user_id: userId,
          original_name: file.originalname || 'Uploaded Document',
          encrypted_name: encryptedName,
          mime_type: file.mimetype || 'application/octet-stream',
          size: file.size || file.buffer.length,
          hash: fileHash,
          storage_path: `${userId}/${encryptedName}`,
          is_encrypted: true,
          category: categorizeFile(file.mimetype || ''),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Supabase files table insert error', { error: dbError.message });
        throw dbError;
      }

      // Update user storage in Supabase
      try {
        await supabase.rpc('increment_storage', {
          user_id_param: userId,
          amount: file.size || file.buffer.length,
        });
      } catch {
        const { data: usr } = await supabase.from('users').select('storage_used').eq('id', userId).single();
        if (usr) {
          await supabase.from('users').update({ storage_used: (usr.storage_used || 0) + (file.size || file.buffer.length) }).eq('id', userId);
        }
      }

      // Log access
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'file_upload',
        resource_id: fileId,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details: JSON.stringify({
          fileName: file.originalname,
          size: file.size,
          type: file.mimetype,
        }),
        created_at: new Date().toISOString(),
      });

      // Reward user with +2 for upload of encrypted file
      await scoreService.increaseSecurityScore(userId, 2, 'encrypted_file_upload', { fileId });

      logger.info('File uploaded', { userId, fileId, fileName: file.originalname });

      return response.success(res, {
        id: fileRecord.id,
        name: fileRecord.original_name,
        size: fileRecord.size,
        type: fileRecord.mime_type,
        category: fileRecord.category,
        isEncrypted: fileRecord.is_encrypted,
        hash: fileRecord.hash,
        createdAt: fileRecord.created_at,
      }, 'File uploaded successfully', 201);
    } catch (error) {
      logger.error('File upload failed', { error: error.message });
      return response.error(res, 'Upload failed', 500);
    }
  },

  /**
   * Get user files
   */
  async getFiles(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20, category, search, sort = 'created_at', order = 'desc' } = req.query;

      let query = supabase
        .from('files')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (category) query = query.eq('category', category);
      if (search) query = query.ilike('original_name', `%${search}%`);
      query = query.order(sort, { ascending: order === 'asc' });
      query = query.range((page - 1) * limit, page * limit - 1);

      const { data: files, error, count } = await query;

      if (error) throw error;

      const formattedFiles = files.map((f) => ({
        id: f.id,
        name: f.original_name,
        size: f.size,
        type: f.mime_type,
        category: f.category,
        isEncrypted: f.is_encrypted,
        hash: f.hash,
        createdAt: f.created_at,
        isFavorite: f.is_favorite,
      }));

      return response.paginated(res, formattedFiles, parseInt(page), parseInt(limit), count || 0);
    } catch (error) {
      logger.error('Get files failed', { error: error.message });
      return response.error(res, 'Failed to fetch files', 500);
    }
  },

  /**
   * Get user file stats, storage consumption, and active shares
   */
  async getStats(req, res) {
    try {
      const userId = req.user.userId;

      const [filesRes, sharesRes, userRes] = await Promise.all([
        supabase
          .from('files')
          .select('id, size, category, is_encrypted')
          .eq('user_id', userId)
          .eq('is_deleted', false),
        supabase
          .from('shared_links')
          .select('id, is_active')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('users')
          .select('storage_used, storage_limit')
          .eq('id', userId)
          .single(),
      ]);

      const files = filesRes.data || [];
      const shares = sharesRes.data || [];
      const user = userRes.data || {};

      let calculatedSize = 0;
      const categories = { document: 0, image: 0, video: 0, archive: 0, other: 0 };

      files.forEach((f) => {
        const sz = parseInt(f.size) || 0;
        calculatedSize += sz;
        const cat = f.category || 'other';
        categories[cat] = (categories[cat] || 0) + 1;
      });

      const totalSize = Math.max(calculatedSize, parseInt(user.storage_used) || 0);

      return response.success(res, {
        totalFiles: files.length,
        totalSize,
        storageUsed: totalSize,
        storageLimit: user.storage_limit || 5 * 1024 * 1024 * 1024,
        sharedCount: shares.length,
        activeShares: shares.length,
        categories,
      }, 'Stats retrieved successfully');
    } catch (error) {
      logger.error('Get stats failed', { error: error.message });
      return response.error(res, 'Failed to fetch stats', 500);
    }
  },

  /**
   * Get single file
   */
  async getFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const { data: file, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !file) {
        return response.error(res, 'File not found', 404);
      }

      return response.success(res, {
        id: file.id,
        name: file.original_name,
        size: file.size,
        type: file.mime_type,
        category: file.category,
        isEncrypted: file.is_encrypted,
        hash: file.hash,
        storagePath: file.storage_path,
        createdAt: file.created_at,
        isFavorite: file.is_favorite,
      });
    } catch (error) {
      return response.error(res, 'Failed to fetch file', 500);
    }
  },

  /**
   * Delete file
   */
  async deleteFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const { data: file } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!file) {
        return response.error(res, 'File not found', 404);
      }

      // Soft delete
      await supabase
        .from('files')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);

      // Update storage
      await supabase.rpc('decrement_storage', {
        user_id_param: userId,
        amount: file.size,
      });

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'file_delete',
        resource_id: id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString(),
      });

      // Deduct -5 from score for file deletion (unsafe file action)
      await scoreService.decreaseSecurityScore(userId, 5, 'unsafe_file_activity', { fileId: id });

      logger.info('File deleted', { userId, fileId: id });
      return response.success(res, null, 'File deleted');
    } catch (error) {
      return response.error(res, 'Delete failed', 500);
    }
  },

  /**
   * Download and decrypt file
   */
  async download(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const { data: file, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

      if (error || !file) {
        // Check for unauthorized access attempt (if file actually exists in DB but user has no ownership)
        const { data: fileExists } = await supabase
          .from('files')
          .select('id')
          .eq('id', id)
          .single();

        if (fileExists) {
          logger.warn('Unauthorized file access attempt', { userId, fileId: id });
          await scoreService.decreaseSecurityScore(userId, 20, 'unauthorized_access_attempt', { fileId: id });
        }
        return response.error(res, 'File not found', 404);
      }

      // Check for suspicious download burst (bulk downloads) to prevent data exfiltration
      const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
      const { count: recentDownloads } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', 'file_download')
        .gte('created_at', tenSecondsAgo);

      if (recentDownloads && recentDownloads >= 5) {
        logger.warn('Suspicious download burst detected', { userId, count: recentDownloads });
        await scoreService.decreaseSecurityScore(userId, 10, 'suspicious_download_activity');
      }

      // Log download event in access logs
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'file_download',
        resource_id: id,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'] || 'unknown',
        details: JSON.stringify({ fileId: id, size: file.size }),
        created_at: new Date().toISOString()
      });

      // Download from Supabase Storage
      const { data: storageBlob, error: downloadError } = await supabase.storage
        .from('encrypted-files')
        .download(file.storage_path);

      if (downloadError || !storageBlob) {
        throw new Error(downloadError ? downloadError.message : 'Storage file not found');
      }

      // Convert Blob to Buffer
      const arrayBuffer = await storageBlob.arrayBuffer();
      const encryptedString = Buffer.from(arrayBuffer).toString();

      // Decrypt
      const decryptedBase64 = encryption.decrypt(encryptedString);
      if (!decryptedBase64) {
        throw new Error('Decryption failed');
      }

      // Check if client requests direct Base64 JSON response (ideal for mobile previews)
      if (req.query.base64 === 'true') {
        return res.json({
          success: true,
          data: {
            base64: decryptedBase64,
            mimeType: file.mime_type,
          },
        });
      }

      const decryptedBuffer = Buffer.from(decryptedBase64, 'base64');

      // Verify file integrity using SHA-256
      if (file.hash && !encryption.verifyHash(decryptedBuffer, file.hash)) {
        logger.error('File integrity verification failed during download (possible tampering)', { userId, fileId: id });
        return response.error(res, 'File integrity verification failed. The decrypted content does not match the original hash.', 400);
      }

      // Set headers for download
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Length', decryptedBuffer.length);

      return res.send(decryptedBuffer);
    } catch (error) {
      logger.error('File download and decryption failed', { error: error.message });
      return response.error(res, 'Download failed', 500);
    }
  },


  /**
   * Get dashboard stats
   */
  async getStats(req, res) {
    try {
      const userId = req.user.userId;

      const { data: user } = await supabase
        .from('users')
        .select('storage_used, storage_limit, security_score')
        .eq('id', userId)
        .single();

      const { count: totalFiles } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_deleted', false);

      const { count: sharedCount } = await supabase
        .from('shared_links')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { data: recentFiles } = await supabase
        .from('files')
        .select('id, original_name, size, mime_type, category, created_at')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentActivity } = await supabase
        .from('access_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { count: activeSessionCount } = await supabase
        .from('user_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      return response.success(res, {
        storage: {
          used: user?.storage_used || 0,
          limit: user?.storage_limit || 5368709120,
          percentage: user ? Math.round((user.storage_used / user.storage_limit) * 100) : 0,
        },
        securityScore: user?.security_score || 0,
        totalFiles: totalFiles || 0,
        sharedFiles: sharedCount || 0,
        activeSessions: activeSessionCount || 0,
        recentFiles: (recentFiles || []).map((f) => ({
          id: f.id,
          name: f.original_name,
          size: f.size,
          type: f.mime_type,
          category: f.category,
          createdAt: f.created_at,
        })),
        recentActivity: (recentActivity || []).map((a) => {
          let parsedDetails = null;
          if (a.details) {
            if (typeof a.details === 'object') {
              parsedDetails = a.details;
            } else {
              try {
                parsedDetails = JSON.parse(a.details);
              } catch (e) {
                parsedDetails = null;
              }
            }
          }
          return {
            id: a.id,
            action: a.action,
            ipAddress: a.ip_address,
            createdAt: a.created_at,
            details: parsedDetails,
          };
        }),
      });
    } catch (error) {
      logger.error('Stats failed', { error: error.message });
      return response.error(res, 'Failed to fetch stats', 500);
    }
  },

  /**
   * Generate a secure short-lived temporary download token
   */
  async generateDownloadToken(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const { data: file, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

      if (error || !file) {
        return response.error(res, 'File not found', 404);
      }

      // Generate a stateless token that expires in 60 seconds
      const tokenPayload = {
        fileId: file.id,
        userId: userId,
        purpose: 'temp_download'
      };
      
      const jwt = require('jsonwebtoken');
      const config = require('../config');
      
      const token = jwt.sign(tokenPayload, config.jwt.secret, { expiresIn: '60s' });

      return response.success(res, { token }, 'Download token generated');
    } catch (error) {
      logger.error('Generate download token failed', { error: error.message });
      return response.error(res, 'Failed to generate download token', 500);
    }
  },

  /**
   * Public download using temporary token
   */
  async downloadTemp(req, res) {
    try {
      const { token } = req.params;
      const jwt = require('jsonwebtoken');
      const config = require('../config');

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (err) {
        return res.status(401).send('<h1>Download link expired or invalid</h1>');
      }

      if (decoded.purpose !== 'temp_download') {
        return res.status(401).send('<h1>Invalid token purpose</h1>');
      }

      const { fileId, userId } = decoded;

      const { data: file, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .single();

      if (error || !file) {
        return res.status(404).send('<h1>File not found</h1>');
      }

      // Download from Supabase Storage
      const { data: storageBlob, error: downloadError } = await supabase.storage
        .from('encrypted-files')
        .download(file.storage_path);

      if (downloadError || !storageBlob) {
        throw new Error(downloadError ? downloadError.message : 'Storage file not found');
      }

      // Convert Blob to Buffer
      const arrayBuffer = await storageBlob.arrayBuffer();
      const encryptedString = Buffer.from(arrayBuffer).toString();

      // Decrypt
      const decryptedBase64 = encryption.decrypt(encryptedString);
      if (!decryptedBase64) {
        throw new Error('Decryption failed');
      }
      const decryptedBuffer = Buffer.from(decryptedBase64, 'base64');

      // Verify file integrity using SHA-256
      if (file.hash && !encryption.verifyHash(decryptedBuffer, file.hash)) {
        logger.error('File integrity verification failed during temp download (possible tampering)', { userId, fileId: file.id });
        return res.status(400).send('<h1>File integrity verification failed. The decrypted content does not match the original hash.</h1>');
      }

      // Set headers for browser download
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
      res.setHeader('Content-Length', decryptedBuffer.length);

      return res.send(decryptedBuffer);
    } catch (error) {
      logger.error('Temp download and decryption failed', { error: error.message });
      return res.status(500).send('<h1>Download failed</h1>');
    }
  },
};

function categorizeFile(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
  if (mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

module.exports = filesController;
