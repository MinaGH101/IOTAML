export function evenlySample<T>(values: readonly T[], limit: number): T[] {
    const maximum = Math.max(2, Math.floor(limit));
    if (values.length <= maximum)
        return Array.from(values);
    const sampled = new Array<T>(maximum);
    const lastIndex = values.length - 1;
    sampled[0] = values[0];
    sampled[maximum - 1] = values[lastIndex];
    for (let index = 1; index < maximum - 1; index += 1) {
        const sourceIndex = Math.round((index * lastIndex) / (maximum - 1));
        sampled[index] = values[sourceIndex];
    }
    return sampled;
}
