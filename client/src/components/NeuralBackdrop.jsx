const paths = [
  'M-80 170 C120 60 250 250 470 130 S790 70 1040 210 S1320 240 1560 100',
  'M-120 360 C130 250 300 430 520 320 S860 250 1080 390 S1390 430 1640 270',
  'M-40 560 C180 450 350 620 600 520 S910 430 1190 570 S1450 600 1690 470',
];

const nodes = [
  [120, 120], [270, 185], [430, 135], [610, 175], [790, 110], [980, 185], [1180, 140], [1380, 195],
  [90, 330], [250, 385], [430, 315], [650, 350], [850, 285], [1050, 385], [1280, 335], [1490, 390],
  [160, 540], [360, 585], [560, 515], [760, 565], [980, 490], [1200, 575], [1410, 525],
];

const links = [
  [0,9],[1,8],[1,10],[2,9],[2,11],[3,10],[3,12],[4,11],[4,13],[5,12],[5,14],[6,13],[6,15],
  [8,17],[9,16],[9,18],[10,17],[10,19],[11,18],[11,20],[12,19],[12,21],[13,20],[13,22],[14,21],[15,22],
];

export default function NeuralBackdrop() {
  return (
    <div className="neural-backdrop" aria-hidden="true">
      <div className="neural-glow neural-glow-a" />
      <div className="neural-glow neural-glow-b" />
      <svg className="neural-svg" viewBox="0 0 1600 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="signalLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#260506" />
            <stop offset="48%" stopColor="#ef1b24" />
            <stop offset="100%" stopColor="#43090b" />
          </linearGradient>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor="#ff7b80" />
            <stop offset="45%" stopColor="#ef1b24" />
            <stop offset="100%" stopColor="#5b0a0d" />
          </radialGradient>
          <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <g className="neural-mesh">
          {links.map(([a,b], i) => (
            <line
              key={i}
              x1={nodes[a][0]} y1={nodes[a][1]}
              x2={nodes[b][0]} y2={nodes[b][1]}
              className="mesh-link"
            />
          ))}
        </g>

        <g className="neural-chains">
          {paths.map((d, i) => (
            <path key={i} d={d} className={`chain-line chain-line-${i+1}`} pathLength="100" />
          ))}
        </g>

        <g className="neural-nodes">
          {nodes.map(([cx,cy], i) => (
            <g key={i} style={{ '--delay': `${(i % 9) * 0.27}s` }}>
              <circle cx={cx} cy={cy} r="18" fill="#ef1b24" opacity="0.07" filter="url(#softGlow)" />
              <circle cx={cx} cy={cy} r="3.5" fill="url(#nodeGlow)" className="node-core" />
              <circle cx={cx} cy={cy} r="9" className="node-ring" />
            </g>
          ))}
        </g>
      </svg>
      <div className="neural-grid" />
      <div className="neural-vignette" />
    </div>
  );
}
