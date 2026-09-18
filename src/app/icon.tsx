import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 50%, #10B981 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '8px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
        }}
      >
        W
      </div>
    ),
    {
      ...size,
    }
  );
}
