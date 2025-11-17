DELIMITER $$
DROP TRIGGER IF EXISTS init_role_after_new_user $$
CREATE TRIGGER init_role_after_new_user
AFTER INSERT ON user
FOR EACH ROW
BEGIN
    -- สร้าง role ใน role ให้ userที่พึ่งถูกสร้าง
    INSERT INTO role (username, role.role)
    VALUES (NEW.username, 'user');
END $$
DELIMITER ;

--initial cash when insert new acoount
DELIMITER $$
DROP TRIGGER IF EXISTS init_cash_after_new_account $$
CREATE TRIGGER init_cash_after_new_account
AFTER INSERT ON account
FOR EACH ROW
BEGIN
    -- สร้าง row ใน cash ให้ account ที่พึ่งถูกสร้าง
    INSERT INTO cash (account_id, amount_thb, amount_usd)
    VALUES (NEW.id, 0.00, 0.00)
    ON DUPLICATE KEY UPDATE
        -- กันกรณีมี row อยู่แล้ว (เช่นจากสคริปต์อื่น)
        amount_thb = amount_thb,
        amount_usd = amount_usd;
END $$
DELIMITER ;

-- PROCEDURE update_cash
DELIMITER $$
DROP PROCEDURE IF EXISTS update_cash $$
CREATE PROCEDURE update_cash(
    IN p_account_id INT,
    IN p_add_thb DECIMAL(14,2),
    IN p_add_usd DECIMAL(14,2)
)
BEGIN

    INSERT INTO cash(account_id, amount_thb, amount_usd)
    VALUES (p_account_id, 0, 0)
    ON DUPLICATE KEY UPDATE account_id = account_id;

    UPDATE cash
    SET amount_thb = amount_thb + IFNULL(p_add_thb, 0),
        amount_usd = amount_usd + IFNULL(p_add_usd, 0)
    WHERE account_id = p_account_id;
END $$
DELIMITER ;

DELIMITER $$
-- Deposit procedure
DROP PROCEDURE IF EXISTS deposit_cash_thb$$
CREATE PROCEDURE deposit_cash_thb(
    IN p_account_id INT,
    IN p_amount_thb DECIMAL(14,2),
    IN p_date DATETIME
)
BEGIN

    -- Insert transaction record
    INSERT INTO transaction_exchange (transaction_type, amount_thb, amount_usd, transaction_date, account_cash_id)
    VALUES ('SELL', p_amount_thb, 0, p_date, p_account_id);
END$$


-- Withdraw procedure
DROP PROCEDURE IF EXISTS withdraw_cash_thb$$
CREATE PROCEDURE withdraw_cash_thb(
    IN p_account_id INT,
    IN p_amount_thb DECIMAL(14,2),
    IN p_date DATETIME
)
BEGIN
    DECLARE current_balance DECIMAL(14,2);

    SELECT amount_thb INTO current_balance
        FROM cash
        WHERE account_id = p_account_id;

    -- Check sufficient funds
    IF current_balance >= p_amount_thb THEN

        INSERT INTO transaction_exchange (transaction_type, amount_thb, amount_usd, transaction_date, account_cash_id)
        VALUES ('BUY', p_amount_thb, 0, p_date, p_account_id);
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "Insufficient Cash";
    END IF;
END$$

DELIMITER ;


-- TRIGGER update_cash after insert transaction_exchange
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_insert_exchange $$CREATE TRIGGER update_cash_after_insert_exchange
AFTER INSERT ON transaction_exchange
FOR EACH ROW
BEGIN
    DECLARE v_add_thb DECIMAL(14,2);
    DECLARE v_add_usd DECIMAL(14,2);

    SET v_add_thb = 0;
    SET v_add_usd = 0;

    IF NEW.transaction_type = 'buy' THEN
        -- ใช้ THB ซื้อ USD
        SET v_add_thb = -IFNULL(NEW.amount_thb, 0);
        SET v_add_usd =  IFNULL(NEW.amount_usd, 0);

    ELSEIF NEW.transaction_type = 'sell' THEN
        -- ขาย USD เป็น THB
        SET v_add_thb =  IFNULL(NEW.amount_thb, 0);
        SET v_add_usd = -IFNULL(NEW.amount_usd, 0);
    END IF;

    CALL update_cash(NEW.account_cash_id, v_add_thb, v_add_usd);
END $$
DELIMITER ;


-- TRIGGER update_cash after update transaction_exchange
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_update_exchange $$
CREATE TRIGGER update_cash_after_update_exchange
AFTER UPDATE ON transaction_exchange
FOR EACH ROW
BEGIN
    DECLARE v_add_thb DECIMAL(14,2);
     DECLARE v_add_usd DECIMAL(14,2);

    -- 1) Revert OLD values
    IF OLD.transaction_type = 'buy' THEN
        SET v_add_thb =  OLD.amount_thb;
        SET v_add_usd = -OLD.amount_usd;
    ELSEIF OLD.transaction_type = 'sell' THEN
        SET v_add_thb = -OLD.amount_thb;
        SET v_add_usd =  OLD.amount_usd;
    END IF;

    CALL update_cash(OLD.account_cash_id, v_add_thb, v_add_usd);

    -- 2) Apply NEW values
    SET v_add_thb = 0;
    SET v_add_usd = 0;

    IF NEW.transaction_type = 'buy' THEN
        SET v_add_thb = -NEW.amount_thb;
        SET v_add_usd =  NEW.amount_usd;
    ELSEIF NEW.transaction_type = 'sell' THEN
        SET v_add_thb =  NEW.amount_thb;
        SET v_add_usd = -NEW.amount_usd;
    END IF;

    CALL update_cash(NEW.account_cash_id, v_add_thb, v_add_usd);
END $$

DELIMITER ;


-- TRIGGER update_cash after delete transaction_exchange
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_delete_exchange $$
CREATE TRIGGER update_cash_after_delete_exchange
AFTER DELETE ON transaction_exchange
FOR EACH ROW
BEGIN
    DECLARE v_add_thb DECIMAL(14,2);
    DECLARE v_add_usd DECIMAL(14,2);

    SET v_add_thb = 0;
    SET v_add_usd = 0;

    -- Reverse the effect of the deleted exchange
    IF OLD.transaction_type = 'buy' THEN
        SET v_add_thb =  OLD.amount_thb;
        SET v_add_usd = -OLD.amount_usd;
    ELSEIF OLD.transaction_type = 'sell' THEN
        SET v_add_thb = -OLD.amount_thb;
        SET v_add_usd =  OLD.amount_usd;
    END IF;

    CALL update_cash(OLD.account_cash_id, v_add_thb, v_add_usd);
END $$
DELIMITER ;


--prevent currency from being less than 0 which will cause by insert transaction_exchange
DELIMITER $$
DROP TRIGGER IF EXISTS check_cash_before_insert_exchange $$
CREATE TRIGGER check_cash_before_insert_exchange
BEFORE INSERT ON transaction_exchange
FOR EACH ROW
BEGIN
    -- Label the main block so we can LEAVE it
    main_block: BEGIN
        DECLARE v_thb DECIMAL(14,2);
        DECLARE v_usd DECIMAL(14,2);

        -- ✅ Skip all checks if USD amount is exactly 0
        IF NEW.amount_usd = 0 THEN
            LEAVE main_block;
        END IF;

        -- อ่านยอดเงินปัจจุบันของ account_cash_id
        SELECT amount_thb, amount_usd INTO v_thb, v_usd
        FROM cash
        WHERE account_id = NEW.account_cash_id;

        -- หากไม่พบ row ใน cash ให้ prevent
        IF v_thb IS NULL OR v_usd IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cash account not initialized for this account_cash_id';
        END IF;

        -- BUY → THB ต้องพอ (THB ลด), USD เพิ่ม
        IF NEW.transaction_type = 'buy' THEN
            IF v_thb - IFNULL(NEW.amount_thb, 0) < 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Insufficient THB balance';
            END IF;
        END IF;

        -- SELL → USD ต้องพอ (USD ลด), THB เพิ่ม
        IF NEW.transaction_type = 'sell' THEN
            IF v_usd - IFNULL(NEW.amount_usd, 0) < 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Insufficient USD balance';
            END IF;
        END IF;
    END main_block;
END $$
DELIMITER ;



--need sufficient thb cash before insert buy trade_th
DELIMITER $$
DROP TRIGGER IF EXISTS check_cash_before_insert_buy_trade_th $$
CREATE TRIGGER check_cash_before_insert_buy_trade_th
BEFORE INSERT ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_thb DECIMAL(14,2);
    DECLARE v_usd DECIMAL(14,2);
    DECLARE v_required_thb DECIMAL(14,2);

    -- ตรวจว่ามี account_cash_id ให้ใช้หรือไม่
    IF NEW.account_cash_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Missing account_cash_id for trade (TH).';
    END IF;

    -- ดึงยอดเงินสดที่มีอยู่
    SELECT amount_thb, amount_usd
      INTO v_thb, v_usd
    FROM cash
    WHERE account_id = NEW.account_cash_id;

    IF v_thb IS NULL OR v_usd IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cash account not initialized for this account_cash_id.';
    END IF;

    -- ตรวจเฉพาะ BUY เท่านั้น
    IF NEW.transaction_type = 'buy' THEN
        SET v_required_thb =
            IFNULL(NEW.gross_amount_thb, 0)
          + IFNULL(NEW.fee, 0)
          + IFNULL(NEW.vat, 0);

        IF v_thb < v_required_thb THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient THB balance. Please deposit THB';
        END IF;
    END IF;
END $$
DELIMITER ;


--after insert buy trade_th, reduce thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_insert_buy_trade_th $$
CREATE TRIGGER update_cash_after_insert_buy_trade_th
AFTER INSERT ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_outflow_thb DECIMAL(14,2);

    IF NEW.transaction_type = 'buy' THEN
        SET v_outflow_thb =
              IFNULL(NEW.gross_amount_thb, 0)
            + IFNULL(NEW.fee, 0)
            + IFNULL(NEW.vat, 0);

        -- ลด THB ในกระเป๋าเงินสด
        CALL update_cash(NEW.account_cash_id, -v_outflow_thb, 0);
    END IF;
END $$
DELIMITER ;

--after update trade_th to buy, adjust thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_update_buy_trade_th $$
CREATE TRIGGER update_cash_after_update_buy_trade_th
AFTER UPDATE ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_old_outflow_thb DECIMAL(14,2);
    DECLARE v_new_outflow_thb DECIMAL(14,2);

    -- 1) ถ้าเดิมเป็น BUY ให้คืนเงิน outflow เก่าเข้ากระเป๋าเดิม
    IF OLD.transaction_type = 'buy' THEN
        SET v_old_outflow_thb =
              IFNULL(OLD.gross_amount_thb, 0)
            + IFNULL(OLD.fee, 0)
            + IFNULL(OLD.vat, 0);
        CALL update_cash(OLD.account_cash_id,  v_old_outflow_thb, 0);  -- คืนเงิน (บวก THB)
    END IF;

    -- 2) ถ้าใหม่เป็น BUY ให้ตัดเงิน outflow ใหม่จากกระเป๋าใหม่
    IF NEW.transaction_type = 'buy' THEN
        SET v_new_outflow_thb =
              IFNULL(NEW.gross_amount_thb, 0)
            + IFNULL(NEW.fee, 0)
            + IFNULL(NEW.vat, 0);
        CALL update_cash(NEW.account_cash_id, -v_new_outflow_thb, 0);  -- ตัดเงิน (ลบ THB)
    END IF;
END $$
DELIMITER ;

--after delete buy trade_th, roleback thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_delete_buy_trade_th $$
CREATE TRIGGER update_cash_after_delete_buy_trade_th
AFTER DELETE ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_old_outflow_thb DECIMAL(14,2);

    IF OLD.transaction_type = 'buy' THEN
        SET v_old_outflow_thb =
              IFNULL(OLD.gross_amount_thb, 0)
            + IFNULL(OLD.fee, 0)
            + IFNULL(OLD.vat, 0);
        CALL update_cash(OLD.account_cash_id, v_old_outflow_thb, 0);  -- คืนเงิน THB
    END IF;
END $$
DELIMITER ;

--need sufficient usd cash before insert buy trade_us
DELIMITER $$
DROP TRIGGER IF EXISTS check_cash_before_insert_buy_trade_us $$
CREATE TRIGGER check_cash_before_insert_buy_trade_us
BEFORE INSERT ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_thb DECIMAL(14,2);
    DECLARE v_usd DECIMAL(14,2);
    DECLARE v_required_usd DECIMAL(14,2);

    -- ต้องมีการอ้างอิง cash account
    IF NEW.account_cash_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Missing account_cash_id for trade (US).';
    END IF;

    -- ดึงยอดเงินสดปัจจุบัน
    SELECT amount_thb, amount_usd
      INTO v_thb, v_usd
    FROM cash
    WHERE account_id = NEW.account_cash_id;

    IF v_thb IS NULL OR v_usd IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cash account not initialized for this account_cash_id.';
    END IF;

    -- ตรวจเฉพาะกรณี BUY: ต้องมี USD พอ = gross + fee + vat
    IF NEW.transaction_type = 'buy' THEN
        SET v_required_usd =
            IFNULL(NEW.gross_amount_usd, 0)
          + IFNULL(NEW.fee, 0)
          + IFNULL(NEW.vat, 0);

        IF v_usd < v_required_usd THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient USD balance. Please do the exchange';
        END IF;
    END IF;
END $$

DELIMITER ;

--after insert buy trade_us, reduce us cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_insert_buy_trade_us $$
CREATE TRIGGER update_cash_after_insert_buy_trade_us
AFTER INSERT ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_outflow_usd DECIMAL(14,2);

    IF NEW.transaction_type = 'buy' THEN
        SET v_outflow_usd =
              IFNULL(NEW.gross_amount_usd, 0)
            + IFNULL(NEW.fee, 0)
            + IFNULL(NEW.vat, 0);

        -- ลด USD ในกระเป๋าเงินสด
        CALL update_cash(NEW.account_cash_id, 0, -v_outflow_usd);
    END IF;
END $$
DELIMITER ;


--after update trade_us to buy, adjust usd cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_update_buy_trade_us $$
CREATE TRIGGER update_cash_after_update_buy_trade_us
AFTER UPDATE ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_old_outflow_usd DECIMAL(14,2);
    DECLARE v_new_outflow_usd DECIMAL(14,2);

    -- 1) ถ้าเดิมเป็น BUY → คืน USD outflow เก่าเข้ากระเป๋าเดิม
    IF OLD.transaction_type = 'buy' THEN
        SET v_old_outflow_usd =
              IFNULL(OLD.gross_amount_usd, 0)
            + IFNULL(OLD.fee, 0)
            + IFNULL(OLD.vat, 0);
        CALL update_cash(OLD.account_cash_id, 0,  v_old_outflow_usd);  -- คืน USD (บวก)
    END IF;

    -- 2) ถ้าใหม่เป็น BUY → ตัด USD outflow ใหม่จากกระเป๋าใหม่
    IF NEW.transaction_type = 'buy' THEN
        SET v_new_outflow_usd =
              IFNULL(NEW.gross_amount_usd, 0)
            + IFNULL(NEW.fee, 0)
            + IFNULL(NEW.vat, 0);
        CALL update_cash(NEW.account_cash_id, 0, -v_new_outflow_usd);  -- ตัด USD (ลบ)
    END IF;
END $$
DELIMITER ;

--after delete buy trade_th, roleback thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_delete_buy_trade_us $$
CREATE TRIGGER update_cash_after_delete_buy_trade_us
AFTER DELETE ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_old_outflow_usd DECIMAL(14,2);

    IF OLD.transaction_type = 'buy' THEN
        SET v_old_outflow_usd =
              IFNULL(OLD.gross_amount_usd, 0)
            + IFNULL(OLD.fee, 0)
            + IFNULL(OLD.vat, 0);
        CALL update_cash(OLD.account_cash_id, 0, v_old_outflow_usd);  -- คืนเงิน USD
    END IF;
END $$
DELIMITER ;


--after insert sell transaction in trade_th, update thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_insert_sell_trade_th $$
CREATE TRIGGER update_cash_after_insert_sell_trade_th
AFTER INSERT ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_net_thb DECIMAL(14,2);

    IF NEW.transaction_type = 'sell' THEN
        SET v_net_thb =
              IFNULL(NEW.gross_amount_thb, 0)
            - IFNULL(NEW.fee, 0)
            - IFNULL(NEW.vat, 0);

        -- กันกรณีค่าติดลบโดยไม่ตั้งใจ (เช่นกรอก fee/vat เกินยอด)
        IF v_net_thb < 0 THEN
            SET v_net_thb = 0;
        END IF;

        CALL update_cash(NEW.account_cash_id, v_net_thb, 0);
    END IF;
END $$
DELIMITER ;



--after insert sell transaction in trade_us, update us cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_insert_sell_trade_us $$
CREATE TRIGGER update_cash_after_insert_sell_trade_us
AFTER INSERT ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_net_usd DECIMAL(14,2);

    IF NEW.transaction_type = 'sell' THEN
        SET v_net_usd =
              IFNULL(NEW.gross_amount_usd, 0)
            - IFNULL(NEW.fee, 0)
            - IFNULL(NEW.vat, 0);

        -- กันค่าติดลบ
        IF v_net_usd < 0 THEN
            SET v_net_usd = 0;
        END IF;

        CALL update_cash(NEW.account_cash_id, 0, v_net_usd);
    END IF;
END $$
DELIMITER ;

--after delete sell trade_th, roleback thb cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_delete_sell_trade_th $$
CREATE TRIGGER update_cash_after_delete_sell_trade_th
AFTER DELETE ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_net_thb DECIMAL(14,2);

    IF OLD.transaction_type = 'sell' THEN
        SET v_net_thb =
              IFNULL(OLD.gross_amount_thb, 0)
            - IFNULL(OLD.fee, 0)
            - IFNULL(OLD.vat, 0);

        -- rollback: ตัด THB ออกตามเงินที่เคยเพิ่มตอนขาย
        CALL update_cash(OLD.account_cash_id, -GREATEST(v_net_thb, 0), 0);
    END IF;
END $$
DELIMITER ;


--after delete sell trade_us, roleback us cash
DELIMITER $$
DROP TRIGGER IF EXISTS update_cash_after_delete_sell_trade_us $$
CREATE TRIGGER update_cash_after_delete_sell_trade_us
AFTER DELETE ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_net_usd DECIMAL(14,2);

    IF OLD.transaction_type = 'sell' THEN
        SET v_net_usd =
              IFNULL(OLD.gross_amount_usd, 0)
            - IFNULL(OLD.fee, 0)
            - IFNULL(OLD.vat, 0);

        -- rollback: ตัด USD ออกตามเงินที่เคยเพิ่มตอนขาย
        CALL update_cash(OLD.account_cash_id, 0, -GREATEST(v_net_usd, 0));
    END IF;
END $$
DELIMITER ;





-- PROCEDURE Add_transaction_trade_us insert new security and stock if not exists
DROP PROCEDURE IF EXISTS Add_transaction_trade_us;
delimiter $$
CREATE PROCEDURE Add_transaction_trade_us(
IN p_account_id INT UNSIGNED, 
IN p_transaction_type VARCHAR(4), 
IN p_stock_symbol VARCHAR(30), 
IN p_unit DECIMAL(14, 6), 
IN p_unit_price DECIMAL(14, 2), 
IN p_gross_amount DECIMAL(14, 2), 
IN p_fee DECIMAL(8, 2), 
IN p_vat DECIMAL(8, 2), 
IN p_transaction_date DATETIME)
BEGIN
DECLARE d_stock_id INT UNSIGNED;

SELECT s.securities_id INTO d_stock_id
		FROM securities se INNER JOIN stock s ON se.securities_id = s.securities_id 
		WHERE se.account_id = p_account_id AND se.type = "stock" AND s.type = "us" AND se.ticker_symbol = UPPER(p_stock_symbol);
    
IF d_stock_id IS NULL THEN
		INSERT INTO securities(account_id, ticker_symbol, amount, type) VALUES (p_account_id, UPPER(p_stock_symbol), 0, "stock");
SET d_stock_id = LAST_INSERT_ID();
        	INSERT INTO stock VALUES (LAST_INSERT_ID(), "us");
	END IF;

	INSERT INTO transaction_trade_us (transaction_type, stock_id, unit, unit_price, gross_amount_usd, fee, vat, transaction_date, account_cash_id) 
		VALUES (p_transaction_type, d_stock_id, p_unit, p_unit_price, p_gross_amount, p_fee, p_vat, p_transaction_date, p_account_id);
END$$
delimiter ;



DROP PROCEDURE IF EXISTS Add_transaction_trade_th;
delimiter $$
CREATE PROCEDURE Add_transaction_trade_th(
IN p_account_id INT UNSIGNED, 
IN p_transaction_type VARCHAR(4), 
IN p_stock_symbol VARCHAR(30), 
IN p_unit DECIMAL(14, 6), 
IN p_unit_price DECIMAL(14, 2), 
IN p_gross_amount DECIMAL(14, 2), 
IN p_fee DECIMAL(8, 2), 
IN p_vat DECIMAL(8, 2), 
IN p_transaction_date DATETIME,
IN p_STORMF VARCHAR(20),
IN p_RMFORESG VARCHAR(10))
BEGIN
DECLARE d_stock_id INT UNSIGNED;
DECLARE d_fund_id INT UNSIGNED;
DECLARE real_stock_id INT UNSIGNED;

SELECT se.securities_id INTO d_stock_id
		FROM securities se INNER JOIN stock s ON se.securities_id = s.securities_id 
		WHERE se.account_id = p_account_id AND se.type = "stock" AND s.type = "th" AND se.ticker_symbol = UPPER(p_stock_symbol);
	SELECT se.securities_id INTO d_fund_id
		FROM securities se INNER JOIN mutual_fund m ON se.securities_id = m.securities_id
		WHERE se.account_id = p_account_id AND se.type = "mutual_fund" AND m.type = "th" AND se.ticker_symbol = UPPER(p_stock_symbol);
    
IF d_stock_id IS NOT NULL THEN
	SET real_stock_id = d_stock_id;
ELSEIF d_fund_id IS NOT NULL THEN
	SET real_stock_id = d_fund_id;
ELSEIF p_STORMF = "stock" THEN
	INSERT INTO securities(account_id, ticker_symbol, amount, type) VALUES (p_account_id, UPPER(p_stock_symbol), 0, "stock");
	SET real_stock_id = LAST_INSERT_ID();
	INSERT INTO stock VALUES (LAST_INSERT_ID(), "th");
ELSEIF p_STORMF = "mutual_fund" THEN
	INSERT INTO securities(account_id, ticker_symbol, amount, type) VALUES (p_account_id, UPPER(p_stock_symbol), 0, "mutual_fund");
	SET real_stock_id = LAST_INSERT_ID();
	INSERT INTO mutual_fund VALUES (LAST_INSERT_ID(),p_RMFORESG);
ELSE
	SIGNAL SQLSTATE '45000' 
		SET MESSAGE_TEXT = 'Invalid p_STORMF value. Must be "stock" or "mutual_fund"';
END IF;

INSERT INTO transaction_trade_th (transaction_type, stock_id, unit, unit_price, gross_amount_thb, fee, vat, transaction_date, account_cash_id) 
	VALUES (p_transaction_type, real_stock_id, p_unit, p_unit_price, p_gross_amount, p_fee, p_vat, p_transaction_date, p_account_id);

END$$
delimiter ;

--update avg after insert buy trade th
DELIMITER $$
DROP TRIGGER IF EXISTS update_avg_after_insert_buy_trade_th $$
CREATE TRIGGER update_avg_after_insert_buy_trade_th
AFTER INSERT ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_prev_units DECIMAL(18,6) DEFAULT 0;
    DECLARE v_prev_avg   DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_units  DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_cost   DECIMAL(18,6) DEFAULT 0;

    IF NEW.transaction_type = 'buy' THEN

        -- ดึงหน่วยและราคาเฉลี่ยเดิม
        SELECT COALESCE(s.amount,0), COALESCE(s.avg_per_unit,0)
        INTO v_prev_units, v_prev_avg
        FROM securities s
        WHERE s.securities_id = NEW.stock_id;

        -- ต้นทุนเพิ่ม
        SET v_new_cost =
              COALESCE(NEW.gross_amount_thb,0)
            + COALESCE(NEW.fee,0)
            + COALESCE(NEW.vat,0);

        -- หน่วยรวมใหม่
        SET v_new_units = v_prev_units + COALESCE(NEW.unit,0);

        IF v_new_units > 0 THEN
            UPDATE securities
            SET amount = v_new_units,
                avg_per_unit =
                    (v_prev_units * v_prev_avg + v_new_cost) / v_new_units
            WHERE securities_id = NEW.stock_id;
        END IF;

    END IF;

END $$
DELIMITER ;


--update avg after insert buy trade us
DELIMITER $$
DROP TRIGGER IF EXISTS update_avg_after_insert_buy_trade_us $$
CREATE TRIGGER update_avg_after_insert_buy_trade_us
AFTER INSERT ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_prev_units DECIMAL(18,6) DEFAULT 0;
    DECLARE v_prev_avg   DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_units  DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_cost   DECIMAL(18,6) DEFAULT 0;

    IF NEW.transaction_type = 'buy' THEN

        -- ดึงหน่วยและราคาเฉลี่ยเดิม
        SELECT COALESCE(s.amount,0), COALESCE(s.avg_per_unit,0)
        INTO v_prev_units, v_prev_avg
        FROM securities s
        WHERE s.securities_id = NEW.stock_id;

        -- ต้นทุนเพิ่ม
        SET v_new_cost =
              COALESCE(NEW.gross_amount_usd,0)
            + COALESCE(NEW.fee,0)
            + COALESCE(NEW.vat,0);

        -- หน่วยรวมใหม่
        SET v_new_units = v_prev_units + COALESCE(NEW.unit,0);

        IF v_new_units > 0 THEN
            UPDATE securities
            SET amount = v_new_units,
                avg_per_unit =
                    (v_prev_units * v_prev_avg + v_new_cost) / v_new_units
            WHERE securities_id = NEW.stock_id;
        END IF;

    END IF;

END $$
DELIMITER ;

--update avg after delete trade th
DELIMITER $$
DROP TRIGGER IF EXISTS update_avg_after_delete_buy_trade_th $$
CREATE TRIGGER update_avg_after_delete_buy_trade_th
AFTER DELETE ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_prev_units   DECIMAL(18,6) DEFAULT 0;
    DECLARE v_prev_avg     DECIMAL(18,6) DEFAULT 0;
    DECLARE v_total_before DECIMAL(18,6) DEFAULT 0;
    DECLARE v_removed_cost DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_units    DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_avg      DECIMAL(18,6) DEFAULT 0;

    IF OLD.transaction_type = 'buy' THEN
        -- ดึงสถานะพอร์ตปัจจุบัน
        SELECT COALESCE(s.amount,0), COALESCE(s.avg_per_unit,0)
        INTO v_prev_units, v_prev_avg
        FROM securities s
        WHERE s.securities_id = OLD.stock_id;

        SET v_total_before = v_prev_units * v_prev_avg;  -- ต้นทุนรวมก่อนย้อน
        SET v_removed_cost =
              COALESCE(OLD.gross_amount_thb,0)
            + COALESCE(OLD.fee,0)
            + COALESCE(OLD.vat,0);

        SET v_new_units = v_prev_units - COALESCE(OLD.unit,0);

        IF v_new_units > 0 THEN
            -- กันค่าติดลบจากการป้อน fee/vat เกิน
            SET v_new_avg = GREATEST(v_total_before - v_removed_cost, 0) / v_new_units;

            UPDATE securities
            SET amount = v_new_units,
                avg_per_unit = v_new_avg
            WHERE securities_id = OLD.stock_id;
        ELSE
            -- ไม่เหลือหน่วย → เคลียร์พอร์ตตัวนี้
            UPDATE securities
            SET amount = 0,
                avg_per_unit = 0
            WHERE securities_id = OLD.stock_id;
        END IF;
    END IF;
END $$
DELIMITER ;



--update avg after delete trade us
DELIMITER $$
DROP TRIGGER IF EXISTS update_avg_after_delete_buy_trade_us $$
CREATE TRIGGER update_avg_after_delete_buy_trade_us
AFTER DELETE ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_prev_units   DECIMAL(18,6) DEFAULT 0;
    DECLARE v_prev_avg     DECIMAL(18,6) DEFAULT 0;
    DECLARE v_total_before DECIMAL(18,6) DEFAULT 0;
    DECLARE v_removed_cost DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_units    DECIMAL(18,6) DEFAULT 0;
    DECLARE v_new_avg      DECIMAL(18,6) DEFAULT 0;

    IF OLD.transaction_type = 'buy' THEN
        -- ดึงสถานะพอร์ตปัจจุบัน
        SELECT COALESCE(s.amount,0), COALESCE(s.avg_per_unit,0)
        INTO v_prev_units, v_prev_avg
        FROM securities s
        WHERE s.securities_id = OLD.stock_id;

        SET v_total_before = v_prev_units * v_prev_avg;  -- ต้นทุนรวมก่อนย้อน
        SET v_removed_cost =
              COALESCE(OLD.gross_amount_usd,0)
            + COALESCE(OLD.fee,0)
            + COALESCE(OLD.vat,0);

        SET v_new_units = v_prev_units - COALESCE(OLD.unit,0);

        IF v_new_units > 0 THEN
            SET v_new_avg = GREATEST(v_total_before - v_removed_cost, 0) / v_new_units;

            UPDATE securities
            SET amount = v_new_units,
                avg_per_unit = v_new_avg
            WHERE securities_id = OLD.stock_id;
        ELSE
            UPDATE securities
            SET amount = 0,
                avg_per_unit = 0
            WHERE securities_id = OLD.stock_id;
        END IF;
    END IF;
END $$
DELIMITER ;



--prevent selling withing enough unit
DELIMITER $$
DROP TRIGGER IF EXISTS prevent_oversell_unit_before_insert_trade_th $$
CREATE TRIGGER prevent_oversell_unit_before_insert_trade_th
BEFORE INSERT ON transaction_trade_th
FOR EACH ROW
BEGIN
    DECLARE v_current_units DECIMAL(12,6);

    IF NEW.transaction_type = 'sell' THEN
        -- ดึงจำนวนหน่วยที่ถืออยู่
        SELECT COALESCE(s.amount, 0)
        INTO v_current_units
        FROM securities s
        WHERE s.securities_id = NEW.stock_id;

        -- ถ้าไม่มี row ใน securities เลย หรือ amount น้อยกว่า unit ที่จะขาย → error
        IF v_current_units < NEW.unit THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient units to SELL. You are trying to sell more than you hold or you are not holding any unit of this stock.';
        END IF;
    END IF;
END $$

DELIMITER ;


--prevent selling withing enough unit
DELIMITER $$
DROP TRIGGER IF EXISTS prevent_oversell_unit_before_insert_trade_us $$
CREATE TRIGGER prevent_oversell_unit_before_insert_trade_us
BEFORE INSERT ON transaction_trade_us
FOR EACH ROW
BEGIN
    DECLARE v_current_units DECIMAL(12,6);

    IF NEW.transaction_type = 'sell' THEN
        -- ดึงจำนวนหน่วยที่ถืออยู่
        SELECT COALESCE(s.amount, 0)
        INTO v_current_units
        FROM securities s
        WHERE s.securities_id = NEW.stock_id;

        -- ถ้าไม่มี row ใน securities เลย หรือ amount น้อยกว่า unit ที่จะขาย → error
        IF v_current_units < NEW.unit THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Insufficient units to SELL. You are trying to sell more than you hold or you are not holding any unit of this stock.';
        END IF;
    END IF;
END $$

DELIMITER ;

--initial cash when insert new acoount
DELIMITER $$
DROP TRIGGER IF EXISTS prevent_same_accountid_and_tickersymbol_in_securities $$
CREATE TRIGGER prevent_same_accountid_and_tickersymbol_in_securities
AFTER INSERT ON account
FOR EACH ROW
BEGIN
    -- สร้าง row ใน cash ให้ account ที่พึ่งถูกสร้าง
    INSERT INTO cash (account_id, amount_thb, amount_usd)
    VALUES (NEW.id, 0.00, 0.00)
    ON DUPLICATE KEY UPDATE
        -- กันกรณีมี row อยู่แล้ว (เช่นจากสคริปต์อื่น)
        amount_thb = amount_thb,
        amount_usd = amount_usd;
END $$
DELIMITER ;












DROP PROCEDURE IF EXISTS Calc_Fee_Deduction;
delimiter $$
CREATE PROCEDURE Calc_Fee_Deduction(
    IN p_account_id INT UNSIGNED,
    OUT p_total_fee_thb DECIMAL(8, 2),
    OUT p_total_fee_usd DECIMAL(8, 2) 
)
BEGIN

    -- 1. Calculate Total Fee in THB (Thai Trades)
    SELECT COALESCE(SUM(TTH.fee), 0.00) INTO p_total_fee_thb
    FROM transaction_trade_th TTH
    JOIN securities S ON TTH.stock_id = S.securities_id
    WHERE S.account_id = p_account_id;

    -- 2. Calculate Total Fee in USD (US Trades)
    SELECT COALESCE(SUM(TTU.fee), 0.00) INTO p_total_fee_usd
    FROM transaction_trade_us TTU
    JOIN securities S ON TTU.stock_id = S.securities_id
    WHERE S.account_id = p_account_id;

END$$
delimiter ;

DROP PROCEDURE IF EXISTS Calc_THESG;
delimiter $$
CREATE PROCEDURE Calc_THESG(
IN p_account_id INT UNSIGNED,
OUT Total_THESG_Deduction DECIMAL(14,2)
)
BEGIN
DECLARE total_thaiesg_purchased DECIMAL(14,2);
-- Calculate total THESG gross purchases for the current year
SELECT SUM(T.gross_amount_thb) INTO total_thaiesg_purchased
FROM transaction_trade_th T 
JOIN mutual_fund M ON M.securities_id = T.stock_id
JOIN securities S ON T.stock_id = S.securities_id
WHERE S.account_id = p_account_id 
AND M.type = 'thaiesg' 
AND YEAR(T.transaction_date) = YEAR(CURRENT_DATE());
    
-- Check if the total is NULL (no purchases), and set to 0.00
IF total_thaiesg_purchased IS NULL THEN
    SET total_thaiesg_purchased = 0.00;
END IF; -- <-- Added missing END IF

-- Apply the deduction cap (300,000.00 THB)
IF total_thaiesg_purchased > 300000.00 THEN
    SET total_thaiesg_purchased = 300000.00;
END IF; -- <-- Added missing END IF

-- Return the final deductible amount
SET Total_THESG_Deduction = total_thaiesg_purchased;
END$$
delimiter ;

DROP PROCEDURE IF EXISTS Calc_RMF;
delimiter $$
CREATE PROCEDURE Calc_RMF(
IN p_account_id INT UNSIGNED, 
OUT Total_RMF_Deduction DECIMAL(14,2)
)
BEGIN
DECLARE total_rmf_purchased DECIMAL(14,2);
-- Calculate total RMF gross purchases for the current year
SELECT SUM(T.gross_amount_thb) INTO total_rmf_purchased
FROM transaction_trade_th T 
JOIN mutual_fund M on M.securities_id = T.stock_id
JOIN securities S ON T.stock_id = S.securities_id
WHERE S.account_id = p_account_id
AND M.type = 'rmf' 
AND YEAR(T.transaction_date) = YEAR(CURRENT_DATE());

-- Check if the total is NULL (no purchases), and set to 0.00
IF total_rmf_purchased IS NULL THEN
    SET total_rmf_purchased = 0.00;
END IF; -- <-- Added missing END IF

-- Apply the deduction cap (500,000.00 THB)
IF total_rmf_purchased > 500000.00 THEN
    SET total_rmf_purchased = 500000.00;
END IF; -- <-- Added missing END IF

-- Return the final deductible amount
SET Total_RMF_Deduction = total_rmf_purchased;
END$$
delimiter ;

DROP PROCEDURE IF EXISTS Calc_Vat_Deduction;
delimiter $$
CREATE PROCEDURE Calc_Vat_Deduction(
    IN p_account_id INT UNSIGNED,
    OUT p_total_vat_thb DECIMAL(8, 2),
    OUT p_total_vat_usd DECIMAL(8, 2) 
)
BEGIN

    -- 1. Calculate Total Fee in THB (Thai Trades)
    SELECT COALESCE(SUM(TTH.vat), 0.00) INTO p_total_vat_thb
    FROM transaction_trade_th TTH
    JOIN securities S ON TTH.stock_id = S.securities_id
    WHERE S.account_id = p_account_id;

    -- 2. Calculate Total Fee in USD (US Trades)
    SELECT COALESCE(SUM(TTU.vat), 0.00) INTO p_total_vat_usd
    FROM transaction_trade_us TTU
    JOIN securities S ON TTU.stock_id = S.securities_id
    WHERE S.account_id = p_account_id;

END$$
delimiter ;

DROP PROCEDURE IF EXISTS Calc_Total_Deductions;
DELIMITER $$
CREATE PROCEDURE Calc_Total_Deductions(
    IN p_account_id INT UNSIGNED,
    OUT p_grand_total_deduction_thb DECIMAL(18, 2),
    OUT p_grand_total_deduction_usd DECIMAL(18, 2)
)
BEGIN
    -- Variables to hold results from individual calls
    DECLARE v_fee_thb DECIMAL(8, 2);
    DECLARE v_fee_usd DECIMAL(8, 2);
    DECLARE v_vat_thb DECIMAL(8, 2);
    DECLARE v_vat_usd DECIMAL(8, 2);
    DECLARE v_thesg_deduction DECIMAL(14, 2);
    DECLARE v_rmf_deduction DECIMAL(14, 2);

    -- Initialize output parameters
    SET p_grand_total_deduction_thb = 0.00;
    SET p_grand_total_deduction_usd = 0.00;

    -- 1. Calculate Fees Paid
    CALL Calc_Fee_Deduction(p_account_id, v_fee_thb, v_fee_usd);

    -- 2. Calculate VAT Paid
    CALL Calc_Vat_Deduction(p_account_id, v_vat_thb, v_vat_usd);

    -- 3. Calculate THESG Deduction (THB only)
    CALL Calc_THESG(p_account_id, v_thesg_deduction);

    -- 4. Calculate RMF Deduction (THB only)
    CALL Calc_RMF(p_account_id, v_rmf_deduction);

    -- 5. Aggregate THB Deductions
    -- Total THB Deduction = THB Fees + THB VAT + THESG Tax Deduction + RMF Tax Deduction
    SET p_grand_total_deduction_thb = 
        COALESCE(v_fee_thb, 0.00) + 
        COALESCE(v_vat_thb, 0.00) + 
        COALESCE(v_thesg_deduction, 0.00) + 
        COALESCE(v_rmf_deduction, 0.00);

    -- 6. Aggregate USD Deductions
    -- Total USD Deduction = USD Fees + USD VAT
    SET p_grand_total_deduction_usd = 
        COALESCE(v_fee_usd, 0.00) + 
        COALESCE(v_vat_usd, 0.00);

END$$
DELIMITER ;


DROP PROCEDURE IF EXISTS Calc_Taxable_Gains_US;
DELIMITER $$
CREATE PROCEDURE Calc_Taxable_Gains_US(
    IN p_account_id INT UNSIGNED,
    IN p_stock_symbol VARCHAR(30),
    OUT p_taxable_gain DECIMAL(14,2)
)
BEGIN
    DECLARE v_stock_id INT UNSIGNED;
    DECLARE v_transaction_id INT UNSIGNED;
    DECLARE v_transaction_type VARCHAR(4);
    DECLARE v_unit DECIMAL(14, 6);
    DECLARE v_unit_price DECIMAL(14, 2);
    DECLARE v_transaction_date DATETIME;
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_units_to_sell DECIMAL(14, 6) DEFAULT 0;
    DECLARE v_fifo_buy_id INT UNSIGNED;
    DECLARE v_fifo_cost DECIMAL(14, 2);
    DECLARE v_inventory_units DECIMAL(14, 6);
    DECLARE v_units_matched DECIMAL(14, 6);
    DECLARE v_profit DECIMAL(14, 2);
    DECLARE cur CURSOR FOR
        SELECT transaction_id, transaction_type, unit, unit_price, transaction_date
        FROM transaction_trade_us TTU
        JOIN securities S ON TTU.stock_id = S.securities_id
        WHERE S.account_id = p_account_id AND S.ticker_symbol = UPPER(p_stock_symbol)
        ORDER BY TTU.transaction_date ASC, TTU.transaction_id ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    -- Temporary FIFO inventory table
    CREATE TEMPORARY TABLE IF NOT EXISTS fifo_inventory_tbl (
        buy_transaction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cost_per_unit DECIMAL(14, 2),
        units_remaining DECIMAL(14, 6)
    );
    TRUNCATE TABLE fifo_inventory_tbl;

    CREATE TEMPORARY TABLE IF NOT EXISTS tax_gain_log_tbl (
        transaction_id INT UNSIGNED,
        gain_amount DECIMAL(14, 2),
        transaction_date DATETIME
    );
    TRUNCATE TABLE tax_gain_log_tbl;

    -- Get stock_id
    SELECT securities_id INTO v_stock_id
    FROM securities
    WHERE account_id = p_account_id AND ticker_symbol = UPPER(p_stock_symbol);

    IF v_stock_id IS NULL THEN
        SET p_taxable_gain = 0.00;
    ELSE
        -- Cursor loop
        OPEN cur;
        read_loop: LOOP
            FETCH cur INTO v_transaction_id, v_transaction_type, v_unit, v_unit_price, v_transaction_date;
            IF v_done THEN
                LEAVE read_loop;
            END IF;

            IF v_transaction_type = 'buy' THEN
                INSERT INTO fifo_inventory_tbl (cost_per_unit, units_remaining)
                VALUES (v_unit_price, v_unit);
            ELSEIF v_transaction_type = 'sell' THEN
                SET v_units_to_sell = v_unit;

                WHILE v_units_to_sell > 0 DO
                    -- Get the oldest inventory lot
                    SELECT buy_transaction_id, cost_per_unit, units_remaining
                    INTO v_fifo_buy_id, v_fifo_cost, v_inventory_units
                    FROM fifo_inventory_tbl
                    ORDER BY buy_transaction_id ASC
                    LIMIT 1;

                    IF v_fifo_buy_id IS NULL THEN
                        LEAVE read_loop;
                    END IF;

                    -- Calculate units to match
                    SET v_units_matched = LEAST(v_units_to_sell, v_inventory_units);
                    SET v_profit = (v_unit_price - v_fifo_cost) * v_units_matched;

                    -- Log the gain if profitable
                    IF v_profit > 0 THEN
                        INSERT INTO tax_gain_log_tbl (transaction_id, gain_amount, transaction_date)
                        VALUES (v_transaction_id, v_profit, v_transaction_date);
                    END IF;

                    -- Update inventory - reduce units from oldest lot
                    UPDATE fifo_inventory_tbl
                    SET units_remaining = units_remaining - v_units_matched
                    WHERE buy_transaction_id = v_fifo_buy_id;

                    -- Remove fully depleted lots
                    DELETE FROM fifo_inventory_tbl WHERE units_remaining <= 0;
                    
                    SET v_units_to_sell = v_units_to_sell - v_units_matched;
                END WHILE;
            END IF;
        END LOOP;
        CLOSE cur;

        -- Calculate final taxable gain
        SET p_taxable_gain = (
            SELECT COALESCE(SUM(gain_amount), 0.00)
            FROM tax_gain_log_tbl
        );
    END IF;

    -- Clean up temporary tables
    DROP TEMPORARY TABLE IF EXISTS fifo_inventory_tbl;
    DROP TEMPORARY TABLE IF EXISTS tax_gain_log_tbl;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS Calc_All_Taxable;
DELIMITER $$
CREATE PROCEDURE Calc_All_Taxable(
IN p_account_id INT UNSIGNED,
OUT Total_Taxable_Gains_All_US_Stocks_USD DECIMAL(14,2)
)
BEGIN
    -- Declare variables for iteration and summing
    DECLARE v_ticker_symbol VARCHAR(30);
    DECLARE v_single_stock_gain DECIMAL(14, 2);
    DECLARE v_total_taxable_gains DECIMAL(14, 2) DEFAULT 0.00;
    DECLARE done INT DEFAULT FALSE;

    -- Cursor to iterate through all unique US stock symbols for the account
    DECLARE cur_stocks CURSOR FOR
        SELECT DISTINCT ticker_symbol
        FROM securities S
        JOIN stock ST ON S.securities_id = ST.securities_id
        WHERE S.account_id = p_account_id
          AND S.type = 'stock'
          AND ST.type = 'us'; 

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Open cursor for stocks
    OPEN cur_stocks;

    stock_loop: LOOP
        FETCH cur_stocks INTO v_ticker_symbol;

        IF done THEN
            LEAVE stock_loop;
        END IF;

        -- 1. CALL the procedure for the current stock symbol.
        CALL Calc_Taxable_Gains_US(p_account_id, v_ticker_symbol, v_single_stock_gain);

        -- 2. Add the result of the call to the running total.
        SET v_total_taxable_gains = v_total_taxable_gains + v_single_stock_gain;

    END LOOP stock_loop;

    CLOSE cur_stocks;

    -- 3. Return the final cumulative total.
    SET Total_Taxable_Gains_All_US_Stocks_USD = v_total_taxable_gains;

END$$
DELIMITER ;


DROP PROCEDURE IF EXISTS Calc_Current_Asset_Holdings;
DELIMITER $$
CREATE PROCEDURE Calc_Current_Asset_Holdings(
    IN p_account_id INT UNSIGNED,
    OUT p_total_assets_thb DECIMAL(18, 2),
    OUT p_total_assets_usd DECIMAL(18, 2)  
)
BEGIN
    DECLARE v_security_thb_value DECIMAL(18, 2) DEFAULT 0.00;
    DECLARE v_security_usd_value DECIMAL(18, 2) DEFAULT 0.00;
    DECLARE v_cash_thb DECIMAL(18, 2) DEFAULT 0.00;
    DECLARE v_cash_usd DECIMAL(18, 2) DEFAULT 0.00;

    -- 1. Calculate the value of STOCK and MUTUAL FUND holdings
    SELECT 
        COALESCE(SUM(CASE 
                WHEN T.currency = 'THB' THEN T.current_value
                ELSE 0.00 
            END), 0.00),
        COALESCE(SUM(CASE 
                WHEN T.currency = 'USD' THEN T.current_value
                ELSE 0.00 
            END), 0.00)
    INTO v_security_thb_value, v_security_usd_value
    FROM (
        SELECT
            S.amount * S.avg_per_unit AS current_value,
            CASE
                WHEN ST.type = 'th' OR MF.type IN ('th', 'rmf', 'thaiesg') THEN 'THB'
                WHEN ST.type = 'us' THEN 'USD'
                ELSE 'UNKNOWN' 
            END AS currency
        FROM securities S
        LEFT JOIN stock ST ON S.securities_id = ST.securities_id
        LEFT JOIN mutual_fund MF ON S.securities_id = MF.securities_id
        WHERE S.account_id = p_account_id
        AND S.amount > 0
    ) AS T;

    -- 2. Add CASH holdings 
    
    SELECT 
        COALESCE(C.amount_thb, 0.00),
        COALESCE(C.amount_usd, 0.00)
    INTO v_cash_thb, v_cash_usd
    FROM cash C
    WHERE C.account_id = p_account_id;
    
    -- 3. Assign the final cumulative totals to the OUT parameters
    SET p_total_assets_thb = v_security_thb_value + v_cash_thb;
    SET p_total_assets_usd = v_security_usd_value + v_cash_usd;

END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS Calc_Total_Cash_Deposit_THB;
DELIMITER $$
CREATE PROCEDURE Calc_Total_Cash_Deposit_THB(
    IN p_account_id INT UNSIGNED,
    OUT p_total_deposit_thb DECIMAL(18, 2)
)
BEGIN
    -- Calculate the total amount_thb for transactions that represent a THB cash deposit.
    SELECT 
        COALESCE(SUM(TE.amount_thb), 0.00)
    INTO 
        p_total_deposit_thb
    FROM 
        transaction_exchange TE
    WHERE 
        TE.account_cash_id = p_account_id
        AND (TE.amount_usd IS NULL OR TE.amount_usd = 0) 
        AND TE.transaction_type = 'SELL'; 

END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS Calc_Total_Cash_Withdrawal_THB;
DELIMITER $$
CREATE PROCEDURE Calc_Total_Cash_Withdrawal_THB(
    IN p_account_id INT UNSIGNED,
    OUT p_total_withdrawal_thb DECIMAL(18, 2)
)
BEGIN
    -- Calculate the total amount_thb for transactions that represent a THB cash withdrawal.
    SELECT 
        COALESCE(SUM(TE.amount_thb), 0.00)
    INTO 
        p_total_withdrawal_thb
    FROM 
        transaction_exchange TE
    WHERE 
        TE.account_cash_id = p_account_id
        AND (TE.amount_usd IS NULL OR TE.amount_usd = 0) 
        AND TE.transaction_type = 'BUY';

END$$
DELIMITER ;

