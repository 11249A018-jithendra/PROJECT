import { useId } from 'react';

const StudentRoomScene = () => {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="student-room-scene" viewBox="0 0 760 500" aria-hidden="true" focusable="false" data-student-scene="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ec9a79" /><stop offset=".6" stopColor="#f2bf88" /><stop offset="1" stopColor="#f8d8a4" /></linearGradient>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#356064" /><stop offset="1" stopColor="#254950" /></linearGradient>
        <radialGradient id={`${id}-light`}><stop stopColor="#fbd386" stopOpacity=".3" /><stop offset="1" stopColor="#fbd386" stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}-window`}><path d="M256 110a122 122 0 0 1 244 0v194H256Z" /></clipPath>
      </defs>
      <ellipse cx="379" cy="454" rx="300" ry="25" fill="#091f2640" />
      <path d="M89 337 412 258l267 98-273 119Z" fill={`url(#${id}-floor)`} />
      <path d="M89 337V126L412 44v214Z" fill="#254b52" />
      <path d="M412 44 679 140v216L412 258Z" fill="#1e4149" />
      <path d="M92 127 412 46 677 141" fill="none" stroke="#42666a" strokeWidth="3" />

      {/* An arched sunset window, with a campus on the other side. */}
      <g transform="translate(-74 21)">
        <path d="M244 110a134 134 0 0 1 268 0v206H244Z" fill="#42696c" />
        <path d="M256 110a122 122 0 0 1 244 0v194H256Z" fill={`url(#${id}-sky)`} />
        <g clipPath={`url(#${id}-window)`}>
          <circle cx="426" cy="100" r="37" fill="#ffe6b0" />
          <g className="student-scene-motion student-window-cloud"><path d="M277 118c-10-12 1-23 12-19 6-19 26-18 33-3 20-5 33 13 21 22Z" fill="#ffe8ce" opacity=".7" /></g>
          <path d="M235 262 290 225 328 247 388 206 451 248 516 225v100H235Z" fill="#899d8c" />
          <path d="M266 304v-69h57v69m-62-69 10-10h47l10 10" fill="#567c7a" />
          <path d="M339 304V196h64v108m-69-108 11-10h52l11 10" fill="#4c7275" />
          <path d="M419 304v-53h67v53m-72-53 10-12h56l12 12" fill="#688a7d" />
          {[277, 298, 350, 377, 432, 460].map((x, index) => <g key={x} fill="#f5cf92"><rect x={x} y={index > 3 ? 264 : 246} width="7" height="11" rx="1" />{index > 1 && index < 4 && <><rect x={x} y="221" width="7" height="11" rx="1" /><rect x={x} y="270" width="7" height="11" rx="1" /></>}</g>)}
          <path d="M436 171q10-11 20-1m17-9q9-10 18-1" stroke="#9a836f" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        <path d="M378 0v304M256 174h244" stroke="#42696c" strokeWidth="7" />
        <path d="M247 312h262" stroke="#72908a" strokeWidth="9" strokeLinecap="round" />
        <path d="m259 109 23 10m195-7 14-7" stroke="#fff6df" strokeWidth="3" opacity=".4" />
      </g>

      {/* A compact student room: books, plant, desk and warm task lighting. */}
      <g transform="translate(488 129)">
        <path d="m0 0 139 49v10L0 10Z" fill="#75968a" />
        <path d="M3-42v42l9 3v-42Z" fill="#e2ad78" /><path d="M14-34V4l12 4v-39Z" fill="#b37769" /><path d="M28-40V9l9 3v-50Z" fill="#d6d4ae" /><path d="m42-34 9-1 10 54-9 1Z" fill="#d8a372" />
        <path d="m88 2 30 10-4 30-24-8Z" fill="#be8f6e" />
        <g className="student-scene-motion student-room-plant"><path d="M103 9V-34m0 26c-24-4-28-23-12-23 14 2 10 18 12 23m0-5c24-7 26-27 11-27-13 1-10 18-11 27" fill="#9ab98b" stroke="#6f9982" strokeWidth="2" /></g>
      </g>
      <path d="m171 313 221-38 158 56-220 49Z" fill="#c99576" />
      <path d="m171 313 159 55 220-37v11l-220 49-159-56Z" fill="#a96d59" />
      <path d="m185 336 8 89m338-79-4 78m-194-37v78" stroke="#754d46" strokeWidth="9" strokeLinecap="round" />
      <path d="m220 309 61-11 41 17-60 13Z" fill="#e6dfbd" />
      <path d="m266 319 20-5" stroke="#9fa99b" strokeWidth="2" />
      <g><path d="m332 273 64-13 19 61-64 14Z" fill="#243e4c" stroke="#6e9292" strokeWidth="3" /><path d="m341 280 47-10 13 42-47 11Z" fill="#4f777b" /><path d="m350 336 64-14 34 10-65 15Z" fill="#789592" /><path d="m372 337 26-5" stroke="#426c71" strokeWidth="3" /></g>
      <ellipse cx="224" cy="290" rx="39" ry="40" fill={`url(#${id}-light)`} />
      <path d="m217 309 16-5m-8 0 8-68 26-21" stroke="#e1b879" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="m246 208 26 12-19 17-21-9Z" fill="#f3cb83" /><path d="m238 230 13 5" stroke="#fff0b8" strokeWidth="3" />
      <path d="m465 321 20-4 9 14-19 4Z" fill="#edc2a0" /><path d="m485 319 6-1q12 6 3 10" fill="none" stroke="#edc2a0" strokeWidth="3" />
      <path className="student-scene-motion student-cup-steam" d="M479 313q-7-8 0-15t0-14" stroke="#d2ddd0" strokeWidth="2" fill="none" opacity=".45" />

      {/* Soft furnishings and a backpack keep it recognisably student life. */}
      <g transform="translate(353 360)"><path d="M-8 12 54-2 63 51 3 68Z" fill="#d58d76" /><path d="M-8 12v39l11 17 60-17" fill="#b97564" /><path d="m6 64-3 44m46-54 10 34" stroke="#567474" strokeWidth="7" strokeLinecap="round" /><path d="m18 18 20-5" stroke="#e5aa8a" strokeWidth="3" /></g>
      <g transform="translate(560 353)"><path d="M0 9q-2-29 25-24l15 5q18 4 12 30l-9 34L0 37Z" fill="#e0ad70" /><path d="m18-11 4-13q15-6 20 13" stroke="#9f7a52" strokeWidth="4" fill="none" /><path d="m6 14 36 12-5 15L7 29Z" fill="#c79562" /><path d="m46 9 11 6-7 32" fill="none" stroke="#b88d62" strokeWidth="4" /></g>
      <path d="m114 389 48-12 16 47-48 15Z" fill="#97a58b" /><g className="student-scene-motion student-room-plant"><path d="m142 390-4-68m4 43c-36-11-39-37-19-32 17 4 18 21 19 32m-2-18c30-4 44-28 23-29-18 0-22 15-23 29m-2-7c-23-23-10-48 2-34 8 12-2 24-2 34" fill="#719a7f" stroke="#527e72" strokeWidth="2" /></g>

      {/* Small paper notes and a drifting paper plane. */}
      <g transform="translate(548 226) rotate(13)"><rect width="34" height="39" rx="1" fill="#ddbb7b" /><path d="M8 13h18M8 20h14M8 27h16" stroke="#b18d5d" strokeWidth="2" /></g>
      <g className="student-scene-motion student-paper-plane"><path d="m581 48 63-17-36 45-6-22Z" fill="#e6d6ae" /><path d="m602 54 42-23-36 45" fill="#c5b893" /><path d="m569 64-21 13-22 1" stroke="#78928a" strokeWidth="1.5" strokeDasharray="4 5" fill="none" /></g>
      <g fill="#c4c9a0" opacity=".7"><circle cx="119" cy="78" r="2" /><circle cx="696" cy="83" r="2" /><circle cx="82" cy="256" r="2" /><path d="m711 257 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" /><path d="m190 39 1.5-5 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5Z" /></g>
    </svg>
  );
};

export default StudentRoomScene;
