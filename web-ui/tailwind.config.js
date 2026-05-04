export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 8-bit palette
        background: '#0D0D1A',
        surface:    '#1A1A2E',
        panel:      '#16213E',
        primary:    '#00FF41',   // matrix green
        secondary:  '#FF00FF',   // magenta
        accent:     '#FFD700',   // gold / coin yellow
        info:       '#00CFFF',   // cyan
        danger:     '#FF3A3A',   // red
        dark:       '#0A0A14',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono:  ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        pixel: '4px 4px 0px #000',
        'pixel-lg': '6px 6px 0px #000',
        'pixel-glow-green': '0 0 12px #00FF41, 0 0 24px #00FF4155',
        'pixel-glow-pink':  '0 0 12px #FF00FF, 0 0 24px #FF00FF55',
        'pixel-glow-gold':  '0 0 12px #FFD700, 0 0 24px #FFD70055',
      },
      animation: {
        blink:   'blink 1s step-end infinite',
        marquee: 'marquee 12s linear infinite',
        scanline:'scanline 4s linear infinite',
        'pixel-pulse': 'pixelPulse 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0' },
        },
        marquee: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        pixelPulse: {
          '0%, 100%': { boxShadow: '0 0 8px #00FF41, 0 0 16px #00FF4155' },
          '50%':       { boxShadow: '0 0 20px #00FF41, 0 0 40px #00FF4188' },
        },
      },
    },
  },
  plugins: [],
}
