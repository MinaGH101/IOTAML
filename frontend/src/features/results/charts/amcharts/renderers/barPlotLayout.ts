export type HorizontalBarLabelLayout = {
  categoryLabelWidth: number;
  groupLabelWidth: number;
  groupLabelGap: number;
};

function approximateTextWidth(text: string, fontSize: number) {
  return Math.ceil(Array.from(text).length * fontSize * 0.68);
}

export function getHorizontalBarLabelLayout(
  categories: string[],
  groupLabels: string[],
  compact: boolean,
): HorizontalBarLabelLayout {
  return {
    categoryLabelWidth: Math.min(140, Math.max(...categories.map((category) => approximateTextWidth(category, 11)))),
    groupLabelWidth: Math.min(140, Math.max(...groupLabels.map((label) => approximateTextWidth(label, compact ? 9 : 10)))),
    groupLabelGap: 14,
  };
}
