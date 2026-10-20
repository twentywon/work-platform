export function tableCells(rows, columns) {
 if(!Number.isInteger(rows)||rows<1||rows>100||!Number.isInteger(columns)||columns<1||columns>30||rows*columns>1500)
  throw Error('줄은 1~100, 칸은 1~30이며 전체 셀은 1,500개 이하여야 합니다.');
 return Array.from({length:rows},()=>Array(columns).fill(''));
}
