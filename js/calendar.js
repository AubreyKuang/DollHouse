// The save keeps its original cycle index so timed activities and logs can
// resume. Each complete light/dark cycle advances the displayed month.
const MONTHS_PER_YEAR = 12;
const monthOf = cycle => ((cycle - 1) % MONTHS_PER_YEAR + MONTHS_PER_YEAR) % MONTHS_PER_YEAR + 1;
const yearOf = cycle => Math.floor((cycle - 1) / MONTHS_PER_YEAR) + 1;
const monthLabel = cycle => `${yearOf(cycle)} 年 ${monthOf(cycle)} 月`;
