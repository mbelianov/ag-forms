export function AutoCalcDot({ size = 6 }: { size?: number }) {
  return (
    <span
      title="Manually overridden"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#f1c21b',
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: 4,
        flexShrink: 0,
      }}
    />
  );
}
