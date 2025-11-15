import express from "express";

import db from '../db.js';

const router = express.Router();

router.get('/account', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.query('SELECT * FROM account INNER JOIN cash ON account.id = cash.account_id WHERE username = ?', [req.user.username], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

router.get('/account/:id', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.params.id;

  db.query('SELECT * FROM account INNER JOIN cash ON account.id = cash.account_id WHERE username = ? AND account.id = ?', [req.user.username, id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

router.get('/account_adm', (req, res) => {

  db.query('select ac.id, ac.username, us.email from account as ac left join user as us on ac.username = us.username;', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

// router.get('/')

router.post('/account', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { name, tax_year } = req.body;
  if (!name || !tax_year) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  db.query('INSERT INTO account (username, name, tax_year) VALUES (?, ?, ?)', [req.user.username, name, tax_year], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    res.status(201).json({ message: 'Account created successfully', accountId: results.insertId });
  });
});

router.put('/account/:id', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.params.id;
  const { name, tax_year, amount_thb, amout_usd } = req.body;
  if (!name || !tax_year || amount_thb == undefined || amout_usd == undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  isAccountOwnByUser(id, req.user.username, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.query('UPDATE account SET name = ?, tax_year = ? WHERE id = ?', [name, tax_year, id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }

      db.query('UPDATE cash SET amount_thb = ?, amount_usd = ? WHERE account_id = ?', [amount_thb, amout_usd, id], (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database query failed', details: err });
        }
        res.status(200).json({ message: 'Account updated successfully' });
      });
    });
  });
});

router.delete('/account/:id', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.params.id;

  isAccountOwnByUser(id, req.user.username, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.query('DELETE FROM account WHERE id = ?', [id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(200).json({ message: 'Account deleted successfully' });
    });
  });
});

router.get('/account/:id/transaction', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.params.id;

  const { transaction_type, security_type, limit } = req.query;

  if (security_type == undefined) {
    return res.status(400).json({ error: 'Missing security_type parameter' });
  }

  var queryLimit = parseInt(limit);
  if (isNaN(queryLimit) || queryLimit < 0) {
    queryLimit = 0; // No limit
  }

  if(security_type == 'trade_us') {
    var query_with_limit = 'SELECT transaction_type, ticker_symbol, unit, unit_price, gross_amount_usd, transaction_date, fee FROM transaction_trade_us t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_type, ticker_symbol, unit, unit_price, gross_amount_usd, transaction_date, fee FROM transaction_trade_us t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
    }

  } else if (security_type == 'trade_th') {
    var query_with_limit = 'SELECT transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, transaction_date, fee FROM transaction_trade_th t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, transaction_date, fee FROM transaction_trade_th t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
    }
  } else if (security_type == 'exchange') {

    //transaction_type, amount_thb, amount_usd, exchange_rate, transaction_date, account_cash_id
    var query_with_limit = 'SELECT transaction_type, t.amount_thb, t.amount_usd, exchange_rate, transaction_date FROM transaction_exchange t INNER JOIN cash c ON t.account_cash_id = c.account_id INNER JOIN account a ON a.id = c.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_type, t.amount_thb, t.amount_usd, exchange_rate, transaction_date FROM transaction_exchange t INNER JOIN cash c ON t.account_cash_id = c.account_id INNER JOIN account a ON a.id = c.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
    }
  } else {
    return res.status(400).json({ error: 'Invalid security_type parameter' });
  }

  db.query(query_with_limit, [req.user.username, id, queryLimit], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed' , details: err });
      }
      return res.status(200).json(results);
    });
});

// router.post('/account/:id/transaction/exchange', (req, res) => {
//   // Handle exchange transaction creation
//   const { transaction_type, amount, exchange_rate } = req.body;

//   if (!transaction_type || !amount || !exchange_rate) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   const query = 'INSERT INTO transaction_exchange (account_id, transaction_type, amount, exchange_rate) VALUES (?, ?, ?, ?)';
//   db.query(query, [req.params.id, transaction_type, amount, exchange_rate], (err, results) => {
//     if (err) {
//       return res.status(500).json({ error: 'Database query failed' });
//     }
//     res.status(201).json({ message: 'Exchange transaction created successfully' });
//   });
// });

router.post('/account/:id/transaction/trade_us', (req, res) => {
  // Handle US trade transaction creation
  const { transaction_type, stock_symbol, unit, unit_price, gross_amount_usd, fee, vat, transaction_date } = req.body;
  const id = req.params.id;

  if (!transaction_type || !stock_symbol || !unit || !unit_price || !gross_amount_usd || !fee || !vat || !transaction_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  isAccountOwnByUser(id, req.user.username, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.query('CALL Add_transaction_trade_us(?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, transaction_type, stock_symbol, unit, unit_price, gross_amount_usd, fee, vat, transaction_date], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(201).json({ message: 'US trade transaction created successfully' });
    });
  });
});

router.post('/query', (req, res) => {
  const { sql } = req.body;
  db.query(sql, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(result);
  });
});

// router.post('/account/:id/transaction/trade_th', (req, res) => {
//   // Handle TH trade transaction creation
//   const { transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, securities_type } = req.body;

//   if (!transaction_type || !ticker_symbol || !unit || !unit_price || !gross_amount_thb || !fee || !vat || !transaction_date || !securities_type) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   const query = 'INSERT INTO transaction_trade_th (account_id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, securities_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
//   db.query(query, [req.params.id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, securities_type], (err, results) => {
//     if (err) {
//       return res.status(500).json({ error: 'Database query failed' });
//     }
//     res.status(201).json({ message: 'TH trade transaction created successfully' });
//   });
// });

function isAccountOwnByUser(accountId, username, callback) {
  db.query('SELECT * FROM account WHERE id = ? AND username = ?', [accountId, username], (err, results) => {
    if (err) {
      return callback(err, false);
    }
    if (results.length > 0) {
      return callback(null, true);
    } else {
      return callback(null, false);
    }
  });
}

export default router;