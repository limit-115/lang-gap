import styles from "./site-background.module.css";

export function SiteBackground() {
  return (
    <div className={styles.background} data-site-background="contour" aria-hidden="true">
      <svg
        viewBox="0 0 1440 1080"
        preserveAspectRatio="xMidYMin slice"
        className={styles.artwork}
        focusable="false"
      >
        <defs>
          <radialGradient id="site-contour-wash">
            <stop stopColor="var(--contour-wash)" />
            <stop offset="1" stopColor="var(--contour-wash)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="1320" cy="165" rx="540" ry="460" fill="url(#site-contour-wash)" />
        <g className={styles.lines} fill="none" strokeWidth="0.85">
          {Array.from({ length: 36 }, (_, index) => (
            <ellipse
              key={index}
              cx="1390"
              cy="30"
              rx={190 + index * 12}
              ry={125 + index * 13}
              transform="rotate(-32 1390 30)"
            />
          ))}
          {Array.from({ length: 25 }, (_, index) => (
            <ellipse
              key={index}
              cx="-222"
              cy="864"
              rx={245 + index * 11}
              ry={160 + index * 15}
              transform="rotate(28 -222 864)"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
