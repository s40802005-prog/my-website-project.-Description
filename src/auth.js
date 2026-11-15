const jwt = require('jsonwebtoken');
function signToken(user) {
 return jwt.sign({ id:user.id, email:user.email, role:user.role }, process.env.JWT_SECRET, { expiresIn:'7d' });
}
function auth(req,res,next) {
 const token = req.cookies?.token;
 if (!token) return res.status(401).json({error:'Please log in.'});
 try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
 catch { res.clearCookie('token'); return res.status(401).json({error:'Session expired. Please log in again.'}); }
}
function adminOnly(req,res,next) {
 if (req.user?.role !== 'admin') return res.status(403).json({error:'Admin access required.'});
 next();
}
module.exports = { auth, adminOnly, signToken };
