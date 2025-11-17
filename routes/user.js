import express from "express";

import { db } from '../db.js';

const router = express.Router();

router.get('/profile', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.query('SELECT username, email FROM user WHERE username = ?', [req.user.username], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results[0]);
  });
});

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
  const { name, tax_year, money_method, amount_thb, transaction_date } = req.body;
  if (!name || !tax_year || money_method == undefined || amount_thb == undefined || !transaction_date) {
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

      if (money_method === 'deposit') {
        var query = "CALL deposit_cash_thb(?, ?, ?)";
      }
      else if (money_method === 'withdrawal') { 
        var query = "CALL withdraw_cash_thb(?, ?, ?)";
      } else {
        return res.status(400).json({ error: 'Invalid money_method value' });
      }
      
      db.query(query, [id, amount_thb, transaction_date], (err, results) => {
        console.log(amount_thb);
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

router.get('/account/:id/summary', async (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.params.id;

  try {
    const q = (sql, params) =>
      new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

    const summery = {};

    // 1
    let r1 = await q(`CALL Calc_Current_Asset_Holdings(?, @asset_thb, @asset_usd); SELECT @asset_thb AS asset_thb, @asset_usd AS asset_usd;`, [id]);
    summery.total_asset_thb = r1[1][0].asset_thb;
    summery.total_asset_usd = r1[1][0].asset_usd;

    // 2
    let r2 = await q(`CALL Calc_Total_Cash_Deposit_THB(?, @total_deposit); SELECT @total_deposit AS total_deposit_thb;`, [id]);
    summery.total_deposit_thb = r2[1][0].total_deposit_thb;

    // 3
    let r3 = await q(`CALL Calc_Total_Cash_Withdrawal_THB(?, @total_withdrawal); SELECT @total_withdrawal AS total_withdrawal_thb;`, [id]);
    summery.total_withdrawal_thb = r3[1][0].total_withdrawal_thb;

    // 4
    let r4 = await q(`CALL Calc_All_Taxable(?, @total_taxable); SELECT @total_taxable AS total_taxable_usd;`, [id]);
    summery.total_taxable_usd = r4[1][0].total_taxable_usd;

    // 5
    let r5 = await q(
      `CALL Calc_Total_Deductions(?, @total_deduction_thb, @total_deduction_usd);
       SELECT @total_deduction_thb AS total_deduction_thb, @total_deduction_usd AS total_deduction_usd;`,
      [id]
    );
    summery.total_deduction_thb = r5[1][0].total_deduction_thb;
    summery.total_deduction_usd = r5[1][0].total_deduction_usd;

    return res.status(200).json(summery);

  } catch (err) {
    return res.status(500).json({ error: "Database query failed", details: err });
  }
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
    var query_with_limit = 'SELECT transaction_id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_usd, transaction_date, fee, vat FROM transaction_trade_us t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_usd, transaction_date, fee, vat FROM transaction_trade_us t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
    }

  } else if (security_type == 'trade_th') {
    var query_with_limit = 'SELECT transaction_id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, transaction_date, fee, vat FROM transaction_trade_th t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, transaction_date, fee, vat FROM transaction_trade_th t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
    }
  } else if (security_type == 'exchange') {

    //transaction_type, amount_thb, amount_usd, exchange_rate, transaction_date, account_cash_id
    var query_with_limit = 'SELECT transaction_id, transaction_type, t.amount_thb, t.amount_usd, exchange_rate, transaction_date FROM transaction_exchange t INNER JOIN cash c ON t.account_cash_id = c.account_id INNER JOIN account a ON a.id = c.account_id WHERE a.username = ? AND account_id = ?;';
    
    if (queryLimit > 0) {
      query_with_limit = 'SELECT transaction_id, transaction_type, t.amount_thb, t.amount_usd, exchange_rate, transaction_date FROM transaction_exchange t INNER JOIN cash c ON t.account_cash_id = c.account_id INNER JOIN account a ON a.id = c.account_id WHERE a.username = ? AND account_id = ? LIMIT ?;';
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

router.post('/account/:id/transaction/exchange', (req, res) => {
  // Handle exchange transaction creation
  const { transaction_type, amount_thb, amount_usd, exchange_rate, transaction_date } = req.body;
  const id = req.params.id;

  if (!transaction_type || !amount_thb || !amount_usd || !exchange_rate || !transaction_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  isAccountOwnByUser(id, req.user.username, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.query('INSERT INTO transaction_exchange (transaction_type, amount_thb, amount_usd, exchange_rate, transaction_date, account_cash_id) VALUES (?, ?, ?, ?, ?, ?)', [transaction_type, amount_thb, amount_usd, exchange_rate, transaction_date, id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(201).json({ message: 'Exchange transaction created successfully' });
    });
  });
});

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

    db.query('CALL Add_transaction_trade_us(?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, transaction_type, stock_symbol, unit, unit_price, gross_amount_usd, Float16Array(fee), Float16Array(vat), transaction_date], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(201).json({ message: 'US trade transaction created successfully' });
    });
  });
});

router.post('/account/:id/transaction/trade_th', (req, res) => {
  // Handle TH trade transaction creation
  const { transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, securities_type, mutual_fund_type } = req.body;
  const id = req.params.id;

  if (!transaction_type || !ticker_symbol || !unit || !unit_price || !gross_amount_thb || !fee || !vat || !transaction_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  isAccountOwnByUser(id, req.user.username, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    //p_account_id INT UNSIGNED, IN p_transaction_type VARCHAR(4), IN p_stock_symbol VARCHAR(30), IN p_unit DECIMAL(14, 6), IN p_unit_price DECIMAL(14, 2), IN p_gross_amount DECIMAL(14, 2), IN p_fee DECIMAL(8, 2), IN p_vat DECIMAL(8, 2), IN p_transaction_date DATETIME,IN p_STORMF VARCHAR(10),IN p_RMFORESG VARCHAR(10)

    db.query('CALL Add_transaction_trade_th(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, transaction_type, ticker_symbol, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, securities_type, mutual_fund_type], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(201).json({ message: 'TH trade transaction created successfully' });
    });
  });
});

router.delete('/account/transaction/:sec_type/:transaction_id', (req, res) => {
  if (!req.user || !req.user.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secType = req.params.sec_type;
  const transactionId = req.params.transaction_id;

  // get account id from transaction id
  let getAccountQuery = '';
  if (secType === 'trade_us') {
    getAccountQuery = 'SELECT s.account_id FROM transaction_trade_us t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE t.transaction_id = ? AND a.username = ?';
  } else if (secType === 'trade_th') {
    getAccountQuery = 'SELECT s.account_id FROM transaction_trade_th t INNER JOIN securities s ON t.stock_id = s.securities_id INNER JOIN account a ON a.id = s.account_id WHERE t.transaction_id = ? AND a.username = ?';
  } else if (secType === 'exchange') {
    getAccountQuery = 'SELECT c.account_id FROM transaction_exchange t INNER JOIN cash c ON t.account_cash_id = c.account_id INNER JOIN account a ON a.id = c.account_id WHERE t.transaction_id = ? AND a.username = ?';
  } else {
    return res.status(400).json({ error: 'Invalid security type' });
  }

  db.query(getAccountQuery, [transactionId, req.user.username], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed', details: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Transaction not found or does not belong to user' });
    }

    const accountId = results[0].account_id;

    let deleteQuery = '';
    if (secType === 'trade_us') {
      deleteQuery = 'DELETE FROM transaction_trade_us WHERE transaction_id = ?';
    } else if (secType === 'trade_th') {
      deleteQuery = 'DELETE FROM transaction_trade_th WHERE transaction_id = ?';
    } else if (secType === 'exchange') {
      deleteQuery = 'DELETE FROM transaction_exchange WHERE transaction_id = ?';
    }

    db.query(deleteQuery, [transactionId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database query failed', details: err });
      }
      res.status(200).json({ message: 'Transaction deleted successfully' });
    });
  });
});

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