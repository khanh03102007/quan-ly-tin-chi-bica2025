import React from 'react';

interface AnimatedBicaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const AnimatedBicaLogo: React.FC<AnimatedBicaLogoProps> = ({
  size = 'lg',
  showText = true,
  className = '',
}) => {
  const sizeConfig = {
    sm: {
      svgSize: 52,
      titleSize: 'text-xs',
      subSize: 'text-[10px]',
      khoaSize: 'text-[8px]',
      lineWidth: 'w-8',
    },
    md: {
      svgSize: 136,
      titleSize: 'text-base sm:text-lg',
      subSize: 'text-xs sm:text-sm',
      khoaSize: 'text-[10px]',
      lineWidth: 'w-12 sm:w-16',
    },
    lg: {
      svgSize: 230,
      titleSize: 'text-xl sm:text-[26px]',
      subSize: 'text-sm sm:text-[19px]',
      khoaSize: 'text-xs sm:text-[13px]',
      lineWidth: 'w-14 sm:w-24',
    },
    xl: {
      svgSize: 300,
      titleSize: 'text-2xl sm:text-3xl',
      subSize: 'text-base sm:text-xl',
      khoaSize: 'text-sm sm:text-base',
      lineWidth: 'w-20 sm:w-28',
    },
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Emblem Container */}
      <div className="relative flex items-center justify-center">
        {/* Soft Deep Cyan Ambient Glow matching the reference image */}
        <div
          className="absolute rounded-full pointer-events-none blur-3xl opacity-55"
          style={{
            width: sizeConfig.svgSize * 1.25,
            height: sizeConfig.svgSize * 1.25,
            background:
              'radial-gradient(circle, rgba(0, 195, 255, 0.38) 0%, rgba(2, 86, 198, 0.22) 48%, transparent 72%)',
          }}
        />

        {/* Animated Vector Emblem: C-Arc, Half-Gear, Neural Brain, Mechatronic Pillar & Circuit Traces */}
        <svg
          width={sizeConfig.svgSize}
          height={sizeConfig.svgSize}
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 transition-transform duration-300 hover:scale-[1.03]"
        >
          <defs>
            {/* Intense Neon Cyan Outer Glow */}
            <filter id="bica-neon-glow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="4.5" result="blur1" />
              <feGaussianBlur stdDeviation="12" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft Glow for Nodes */}
            <filter id="bica-node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gradients matching the exact uploaded image */}
            <linearGradient id="bica-cyan-bright" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5ce1ff" />
              <stop offset="45%" stopColor="#00b7ff" />
              <stop offset="100%" stopColor="#0066ff" />
            </linearGradient>

            <linearGradient id="bica-arc-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4ff" />
              <stop offset="50%" stopColor="#0088ff" />
              <stop offset="100%" stopColor="#0044aa" />
            </linearGradient>

            <linearGradient id="bica-arc-deep" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="60%" stopColor="#034078" />
              <stop offset="100%" stopColor="#021b3a" />
            </linearGradient>

            <linearGradient id="bica-gear-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00b4ff" />
              <stop offset="55%" stopColor="#0066cc" />
              <stop offset="100%" stopColor="#00357a" />
            </linearGradient>

            <linearGradient id="bica-pillar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c8ff" />
              <stop offset="40%" stopColor="#0055cc" />
              <stop offset="85%" stopColor="#002b66" />
              <stop offset="100%" stopColor="#0099ff" />
            </linearGradient>

            <linearGradient id="bica-brain-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="50%" stopColor="#00c3ff" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          <style>{`
            @keyframes bica-pulse-glow {
              0%, 100% { opacity: 0.88; }
              50% { opacity: 1; }
            }
            @keyframes bica-gear-breathe {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(-2.5deg); }
            }
            @keyframes bica-energy-flow {
              to { stroke-dashoffset: -120; }
            }
            @keyframes bica-node-blink {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.18); opacity: 1; }
            }
            @keyframes bica-pillar-float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-3px); }
            }
            .bica-gear-anim {
              transform-origin: 250px 260px;
              animation: bica-gear-breathe 5s ease-in-out infinite;
            }
            .bica-flow-line {
              stroke-dasharray: 10 14;
              animation: bica-energy-flow 2.6s linear infinite;
            }
            .bica-node-pulse {
              transform-box: fill-box;
              transform-origin: center;
              animation: bica-node-blink 2.8s ease-in-out infinite;
            }
            .bica-pillar-anim {
              animation: bica-pillar-float 4.5s ease-in-out infinite;
            }
          `}</style>

          {/* ============================================================== */}
          {/* 1. LEFT & TOP-RIGHT OUTER CIRCUIT TRACES                       */}
          {/* ============================================================== */}
          <g filter="url(#bica-neon-glow)">
            {/* Top-right trace next to top arc node */}
            <path
              d="M 284 96 L 326 96"
              stroke="#00c8ff"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="332" cy="96" r="9" fill="#00b7ff" stroke="#5ce1ff" strokeWidth="2.5" className="bica-node-pulse" />

            {/* Left upper node attached to outer arc */}
            <circle cx="110" cy="206" r="8.5" fill="#38bdf8" stroke="#bae6fd" strokeWidth="2" className="bica-node-pulse" />

            {/* Left middle L-shaped trace with hollow circle node */}
            <path
              d="M 103 242 L 103 266 L 78 266"
              stroke="#00c8ff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="68" cy="266" r="9.5" fill="#04102c" stroke="#38bdf8" strokeWidth="4.5" />

            {/* Left lower short trace with solid node */}
            <path
              d="M 110 296 L 98 296"
              stroke="#00a8ff"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="92" cy="296" r="9.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="2.5" />
          </g>

          {/* ============================================================== */}
          {/* 2. RIGHT-SIDE 3 CIRCUIT TRACES (MẠCH ĐIỆN TỬ BÊN PHẢI TRỤ)     */}
          {/* ============================================================== */}
          <g filter="url(#bica-neon-glow)">
            {/* Right Trace 1 (Top) */}
            <path
              d="M 356 225 L 376 225 L 392 208 L 415 208"
              stroke="#00c8ff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="425" cy="208" r="9.5" fill="#04102c" stroke="#38bdf8" strokeWidth="4.5" />

            {/* Right Trace 2 (Middle) */}
            <path
              d="M 356 266 L 376 246 L 418 246"
              stroke="#00b4ff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="428" cy="246" r="9.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" className="bica-node-pulse" />

            {/* Right Trace 3 (Bottom) */}
            <path
              d="M 356 294 L 372 278 L 394 278"
              stroke="#0096ff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="403" cy="278" r="8.5" fill="#04102c" stroke="#00b4ff" strokeWidth="4" />
          </g>

          {/* ============================================================== */}
          {/* 3. OUTER NEON CYAN C-ARC & END NODES                           */}
          {/* ============================================================== */}
          <g filter="url(#bica-neon-glow)">
            {/* Main Outer Thin Neon Arc from Top (270, 74) around Left to Bottom (270, 446) */}
            <path
              d="M 272 74 A 186 186 0 1 0 272 446"
              stroke="url(#bica-cyan-bright)"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            {/* Animated energy pulse along outer arc */}
            <path
              d="M 272 74 A 186 186 0 1 0 272 446"
              stroke="#e0f2fe"
              strokeWidth="3"
              strokeLinecap="round"
              className="bica-flow-line"
              opacity="0.75"
            />
            {/* Top Glowing Node of Outer Arc */}
            <circle cx="272" cy="74" r="11" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="3" className="bica-node-pulse" />
            {/* Bottom Glowing Node of Outer Arc */}
            <circle cx="272" cy="446" r="11" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="3" className="bica-node-pulse" />
          </g>

          {/* ============================================================== */}
          {/* 4. SEGMENTED INNER TECH C-RING (VÒNG CUNG CÔNG NGHỆ PHÂN ĐOẠN) */}
          {/* ============================================================== */}
          <g filter="url(#bica-neon-glow)">
            {/* Top-Left Segment */}
            <path
              d="M 278 96 A 164 164 0 0 0 132 184 L 154 198 A 138 138 0 0 1 264 122 Z"
              fill="url(#bica-arc-fill)"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Highlight facet inside top-left segment */}
            <path
              d="M 274 98 A 162 162 0 0 0 202 114 L 210 134 A 138 138 0 0 1 264 122 Z"
              fill="#67e8f9"
              opacity="0.55"
            />

            {/* Middle-Left Segment */}
            <path
              d="M 126 196 A 164 164 0 0 0 144 352 L 166 334 A 138 138 0 0 1 150 210 Z"
              fill="url(#bica-arc-fill)"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Inner bevel detail on middle-left segment */}
            <path
              d="M 134 242 A 156 156 0 0 0 148 332 L 164 320 A 138 138 0 0 1 150 246 Z"
              fill="#022c5e"
              opacity="0.65"
            />

            {/* Bottom-Left Segment */}
            <path
              d="M 154 364 A 164 164 0 0 0 288 422 L 288 394 A 138 138 0 0 1 176 344 Z"
              fill="url(#bica-arc-deep)"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </g>

          {/* ============================================================== */}
          {/* 5. INNER MECHANICAL HALF-GEAR & NEURAL BRAIN                   */}
          {/* ============================================================== */}
          <g className="bica-gear-anim" filter="url(#bica-neon-glow)">
            {/* Half-Gear Outer Body with 6 Industrial Gear Teeth */}
            <path
              d="M 260 150
                 L 260 176
                 A 84 84 0 0 0 260 344
                 L 260 370
                 L 242 370 L 236 354
                 L 216 348 L 202 360 L 184 348 L 192 332
                 L 176 316 L 158 322 L 148 304 L 162 292
                 L 156 270 L 138 268 L 138 248 L 156 246
                 L 162 224 L 148 212 L 158 194 L 176 200
                 L 192 184 L 184 168 L 202 156 L 216 168
                 L 236 162 L 242 150 Z"
              fill="url(#bica-gear-grad)"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Dark Navy Cutout Ring between Gear and Brain */}
            <path
              d="M 262 178 A 82 82 0 0 0 262 342 Z"
              fill="#03091c"
              stroke="#00a8ff"
              strokeWidth="2.5"
            />

            {/* Glowing AI Neural Half-Brain Contour */}
            <path
              d="M 255 194
                 C 232 194, 216 205, 214 222
                 C 198 225, 188 238, 192 254
                 C 184 264, 186 282, 198 292
                 C 196 308, 210 322, 230 322
                 C 240 328, 255 324, 255 312
                 L 255 194 Z"
              fill="#041538"
              stroke="url(#bica-brain-grad)"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Neural Circuit Traces & Nodes inside the Brain */}
            <path
              d="M 255 218 L 236 218 L 226 228
                 M 255 248 L 232 248 L 218 236
                 M 255 274 L 228 274 L 214 288
                 M 240 274 L 240 302 L 228 302"
              stroke="#38bdf8"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="223" cy="231" r="5.5" fill="#03091c" stroke="#67e8f9" strokeWidth="3.5" />
            <circle cx="215" cy="233" r="5.5" fill="#03091c" stroke="#67e8f9" strokeWidth="3.5" />
            <circle cx="211" cy="291" r="5.5" fill="#03091c" stroke="#67e8f9" strokeWidth="3.5" />
            <circle cx="224" cy="302" r="5.5" fill="#03091c" stroke="#67e8f9" strokeWidth="3.5" />

            {/* Two Vertical Accent Bars between Brain and Right Pillar */}
            <path
              d="M 272 248 L 288 248 L 288 266 L 272 266 Z"
              fill="#5ce1ff"
            />
            <path
              d="M 272 272 L 288 272 L 288 334 L 260 352 L 260 332 L 272 324 Z"
              fill="url(#bica-arc-fill)"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
          </g>

          {/* ============================================================== */}
          {/* 6. RIGHT VERTICAL MECHATRONIC PILLAR ("1" / BLADE MONOLITH)    */}
          {/* ============================================================== */}
          <g className="bica-pillar-anim" filter="url(#bica-neon-glow)">
            {/* Outer Beveled Monolith Shape */}
            <path
              d="M 294 148
                 L 332 130
                 L 360 148
                 L 360 164
                 L 342 178
                 L 342 396
                 L 304 422
                 L 304 160
                 L 294 154 Z"
              fill="url(#bica-pillar-grad)"
              stroke="#38bdf8"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Top Glowing Highlight Cap on Pillar */}
            <path
              d="M 296 148 L 332 132 L 358 148 L 340 160 L 310 156 Z"
              fill="#38bdf8"
              opacity="0.45"
            />

            {/* Bright Cyan Core Node & Vertical Circuit Spine Inside Pillar */}
            <circle
              cx="326"
              cy="166"
              r="11"
              fill="#67e8f9"
              stroke="#ffffff"
              strokeWidth="2.5"
              filter="url(#bica-node-glow)"
              className="bica-node-pulse"
            />

            {/* Internal Circuit Line running down from the Pillar Core Node */}
            <path
              d="M 326 177 L 326 268 L 316 280 L 316 352 L 326 364 L 326 404"
              stroke="#5ce1ff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Bottom Facet Highlight on Pillar */}
            <path
              d="M 306 394 L 340 370 L 340 395 L 306 419 Z"
              fill="#00d2ff"
              opacity="0.7"
            />
          </g>
        </svg>
      </div>

      {/* =================================================================== */}
      {/* BRAND TYPOGRAPHY (CHUẨN MẪU ẢNH: ĐIỀU KHIỂN THÔNG MINH VÀ TỰ ĐỘNG HOÁ) */}
      {/* =================================================================== */}
      {showText && (
        <div className="mt-2 sm:mt-3 text-center space-y-1.5 px-4 max-w-2xl">
          {/* Line 1: ĐIỀU KHIỂN THÔNG MINH */}
          <h1
            className={`font-black tracking-[0.06em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-[#67e8f9] via-[#00b7ff] to-[#0284c7] drop-shadow-[0_0_18px_rgba(0,183,255,0.45)] ${sizeConfig.titleSize}`}
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            ĐIỀU KHIỂN THÔNG MINH
          </h1>

          {/* Line 2: VÀ TỰ ĐỘNG HOÁ */}
          <h2
            className={`font-extrabold tracking-[0.08em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-sky-200 drop-shadow-[0_2px_10px_rgba(56,189,248,0.25)] ${sizeConfig.subSize}`}
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            VÀ TỰ ĐỘNG HOÁ
          </h2>

          {/* Line 3: Circuit Line + KHOÁ 2025 + Circuit Line (Giống hệt ảnh mẫu) */}
          <div className="flex items-center justify-center pt-1.5">
            {/* Left Circuit Line: Hollow Circle -> Horizontal -> 45deg Down -> Small Dot */}
            <svg
              className={`${sizeConfig.lineWidth} h-5 text-cyan-400 shrink-0`}
              viewBox="0 0 120 24"
              fill="none"
            >
              <circle
                cx="8"
                cy="8"
                r="5"
                stroke="#00d2ff"
                strokeWidth="2.5"
                fill="#03091c"
              />
              <path
                d="M 13 8 L 88 8 L 98 18 L 112 18"
                stroke="#00d2ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="114" cy="18" r="3" fill="#38bdf8" />
            </svg>

            {/* Center Text: K H O Á  2 0 2 5 */}
            <span
              className={`px-3 sm:px-4 font-bold text-[#00c8ff] tracking-[0.32em] uppercase drop-shadow-[0_0_10px_rgba(0,200,255,0.45)] translate-y-[2px] ${sizeConfig.khoaSize}`}
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              KHOÁ 2025
            </span>

            {/* Right Circuit Line: Small Dot -> 45deg Up -> Horizontal -> Hollow Circle */}
            <svg
              className={`${sizeConfig.lineWidth} h-5 text-cyan-400 shrink-0`}
              viewBox="0 0 120 24"
              fill="none"
            >
              <circle cx="6" cy="18" r="3" fill="#38bdf8" />
              <path
                d="M 8 18 L 22 18 L 32 8 L 107 8"
                stroke="#00d2ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="112"
                cy="8"
                r="5"
                stroke="#00d2ff"
                strokeWidth="2.5"
                fill="#03091c"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
