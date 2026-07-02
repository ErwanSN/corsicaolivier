import styles from "./Separator.module.css";

export type SeparatorProps = Readonly<{
  label: string;
}>;

export function Separator({ label }: SeparatorProps) {
  return (
    <div className={styles.separator}>
      <span className={styles.line} />
      <span className={styles.label}>{label}</span>
      <span className={styles.line} />
    </div>
  );
}
