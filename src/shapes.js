export const shapes = {
 rect: {name:'사각형',icon:'square',element:'rect',attrs:'x="1" y="1" width="98" height="98"'},
 circle: {name:'원',icon:'circle',element:'ellipse',attrs:'cx="50" cy="50" rx="49" ry="49"'},
 rounded: {name:'둥근 사각형',icon:'square',element:'rect',attrs:'x="1" y="1" width="98" height="98" rx="14"'},
 triangle: {name:'삼각형',icon:'triangle',element:'polygon',attrs:'points="50,2 98,98 2,98"'},
 diamond: {name:'마름모',icon:'diamond',element:'polygon',attrs:'points="50,1 99,50 50,99 1,50"'},
 pentagon: {name:'오각형',icon:'pentagon',element:'polygon',attrs:'points="50,2 98,38 80,98 20,98 2,38"'},
 hexagon: {name:'육각형',icon:'hexagon',element:'polygon',attrs:'points="25,2 75,2 99,50 75,98 25,98 1,50"'},
 star: {name:'별',icon:'star',element:'polygon',attrs:'points="50,2 62,35 98,36 70,58 80,96 50,75 20,96 30,58 2,36 38,35"'},
 arrow: {name:'화살표',icon:'arrow-right',element:'polygon',attrs:'points="2,28 62,28 62,2 98,50 62,98 62,72 2,72"'},
 parallelogram: {name:'평행사변형',icon:'square',element:'polygon',attrs:'points="24,2 98,2 76,98 2,98"'},
 speech: {name:'말풍선',icon:'message-square',element:'path',attrs:'d="M12 2H88Q98 2 98 12V72Q98 82 88 82H38L16 98V82H12Q2 82 2 72V12Q2 2 12 2Z"'},
 heart: {name:'하트',icon:'heart',element:'path',attrs:'d="M50 96C38 84 2 57 2 28C2 0 34 -5 50 21C66 -5 98 0 98 28C98 57 62 84 50 96Z"'},
};
export const isShape = type => Object.hasOwn(shapes,type);
export function shapeMarkup(type) {
 const s=shapes[type];if(!s)return '';
 return `<svg class="shape-surface" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><${s.element} ${s.attrs} fill="var(--shape-fill,var(--block-color))" stroke="var(--shape-stroke,#8594ad)" stroke-width="var(--shape-stroke-width,1px)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
