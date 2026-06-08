export function randNum(min, max) {
    return Math.random() * (max - min) + min;
}
export function randBetween(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min
}