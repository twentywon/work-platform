export const fonts = {
 system: ['기본 글꼴', '"Segoe UI", "Malgun Gothic", sans-serif'],
 malgun: ['맑은 고딕', '"Malgun Gothic", sans-serif'],
 gulim: ['굴림', 'Gulim, sans-serif'],
 batang: ['바탕', 'Batang, serif'],
 arial: ['Arial', 'Arial, sans-serif'],
 georgia: ['Georgia', 'Georgia, serif'],
 mono: ['고정폭', 'Consolas, monospace'],
};
export const textTypes = ['text','note','checkbox','rect','circle','table','web','pagelink','file','drawer'];
export const hexColor = value => typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value);
export function textStyle(format={}) {
 const parts=[];
 if(Object.hasOwn(fonts,format.font))parts.push('font-family:'+fonts[format.font][1]);
 if(Number.isFinite(format.size))parts.push('font-size:'+Math.max(8,Math.min(120,format.size))+'px');
 if(typeof format.bold==='boolean')parts.push('font-weight:'+(format.bold?700:400));
 if(typeof format.italic==='boolean')parts.push('font-style:'+(format.italic?'italic':'normal'));
 if(typeof format.underline==='boolean'||typeof format.strike==='boolean')parts.push('text-decoration:'+([format.underline?'underline':'',format.strike?'line-through':''].filter(Boolean).join(' ')||'none'));
 if(hexColor(format.color))parts.push('color:'+format.color);
 if(['left','center','right','justify'].includes(format.align))parts.push('text-align:'+format.align);
 if(Number.isFinite(format.lineHeight))parts.push('line-height:'+Math.max(1,Math.min(3,format.lineHeight)));
 return parts.join(';');
}
export function appearanceStyle(block) {
 const parts=[];
 if(hexColor(block.background)||block.background==='transparent')parts.push('background:'+block.background);
 if(hexColor(block.borderColor))parts.push('border-color:'+block.borderColor);
 if(Number.isFinite(block.borderWidth))parts.push('border-width:'+Math.max(0,Math.min(12,block.borderWidth))+'px');
 if(Number.isFinite(block.opacity))parts.push('opacity:'+Math.max(.1,Math.min(1,block.opacity)));
 if(hexColor(block.lineColor))parts.push('--line-color:'+block.lineColor);
 if(Number.isFinite(block.lineWidth))parts.push('--line-width:'+Math.max(1,Math.min(20,block.lineWidth))+'px');
 if(['contain','cover'].includes(block.fit))parts.push('--media-fit:'+block.fit);
 return parts.join(';');
}
