'use strict';
// Pipou — 베레모 쓴 파리 비둘기. mood: idle | happy | sad | think | sleep | cheer
window.Pipou = (() => {
  const INK = '#1b1f2a';
  const eyes = {
    idle: `<g class="blink"><ellipse cx="47" cy="47" rx="5.2" ry="6.6" fill="${INK}"/><ellipse cx="73" cy="47" rx="5.2" ry="6.6" fill="${INK}"/>
      <circle cx="49" cy="44.6" r="2" fill="#fff"/><circle cx="75" cy="44.6" r="2" fill="#fff"/></g>`,
    happy: `<path d="M41.5 48.5 Q47 41 52.5 48.5" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <path d="M67.5 48.5 Q73 41 78.5 48.5" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
    sad: `<ellipse cx="47" cy="48" rx="4.6" ry="5.4" fill="${INK}"/><ellipse cx="73" cy="48" rx="4.6" ry="5.4" fill="${INK}"/>
      <circle cx="48.6" cy="46" r="1.6" fill="#fff"/><circle cx="74.6" cy="46" r="1.6" fill="#fff"/>
      <path d="M41 41.5 Q46 40.5 52 37.5" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M79 41.5 Q74 40.5 68 37.5" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M89 34 q4 7 0 9 q-4 -2 0 -9z" fill="#7cc4ff"/>`,
    think: `<ellipse cx="47" cy="47" rx="5" ry="6.4" fill="${INK}"/><ellipse cx="73" cy="46" rx="5" ry="6.4" fill="${INK}"/>
      <circle cx="49" cy="44.6" r="1.9" fill="#fff"/><circle cx="75" cy="43.6" r="1.9" fill="#fff"/>
      <path d="M67 36.5 Q73 33 79 36" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sleep: `<path d="M41.5 47 Q47 51 52.5 47" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M67.5 47 Q73 51 78.5 47" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <text x="90" y="30" font-size="13" font-weight="900" fill="#8b9bd0" font-family="sans-serif">z</text><text x="99" y="19" font-size="10" font-weight="900" fill="#8b9bd0" font-family="sans-serif">z</text>`,
  };
  eyes.cheer = eyes.happy;
  const mouth = {
    idle: '', think: '', sleep: '',
    happy: `<path d="M56 60.5 Q60 66 64 60.5 Z" fill="#c2415d"/>`,
    cheer: `<path d="M55 60 Q60 68.5 65 60 Z" fill="#c2415d"/>`,
    sad: `<path d="M56.5 64 Q60 61 63.5 64" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  };
  function svg(mood = 'idle', cls = '') {
    const up = mood === 'happy' || mood === 'cheer';
    return `<svg class="pipou m-${mood} ${cls}" viewBox="0 0 120 120" role="img" aria-label="Pipou">
      <ellipse cx="60" cy="113" rx="28" ry="4.5" fill="rgba(20,30,60,.13)"/>
      <g fill="#ff9f43"><ellipse cx="49" cy="107" rx="7" ry="3.6"/><ellipse cx="71" cy="107" rx="7" ry="3.6"/></g>
      <g class="wing wl"><ellipse cx="25" cy="${up ? 58 : 74}" rx="9.5" ry="16" fill="#7d8fc6" transform="rotate(${up ? 38 : 16} 25 ${up ? 58 : 74})"/></g>
      <g class="wing wr"><ellipse cx="95" cy="${up ? 58 : 74}" rx="9.5" ry="16" fill="#7d8fc6" transform="rotate(${up ? -38 : -16} 95 ${up ? 58 : 74})"/></g>
      <path d="M60 24 C87 24 100 46 100 71 C100 95 84 107 60 107 C36 107 20 95 20 71 C20 46 33 24 60 24 Z" fill="#9daddb"/>
      <ellipse cx="60" cy="84" rx="25" ry="19" fill="#e9eefb"/>
      <path d="M33 64 Q60 77 87 64 L87 71.5 Q60 85 33 71.5 Z" fill="#ff4b5c"/>
      <path d="M40 68.2 L40 75.4 M50 71.5 L50 78.6 M60 72.7 L60 79.8 M70 71.5 L70 78.6 M80 68.2 L80 75.4" stroke="#fff" stroke-width="2.2" opacity=".85"/>
      <path d="M74 73 L83 92 L75 93.5 L68 76 Z" fill="#ff4b5c"/>
      <path d="M72.5 79.5 L77 79 M75 85.5 L79.5 85" stroke="#fff" stroke-width="2" opacity=".85"/>
      ${eyes[mood] || eyes.idle}
      <ellipse cx="37.5" cy="56.5" rx="5.2" ry="3.2" fill="#ff8fab" opacity=".75"/>
      <ellipse cx="82.5" cy="56.5" rx="5.2" ry="3.2" fill="#ff8fab" opacity=".75"/>
      <path d="M54.5 53.5 Q60 50 65.5 53.5 Q60 61.5 54.5 53.5 Z" fill="#ffb547"/>
      ${mouth[mood] || ''}
      <g class="beret">
        <path d="M31 30 Q34 13 60 11 Q88 10 93 25 Q80 21 60 23 Q42 25 31 30 Z" fill="#283454"/>
        <ellipse cx="62" cy="26" rx="31" ry="6.2" fill="#1f2842" transform="rotate(-6 62 26)"/>
        <path d="M60 12 q1 -6 5 -7" stroke="#283454" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`;
  }
  return { svg };
})();
