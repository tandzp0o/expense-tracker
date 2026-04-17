// import * as admin from 'firebase-admin';
// import * as dotenv from 'dotenv';

// dotenv.config();

// if (!admin.apps.length) {
//   try {
//     admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId: process.env.FIREBASE_PROJECT_ID,
//         clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//         privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//       }),
//     });
//     console.log('Firebase Admin đã được khởi tạo');
//   } catch (error: any) {
//     console.error('Lỗi khởi tạo Firebase Admin:', error.message);
//   }
// }

// export default admin;


// //------------------------------------------------
// import * as admin from 'firebase-admin';
// import * as dotenv from 'dotenv';

// dotenv.config();

// if (!admin.apps.length) {
//   try {
//     const projectId = process.env.FIREBASE_PROJECT_ID;
//     const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
//     const privateKey = process.env.FIREBASE_PRIVATE_KEY;

//     if (!projectId || !clientEmail || !privateKey) {
//       throw new Error('Thiếu cấu hình Firebase (Project ID, Email hoặc Private Key)');
//     }

//     admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId: projectId,
//         clientEmail: clientEmail,
//         // Railway đôi khi yêu cầu xử lý ký tự xuống dòng của Private Key
//         privateKey: privateKey.replace(/\\n/g, '\n'),
//       }),
//     });
    
//     console.log('✅ Firebase Admin đã được khởi tạo thành công');
//   } catch (error: any) {
//     console.error('❌ Lỗi khởi tạo Firebase Admin:', error.message);
//   }
// }

// export default admin;

//--------------------------------------------------
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Thiếu cấu hình Firebase (Project ID, Email hoặc Private Key)');
    }

    // Xử lý tất cả các format private key có thể có:
    // 1. Literal \n  (từ env var dạng string)
    // 2. \\n         (double escaped)
    // 3. Xuống dòng thật (từ Python paste trực tiếp)
    const normalizedKey = privateKey
      .replace(/\\\\n/g, '\n')  // \\n → \n thật
      .replace(/\\n/g, '\n')    // \n literal → \n thật
      .trim();

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: normalizedKey,
      }),
    });

    console.log('✅ Firebase Admin đã được khởi tạo thành công');
  } catch (error: any) {
    console.error('❌ Lỗi khởi tạo Firebase Admin:', error.message);
  }
}

export default admin;
