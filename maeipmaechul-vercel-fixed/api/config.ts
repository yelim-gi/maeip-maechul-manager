export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    });
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      message: 'Vercel에서는 서버 파일 저장 대신 Project Settings > Environment Variables 값을 사용합니다.'
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
