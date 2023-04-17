import styles from "../styles/Home.module.css";

const Tooltip = ({ content }) => {
  return (
    <div className={styles.tooltip}>
      <span className={styles.questionMark}>?</span>
      <div className={styles.tooltipText}>{content}</div>
    </div>
  );
};

export default Tooltip;
