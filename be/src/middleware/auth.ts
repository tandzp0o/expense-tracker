import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  console.log('Headers nhận được:', req.headers);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Không tìm thấy token trong header');
    return res.status(401).json({ message: 'No token provided' });
  }

  const idToken = authHeader.split(' ')[1];
  console.log('Nhận được token:', idToken ? `${idToken.substring(0, 20)}...` : 'Không có');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Token hợp lệ cho user:', decodedToken.email);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || ''
    };
    next();
  } catch (error: any) {
    console.error('Lỗi xác thực token:', error.message);
    if (error.code === 'auth/id-token-expired') {
      console.log('Token đã hết hạn');
    }
    return res.status(401).json({ 
      message: 'Invalid or expired token',
      error: error.message 
    });
  }
};