import { useId } from 'react';

const Windows = ({ x, y, columns, rows, dx = 34, dy = 42, warm = false }) => (
  <g>
    {Array.from({ length: rows * columns }, (_, index) => (
      <g key={index} transform={`translate(${x + (index % columns) * dx} ${y + Math.floor(index / columns) * dy})`}>
        <rect width="17" height="25" rx="1.5" fill={warm && index % 4 === 0 ? '#f9d58a' : '#6b8f9a'} />
        <path d="M8.5 1v23M1 12h15" stroke={warm && index % 4 === 0 ? '#d2ae68' : '#aac1c4'} strokeWidth="1.5" />
        <path d="M-2 26h21" stroke="#ffffff80" strokeWidth="3" />
      </g>
    ))}
  </g>
);

const Tree = ({ x, y, scale = 1, light = false }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="9" rx="33" ry="9" fill="#1c665e20" />
    <path d="M0 0v-115" stroke="#3e7268" strokeWidth="8" strokeLinecap="round" />
    <g className="campus-tree-crown scene-motion">
      <path d="M-46-105c-6-26 1-52 21-65-3-27 37-37 48-10 25-5 45 22 31 46 28 28 12 66-22 68-31 31-89 5-78-39Z" fill={light ? '#8fbf98' : '#579b82'} />
      <path d="M-26-136c-16 23-12 45 7 58 15 10 35 9 46-1-31 0-44-25-35-62Z" fill={light ? '#7bac86' : '#438871'} />
      <path d="M0-69v-75m0 39-20-18m21 1 21-20" fill="none" stroke={light ? '#659f7b' : '#3b806e'} strokeWidth="3" strokeLinecap="round" />
    </g>
  </g>
);

const Cloud = ({ x, y, scale = 1, className = '' }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity=".78">
    <path className={`scene-motion campus-cloud ${className}`} d="M0 34c-11-12 0-28 15-27 7-21 39-21 45 1 15-8 31 1 30 15 23-3 30 13 18 17H5Z" fill="#fff" />
  </g>
);

const Student = ({ x, y, shirt = '#e7a354', scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="1" cy="1" rx="16" ry="4" fill="#24564d18" />
    <g className="campus-student scene-motion">
      <path d="m-5-22-3 19m14-19 4 19" stroke="#315467" strokeWidth="5" strokeLinecap="round" />
      <path d="M-11-2h6m12 0h6" stroke="#f6f2de" strokeWidth="4" strokeLinecap="round" />
      <path d="m-8-45-3 24 23 1-6-26Z" fill={shirt} />
      <path d="m-8-41-10 19m24-20 8 18" stroke="#b98469" strokeWidth="4" strokeLinecap="round" />
      <rect x="-14" y="-43" width="7" height="18" rx="3" fill="#436d68" />
      <path d="M-3-50v6" stroke="#bd8a72" strokeWidth="5" />
      <circle cy="-57" r="8" fill="#c79578" />
      <path d="M-8-56c-2-13 16-15 17-3l-10-4Z" fill="#354c4f" />
    </g>
  </g>
);

const CampusLandscape = () => {
  const prefix = useId().replace(/:/g, '');
  return (
    <svg className="campus-landscape" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" data-campus-scene="true">
      <defs>
        <linearGradient id={`${prefix}-hill`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9ec7ba" /><stop offset="1" stopColor="#c5d9ba" /></linearGradient>
        <linearGradient id={`${prefix}-lawn`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b7cb95" /><stop offset="1" stopColor="#87b88c" /></linearGradient>
        <linearGradient id={`${prefix}-path`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eee7ca" /><stop offset="1" stopColor="#d8cba5" /></linearGradient>
        <linearGradient id={`${prefix}-roof`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d88565" /><stop offset="1" stopColor="#bc7059" /></linearGradient>
      </defs>

      {/* Sky, drifting cloud layers and distant hills. */}
      <circle cx="1110" cy="252" r="73" fill="#edcc8e" opacity=".52" />
      <circle cx="1110" cy="252" r="103" fill="none" stroke="#edcc8e" strokeWidth="1" opacity=".3" />
      <Cloud x={40} y={328} scale={1.4} />
      <Cloud x={610} y={422} scale={.65} className="cloud-slow" />
      <Cloud x={1320} y={295} scale={1.1} className="cloud-reverse" />
      <Cloud x={1430} y={484} scale={.6} />
      <path d="M0 652 90 614 192 639 330 556 453 618 585 585 722 631 872 563 1024 618 1164 569 1330 621 1470 577 1600 625v180H0Z" fill="#b7d2cf" />
      <path d="M0 690c190-78 283-50 448-19 167 31 302-45 460-26 155 20 253 9 371-18 100-23 215 8 321 43v180H0Z" fill={`url(#${prefix}-hill)`} />
      <path d="M0 757c187-34 328 24 507 1 193-25 375-17 534 16 171 36 351-55 559-9v235H0Z" fill={`url(#${prefix}-lawn)`} />
      <path d="M715 745c-27 49-95 70-143 86C366 901 263 933 135 1000h191c104-62 192-89 321-135 67-24 116-61 120-112Z" fill={`url(#${prefix}-path)`} />
      <path d="M740 786c178 38 240 46 415 54 219 10 294 60 445 124v36h-32c-228-92-314-97-466-105-201-10-296-29-412-73Z" fill="#ddd4b2" />
      <path d="M738 785c176 39 241 47 415 54" fill="none" stroke="#f5edd5" strokeWidth="5" />

      {/* Residence A: terracotta block with a warm arcade. */}
      <g className="campus-buildings">
        <ellipse cx="280" cy="815" rx="185" ry="22" fill="#457f6c20" />
        <path d="m129 601 71-41 200 2 44 39Z" fill={`url(#${prefix}-roof)`} />
        <path d="m119 601 325-2v12H119Z" fill="#a96150" />
        <path d="M143 612h267v183H143Z" fill="#e5b69a" />
        <path d="M369 612h41v183h-41Z" fill="#cea18c" />
        <path d="M138 655h273m-273 43h273m-273 43h273" stroke="#edc5ad" strokeWidth="4" />
        <Windows x={166} y={624} rows={3} columns={6} dx={34} dy={42} warm />
        <rect x="154" y="764" width="205" height="32" fill="#b17d6c" />
        {[171, 208, 245, 282, 319].map(x => <path key={x} d={`M${x} 796v-17a12 12 0 0 1 24 0v17Z`} fill="#796f71" />)}
        <path d="M134 797h281v11H134Z" fill="#b68e77" />
        <rect x="266" y="580" width="52" height="12" rx="2" fill="#d79c7f" />
      </g>

      {/* Central residence: stepped facade, balconies and an arched entry. */}
      <g className="campus-buildings">
        <ellipse cx="493" cy="820" rx="129" ry="20" fill="#3f786321" />
        <path d="M391 548h197v248H391Z" fill="#f3e5c5" />
        <path d="M560 548h28v248h-28Z" fill="#dfcfae" />
        <path d="m379 547 21-17h178l24 17v8H379Z" fill="#99adb0" />
        <path d="M425 530v-22h106v22Z" fill="#e5d3b1" />
        <path d="M418 506h120v8H418Z" fill="#6b9298" />
        <path d="M481 506v-45" stroke="#738c84" strokeWidth="3" />
        <path className="campus-flag scene-motion" d="M482 461c14-8 21 7 35 1v23c-14 6-21-10-35-1Z" fill="#e09c64" />
        <rect x="417" y="562" width="116" height="29" fill="#e7d7b7" />
        <text x="475" y="581" fill="#7e887f" fontFamily="DM Sans, sans-serif" fontSize="10" letterSpacing="3" textAnchor="middle">RESIDENCE</text>
        <Windows x={416} y={609} rows={3} columns={4} dx={37} dy={42} warm />
        <path d="M449 797v-42a27 27 0 0 1 54 0v42" fill="#748b8b" />
        <path d="M477 733v65" stroke="#a2b5ae" strokeWidth="2" />
        <path d="M432 798h90v9h-90m-9 9h107" stroke="#d7c3a1" strokeWidth="7" />
        {[635, 677, 719].map(y => <g key={y}><path d={`M406 ${y}h142`} stroke="#f9f1dd" strokeWidth="5" /><path d={`M406 ${y + 6}h142`} stroke="#cebfa3" strokeWidth="2" /></g>)}
      </g>

      {/* Community building and a small covered cycle stand. */}
      <g>
        <path d="M595 686h159v117H595Z" fill="#8dbab1" />
        <path d="m585 686 22-22h141l23 22Z" fill="#547f83" />
        <path d="M720 686h34v117h-34Z" fill="#78a89f" />
        <Windows x={611} y={702} rows={2} columns={4} dx={32} dy={38} />
        <path d="M587 805h176" stroke="#6f9d90" strokeWidth="8" />
        <rect x="623" y="789" width="77" height="13" fill="#e2d4af" />
        <path d="M97 771H21l18-27h78Z" fill="#6a9290" />
        <path d="M31 771v44m64-44v44" stroke="#5c7f74" strokeWidth="4" />
        <g stroke="#5d817b" fill="none" strokeWidth="2"><circle cx="48" cy="803" r="10" /><circle cx="76" cy="803" r="10" /><path d="m48 803 10-17 8 17H48l16-17 12 17m-15-17h9" /></g>
      </g>

      {/* Rear garden, right-hand residences and trees. */}
      <g opacity=".8">
        <path d="M1128 684h209v108h-209Z" fill="#a8c2bd" />
        <path d="m1116 684 29-26h185l22 26Z" fill="#6f9a9a" />
        <Windows x={1149} y={705} columns={5} rows={2} dx={34} dy={37} />
      </g>
      <Tree x={59} y={844} scale={1.25} />
      <Tree x={785} y={810} scale={.95} light />
      <Tree x={1016} y={790} scale={.72} />
      <Tree x={1391} y={835} scale={1.25} light />
      <Tree x={1555} y={851} scale={1.45} />
      <Tree x={1209} y={816} scale={.62} light />

      {/* Courtyard details: benches, lamps, students and a cyclist. */}
      <g strokeLinecap="round"><path d="M801 856h53m-49 8h46m-43-19v30m40-30v30" stroke="#857e61" strokeWidth="5" /><path d="M782 847v-65m-10 0h20" stroke="#52796d" strokeWidth="3" /><path d="M775 780v-13h14v13Z" fill="#f7dc9c" stroke="#648275" strokeWidth="2" /></g>
      <g transform="translate(650 822)"><g className="campus-walk scene-motion"><Student x={0} y={0} shirt="#d48969" scale={.8} /><Student x={27} y={5} shirt="#f3d28b" scale={.76} /></g></g>
      <Student x={364} y={865} shirt="#6d9ea0" scale={.82} />
      <g transform="translate(1025 873)">
        <g className="campus-cyclist scene-motion">
          <ellipse cx="0" cy="9" rx="48" ry="6" fill="#466b5c18" />
          <g fill="none" stroke="#3c6e6d" strokeWidth="3"><circle cx="-27" cy="-10" r="16" /><circle cx="23" cy="-10" r="16" /><path d="m-27-10 18-27 13 27h-31l24-27 26 27M-9-37h14m8-8h8l5 35" /></g>
          <path d="m-6-61-6 21 21 12-9 17" fill="none" stroke="#35556b" strokeWidth="6" strokeLinecap="round" />
          <path d="m-6-59 12 14 12 1" fill="none" stroke="#b68b70" strokeWidth="4" strokeLinecap="round" />
          <path d="m-10-63 12 3-7 20-12-2Z" fill="#edbf67" />
          <circle cx="-3" cy="-73" r="8" fill="#c49676" /><path d="M-11-74c0-13 16-11 17-3l-13-2" fill="#466064" />
        </g>
      </g>

      {/* Foreground foliage makes the landscape feel like a place to enter. */}
      <g className="campus-foreground">
        <path d="M0 939c49-71 86-40 113 6 34-62 95-40 120 18 47-37 96-15 110 37H0Z" fill="#3f8772" />
        <path d="M0 979c47-31 91-22 111 21H0m148 0c12-48 72-48 89 0" fill="#317361" />
        <path d="M56 1000c-3-42-15-76-26-104m28 74c6-54 29-73 56-88M91 1000c13-42 39-68 62-78" fill="none" stroke="#6ea788" strokeWidth="4" />
        <path d="M19 914c-14-28-1-45 18-31 18 15 14 33-8 39m41 18c-1-39 30-54 40-29 10 26-14 39-40 29m48 31c9-35 38-47 45-25 8 23-16 33-45 25" fill="#90b68a" />
        <path d="M1319 1000c19-55 52-62 86-20 15-69 80-88 121-28 25-65 58-55 74-32v80Z" fill="#4f947d" />
        <path d="M1470 1000c9-42 24-69 53-99m-17 99c22-31 45-47 78-51" fill="none" stroke="#95bb8e" strokeWidth="5" />
        <path d="M1490 935c-12-38 13-63 33-40 18 22 5 42-23 48m35 38c4-35 41-51 49-27 7 23-15 34-49 27" fill="#bdd09d" />
      </g>
    </svg>
  );
};

export default CampusLandscape;
