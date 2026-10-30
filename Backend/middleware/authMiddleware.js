
import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Not Authorized: No token provided'
        });
    }

   
    const token = authHeader.split(' ')[1];

    try {
       
        const decoded = jwt.verify(
            token,
            process.env.JWT_TOKEN
        );

       
        req.userId = decoded.userId;

        
        next();

    } catch (error) {
        return res.status(401).json({
            message: 'Not Authorized: Invalid or expired token'
        });
    }
};

export default protect;
