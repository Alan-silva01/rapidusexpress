
import React, { useState, useEffect } from 'react';

const images = [
  'https://iqsdjmhuznrfczefbluk.supabase.co/storage/v1/object/public/fotos/Logo%20Upzy%20800x1000%20(3).png',
  'https://iqsdjmhuznrfczefbluk.supabase.co/storage/v1/object/public/fotos/Logo%20Upzy%20800x1000%20(1).png',
  'https://iqsdjmhuznrfczefbluk.supabase.co/storage/v1/object/public/fotos/Logo%20Upzy%20800x1000.png',
  'https://iqsdjmhuznrfczefbluk.supabase.co/storage/v1/object/public/fotos/Logo%20Upzy%20800x1000%20(2).png'
];

export const Banner: React.FC = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-32 overflow-hidden rounded-3xl border border-white/5 group">
      {images.map((img, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
            idx === current ? 'opacity-100' : 'opacity-0 scale-105'
          }`}
        >
          <img src={img} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      ))}
      
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, idx) => (
          <div key={idx} className={`h-1 rounded-full transition-all duration-500 ${idx === current ? 'w-4 bg-orange-primary' : 'w-1 bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
};
