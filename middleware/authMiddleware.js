import e from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (redirect, endPoint = '/login', needToken = '0') => {
  if (redirect) {
    return function (req, res, next) {
      const token = req.cookies.token;

      if(!token && needToken == '0') return next();
      if(!token && needToken == '1') return res.redirect(302, endPoint);
      if(token && needToken == '0') return res.redirect(302, endPoint);
    
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (err) {
        return res.redirect(302, endPoint);
      }
    };
  } else {
    return function (req, res, next) {
      const token = req.cookies.token;

      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    };
  }
}