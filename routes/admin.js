import express from 'express';

import { dbadmin, dbsuperadmin } from '../db.js';

const router = express.Router();

router.get('/admin-check', async (req, res) => {
    const { isAdmin, isSuperAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username) {
        return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ isAdmin, isSuperAdmin });
});

router.get('/user', async (req, res) => {
    const { isAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username || !isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
    }

    dbadmin.query('SELECT user.username, email, role FROM user INNER JOIN role ON user.username = role.username', (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        res.json(results);
    });
});

router.delete('/user', async (req, res) => {
    const { isAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username || !isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const req_username = req.query.username;

    if (!req_username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    dbadmin.query('SELECT role FROM user WHERE username = ?', [req_username], (err, results) => {
        if (err) {
            console.error('Error checking user role:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        if (results.length > 0) {
            const role = results[0].role;
            if (role === 'admin' || role === 'superadmin') {
                return res.status(403).json({ message: 'Cannot delete admin or superadmin user' });
            }
        }
    });

    dbadmin.query('DELETE FROM user WHERE username = ?', [req_username], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    });
});

router.get('/account', async (req, res) => {
    const { isAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username || !isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const req_username = req.query.username;

    console.log(req_username)

    dbadmin.query('SELECT * FROM account INNER JOIN cash ON account.id = cash.account_id WHERE username = ?', [req_username], (err, results) => {
        if (err) {
            console.error('Error fetching accounts:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        res.json(results);
    });
});

router.delete('/account', async (req, res) => {
    const { isAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username || !isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const req_accountId = req.query.accountId;

    if (!req_accountId) {
        return res.status(400).json({ message: 'Account ID is required' });
    }

    dbadmin.query('DELETE FROM account WHERE id = ?', [req_accountId], (err, result) => {
        if (err) {
            console.error('Error deleting account:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json({ message: 'Account deleted successfully' });
    });
});

router.put('/change-role', async (req, res) => {
    const { isSuperAdmin } = await isAdminUser(req.user.username);
    if (!req.user || !req.user.username || !isSuperAdmin) {
        return res.status(403).json({ message: 'Access denied' });
    }

    const { username, newRole } = req.body;

    if (!username || !newRole) {
        return res.status(400).json({ message: 'Username and new role are required' });
    }

    if (!['user', 'admin', 'superadmin'].includes(newRole)) {
        return res.status(400).json({ message: 'Invalid role specified' });
    }

    dbsuperadmin.query('UPDATE user SET role = ? WHERE username = ?', [newRole, username], (err, result) => {
        if (err) {
            console.error('Error updating user role:', err);
            return res.status(500).json({ message: 'Internal server error', error: err });
        }
        res.json({ message: 'User role updated successfully' });
    });
});

function isAdminUser(username) {
  return new Promise((resolve, reject) => {
    dbadmin.query('SELECT role FROM role WHERE username = ?', [username], (err, results) => {
      if (err) {
        return resolve({ isAdmin: false, isSuperAdmin: false });
      }

      let isAdmin = false;
      let isSuperAdmin = false;

      if (results.length > 0) {
        const role = results[0].role;

        if (role === 'admin') {
          isAdmin = true;
        } else if (role === 'superadmin') {
          isAdmin = true;
          isSuperAdmin = true;
        }
      }

      resolve({ isAdmin, isSuperAdmin });
    });
  });
}

export default router;