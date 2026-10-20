import {shapes} from './shapes.js';
export const blockNames = {
  drawer: '서랍', text: '텍스트', note: '메모', table: '표', rect: '사각형', circle: '원',
  ...Object.fromEntries(Object.entries(shapes).map(([key,s])=>[key,s.name])),
  hline: '가로 구분선', vline: '세로 구분선', file: '파일', checkbox: '체크박스',
  media: '이미지·영상·GIF', web: '인터넷 링크', pagelink: '페이지 링크', calendar: '달력',
};
export function webURL(value) {
  const raw = String(value).trim();
  if (!raw) throw Error('인터넷 주소를 입력해 주세요.');
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw Error('http 또는 https 인터넷 주소를 입력해 주세요.');
  return url.href;
}
export function mediaKind(file) {
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name)) return 'image';
  if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(file.name)) return 'video';
  return null;
}
export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
export function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  const offset = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  return [...Array(Math.ceil((offset + count) / 7) * 7)].map((_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}
